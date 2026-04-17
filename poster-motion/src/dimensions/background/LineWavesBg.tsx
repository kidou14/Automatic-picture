import React, { useRef, useEffect } from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';
import { initGL, FULLSCREEN_VERT, hexToVec3, type GLSetup } from '../../utils/webgl';

// Faithful Remotion port of reactbits.dev LineWaves.
// GLSL fragment shader is verbatim. Colors wired to palette.

const FRAG = `
precision highp float;

uniform float uTime;
uniform vec3  uResolution;
uniform float uSpeed;
uniform float uInnerLines;
uniform float uOuterLines;
uniform float uWarpIntensity;
uniform float uRotation;
uniform float uEdgeFadeWidth;
uniform float uColorCycleSpeed;
uniform float uBrightness;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;
uniform vec2  uMouse;

#define HALF_PI 1.5707963

float hashF(float n) { return fract(sin(n * 127.1) * 43758.5453123); }
float smoothNoise(float x) {
  float i = floor(x), f = fract(x);
  float u = f*f*(3.0-2.0*f);
  return mix(hashF(i), hashF(i+1.0), u);
}
float displaceA(float c, float t) {
  return sin(c*2.123)*0.2 + sin(c*3.234+t*4.345)*0.1 + sin(c*0.589+t*0.934)*0.5;
}
float displaceB(float c, float t) {
  return sin(c*1.345)*0.3 + sin(c*2.734+t*3.345)*0.2 + sin(c*0.189+t*0.934)*0.3;
}
vec2 rotate2D(vec2 p, float a) {
  return vec2(p.x*cos(a)-p.y*sin(a), p.x*sin(a)+p.y*cos(a));
}

void main() {
  vec2 coords = gl_FragCoord.xy / uResolution.xy * 2.0 - 1.0;
  coords = rotate2D(coords, uRotation);

  float halfT = uTime * uSpeed * 0.5;
  float fullT = uTime * uSpeed;

  float warpAx = coords.x + displaceA(coords.y, halfT) * uWarpIntensity;
  float warpAy = coords.y - displaceA(coords.x * cos(fullT) * 1.235, halfT) * uWarpIntensity;
  float warpBx = coords.x + displaceB(coords.y, halfT) * uWarpIntensity;
  float warpBy = coords.y - displaceB(coords.x * sin(fullT) * 1.235, halfT) * uWarpIntensity;

  vec2 fieldA  = vec2(warpAx, warpAy);
  vec2 fieldB  = vec2(warpBx, warpBy);
  vec2 blended = mix(fieldA, fieldB, 0.5);

  float fadeTop    = smoothstep(uEdgeFadeWidth, uEdgeFadeWidth + 0.4, blended.y);
  float fadeBottom = smoothstep(-uEdgeFadeWidth, -(uEdgeFadeWidth+0.4), blended.y);
  float vMask      = 1.0 - max(fadeTop, fadeBottom);

  float tileCount = mix(uOuterLines, uInnerLines, vMask);
  float scaledY   = blended.y * tileCount;
  float nY        = smoothNoise(abs(scaledY));

  float ridge = pow(
    step(abs(nY - blended.x) * 2.0, HALF_PI) * cos(2.0 * (nY - blended.x)), 5.0);

  float lines = 0.0;
  for (float i = 1.0; i < 3.0; i += 1.0)
    lines += pow(max(fract(scaledY), fract(-scaledY)), i * 2.0);

  float pattern = vMask * lines;
  float cycleT  = fullT * uColorCycleSpeed;

  float rC = (pattern + lines*ridge) * (cos(blended.y + cycleT*0.234)*0.5+1.0);
  float gC = (pattern + vMask*ridge)  * (sin(blended.x + cycleT*1.745)*0.5+1.0);
  float bC = (pattern + lines*ridge) * (cos(blended.x + cycleT*0.534)*0.5+1.0);

  vec3  col   = (rC*uColor1 + gC*uColor2 + bC*uColor3) * uBrightness;
  float alpha = clamp(length(col), 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;

export const LineWavesBg: React.FC<DimensionProps> = ({ frame, fps, palette, config }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef     = useRef<GLSetup | null>(null);

  useEffect(() => {
    const setup = initGL(canvasRef.current!, FULLSCREEN_VERT, FRAG, config.width, config.height);
    glRef.current = setup;
    return () => { glRef.current?.gl.getExtension('WEBGL_lose_context')?.loseContext(); };
  }, []); // eslint-disable-line

  useEffect(() => {
    const s = glRef.current;
    if (!s) return;
    const { gl, u } = s;

    const t             = frame / fps;
    const [c1r,c1g,c1b] = hexToVec3(palette.accent);
    const [c2r,c2g,c2b] = hexToVec3(palette.accent2);
    const [c3r,c3g,c3b] = hexToVec3(palette.text);
    const [br, bg_, bb] = hexToVec3(palette.bg);
    const rotRad        = (-45 * Math.PI) / 180;

    gl.uniform1f(u('uTime'),           t);
    gl.uniform3f(u('uResolution'),     config.width, config.height, config.width/config.height);
    gl.uniform1f(u('uSpeed'),          0.3);
    gl.uniform1f(u('uInnerLines'),     32.0);
    gl.uniform1f(u('uOuterLines'),     36.0);
    gl.uniform1f(u('uWarpIntensity'),  1.2);
    gl.uniform1f(u('uRotation'),       rotRad);
    gl.uniform1f(u('uEdgeFadeWidth'),  0.0);
    gl.uniform1f(u('uColorCycleSpeed'),1.0);
    gl.uniform1f(u('uBrightness'),     0.2);
    gl.uniform3f(u('uColor1'), c1r, c1g, c1b);
    gl.uniform3f(u('uColor2'), c2r, c2g, c2b);
    gl.uniform3f(u('uColor3'), c3r, c3g, c3b);
    gl.uniform2f(u('uMouse'),          0.5, 0.5);

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
