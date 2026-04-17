import React, { useRef, useEffect } from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';
import { initGL, FULLSCREEN_VERT, hexToVec3, type GLSetup } from '../../utils/webgl';

// Faithful Remotion port of reactbits.dev Galaxy.
// GLSL fragment shader verbatim. Mouse interaction omitted (fixed at [0.5, 0.5]).

const FRAG = `
precision highp float;

uniform float uTime;
uniform vec3  uResolution;
uniform vec2  uFocal;
uniform vec2  uRotation;
uniform float uStarSpeed;
uniform float uDensity;
uniform float uHueShift;
uniform float uSpeed;
uniform vec2  uMouse;
uniform float uGlowIntensity;
uniform float uSaturation;
uniform float uTwinkleIntensity;
uniform float uRotationSpeed;
uniform float uMouseActiveFactor;
uniform float uAutoCenterRepulsion;

varying vec2 vUv;

#define NUM_LAYER 4.0
#define STAR_COLOR_CUTOFF 0.2
#define MAT45 mat2(0.7071,-0.7071,0.7071,0.7071)
#define PERIOD 3.0

float Hash21(vec2 p){
  p=fract(p*vec2(123.34,456.21));
  p+=dot(p,p+45.32);
  return fract(p.x*p.y);
}
float tri(float x){return abs(fract(x)*2.0-1.0);}
float tris(float x){float t=fract(x);return 1.0-smoothstep(0.0,1.0,abs(2.0*t-1.0));}
float trisn(float x){float t=fract(x);return 2.0*(1.0-smoothstep(0.0,1.0,abs(2.0*t-1.0)))-1.0;}

vec3 hsv2rgb(vec3 c){
  vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0);
  vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www);
  return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y);
}

float Star(vec2 uv,float flare){
  float d=length(uv);
  float m=(0.05*uGlowIntensity)/d;
  float rays=smoothstep(0.0,1.0,1.0-abs(uv.x*uv.y*1000.0));
  m+=rays*flare*uGlowIntensity;
  uv*=MAT45;
  rays=smoothstep(0.0,1.0,1.0-abs(uv.x*uv.y*1000.0));
  m+=rays*0.3*flare*uGlowIntensity;
  m*=smoothstep(1.0,0.2,d);
  return m;
}

vec3 StarLayer(vec2 uv){
  vec3 col=vec3(0.0);
  vec2 gv=fract(uv)-0.5;
  vec2 id=floor(uv);
  for(int y=-1;y<=1;y++){
    for(int x=-1;x<=1;x++){
      vec2 offset=vec2(float(x),float(y));
      vec2 si=id+vec2(float(x),float(y));
      float seed=Hash21(si);
      float size=fract(seed*345.32);
      float gloss=tri(uStarSpeed/(PERIOD*seed+1.0));
      float flareSize=smoothstep(0.9,1.0,size)*gloss;
      float red=smoothstep(STAR_COLOR_CUTOFF,1.0,Hash21(si+1.0))+STAR_COLOR_CUTOFF;
      float blu=smoothstep(STAR_COLOR_CUTOFF,1.0,Hash21(si+3.0))+STAR_COLOR_CUTOFF;
      float grn=min(red,blu)*seed;
      vec3 base=vec3(red,grn,blu);
      float hue=atan(base.g-base.r,base.b-base.r)/(2.0*3.14159)+0.5;
      hue=fract(hue+uHueShift/360.0);
      float sat=length(base-vec3(dot(base,vec3(0.299,0.587,0.114))))*uSaturation;
      float val=max(max(base.r,base.g),base.b);
      base=hsv2rgb(vec3(hue,sat,val));
      vec2 pad=vec2(tris(seed*34.0+uTime*uSpeed/10.0),tris(seed*38.0+uTime*uSpeed/30.0))-0.5;
      float star=Star(gv-offset-pad,flareSize);
      float twinkle=trisn(uTime*uSpeed+seed*6.2831)*0.5+1.0;
      twinkle=mix(1.0,twinkle,uTwinkleIntensity);
      star*=twinkle;
      col+=star*size*base;
    }
  }
  return col;
}

void main(){
  vec2 focalPx = uFocal * uResolution.xy;
  vec2 uv      = (vUv * uResolution.xy - focalPx) / uResolution.y;

  float autoRot = uTime * uRotationSpeed;
  mat2  rot     = mat2(cos(autoRot),-sin(autoRot),sin(autoRot),cos(autoRot));
  uv = rot * uv;
  uv = mat2(uRotation.x,-uRotation.y,uRotation.y,uRotation.x) * uv;

  vec3 col = vec3(0.0);
  for(float i=0.0;i<1.0;i+=1.0/NUM_LAYER){
    float depth = fract(i + uStarSpeed * uSpeed);
    float scale = mix(20.0*uDensity, 0.5*uDensity, depth);
    float fade  = depth * smoothstep(1.0,0.9,depth);
    col += StarLayer(uv*scale + i*453.32) * fade;
  }

  float alpha = length(col);
  alpha = smoothstep(0.0, 0.3, alpha);
  alpha = min(alpha, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;

export const GalaxyBg: React.FC<DimensionProps> = ({ frame, fps, palette, config }) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const glRef        = useRef<GLSetup | null>(null);
  const starSpeedRef = useRef(0.0);

  useEffect(() => {
    starSpeedRef.current = 0.0;
    const setup = initGL(canvasRef.current!, FULLSCREEN_VERT, FRAG, config.width, config.height);
    glRef.current = setup;
    return () => { glRef.current?.gl.getExtension('WEBGL_lose_context')?.loseContext(); };
  }, []); // eslint-disable-line

  useEffect(() => {
    const s = glRef.current;
    if (!s) return;
    const { gl, u } = s;

    const t = frame / fps;
    // Accumulate star speed as in original: uStarSpeed = (t * starSpeed) / 10.0
    const [br, bg_, bb] = hexToVec3(palette.bg);

    gl.uniform1f(u('uTime'),              t);
    gl.uniform3f(u('uResolution'),        config.width, config.height, config.width/config.height);
    gl.uniform2f(u('uFocal'),             0.5, 0.5);
    gl.uniform2f(u('uRotation'),          1.0, 0.0);
    gl.uniform1f(u('uStarSpeed'),         (t * 0.5) / 10.0);
    gl.uniform1f(u('uDensity'),           1.0);
    gl.uniform1f(u('uHueShift'),          0.0);
    gl.uniform1f(u('uSpeed'),             0.5);
    gl.uniform2f(u('uMouse'),             0.5, 0.5);
    gl.uniform1f(u('uGlowIntensity'),     0.35);
    gl.uniform1f(u('uSaturation'),        1.0);
    gl.uniform1f(u('uTwinkleIntensity'),  0.4);
    gl.uniform1f(u('uRotationSpeed'),     0.06);
    gl.uniform1f(u('uMouseActiveFactor'), 0.0);
    gl.uniform1f(u('uAutoCenterRepulsion'),0.0);

    gl.clearColor(br, bg_, bb, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }, [frame, fps, palette, config.width, config.height]);

  return (
    <AbsoluteFill>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </AbsoluteFill>
  );
};
