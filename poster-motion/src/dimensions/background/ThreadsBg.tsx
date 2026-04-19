import React, { useRef, useEffect } from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';
import { initGL, FULLSCREEN_VERT, hexToVec3, type GLSetup } from '../../utils/webgl';

// Faithful Remotion port of reactbits.dev Threads.
// GLSL fragment shader is verbatim from reactbits.
// Mouse interaction omitted (uMouse fixed at [0.5, 0.5]).

const FRAG = `
precision highp float;

uniform float iTime;
uniform vec3  iResolution;
uniform vec3  uColor;
uniform float uAmplitude;
uniform float uDistance;
uniform vec2  uMouse;

#define PI 3.1415926538

const int u_line_count = 40;
const float u_line_width = 7.0;
const float u_line_blur  = 10.0;

float Perlin2D(vec2 P) {
  vec2 Pi      = floor(P);
  vec4 Pf      = P.xyxy - vec4(Pi, Pi + 1.0);
  vec4 Pt      = vec4(Pi.xy, Pi.xy + 1.0);
  Pt           = Pt - floor(Pt * (1.0/71.0)) * 71.0;
  Pt          += vec2(26.0, 161.0).xyxy;
  Pt          *= Pt;
  Pt           = Pt.xzxz * Pt.yyww;
  vec4 hx      = fract(Pt * (1.0/951.135664));
  vec4 hy      = fract(Pt * (1.0/642.949883));
  vec4 gx      = hx - 0.49999;
  vec4 gy      = hy - 0.49999;
  vec4 gr      = inversesqrt(gx*gx + gy*gy) * (gx * Pf.xzxz + gy * Pf.yyww);
  gr          *= 1.4142135623730950;
  vec2 blend   = Pf.xy*Pf.xy*Pf.xy*(Pf.xy*(Pf.xy*6.0-15.0)+10.0);
  vec4 blend2  = vec4(blend, vec2(1.0-blend));
  return dot(gr, blend2.zxzx * blend2.wwyy);
}

float pixel(float count, vec2 res) { return (1.0/max(res.x, res.y)) * count; }

float lineFn(vec2 st, float width, float perc, float offset, vec2 mouse,
             float time, float amplitude, float distance) {
  float split_offset    = perc * 0.4;
  float split_point     = 0.1 + split_offset;
  float amp_normal      = smoothstep(split_point, 0.7, st.x);
  float finalAmplitude  = amp_normal * 0.5 * amplitude * (1.0 + (mouse.y - 0.5) * 0.2);
  float time_scaled     = time / 10.0 + (mouse.x - 0.5) * 1.0;
  float blur            = smoothstep(split_point, split_point + 0.05, st.x) * perc;
  float xnoise = mix(
    Perlin2D(vec2(time_scaled, st.x + perc) * 2.5),
    Perlin2D(vec2(time_scaled, st.x + time_scaled) * 3.5) / 1.5,
    st.x * 0.3
  );
  float y          = 0.5 + (perc - 0.5) * distance + xnoise / 2.0 * finalAmplitude;
  float line_start = smoothstep(y+(width/2.0)+(u_line_blur*pixel(1.0,iResolution.xy)*blur), y, st.y);
  float line_end   = smoothstep(y, y-(width/2.0)-(u_line_blur*pixel(1.0,iResolution.xy)*blur), st.y);
  return clamp((line_start - line_end) * (1.0 - smoothstep(0.0, 1.0, pow(perc, 0.3))), 0.0, 1.0);
}

void main() {
  vec2  uv           = gl_FragCoord.xy / iResolution.xy;
  float line_strength = 1.0;
  for (int i = 0; i < u_line_count; i++) {
    float p = float(i) / float(u_line_count);
    line_strength *= (1.0 - lineFn(uv, u_line_width * pixel(1.0, iResolution.xy) * (1.0 - p),
                                   p, PI * p, uMouse, iTime, uAmplitude, uDistance));
  }
  float cv      = 1.0 - line_strength;
  gl_FragColor  = vec4(uColor * cv, cv);
}
`;

export const ThreadsBg: React.FC<DimensionProps> = ({ frame, fps, palette, config }) => {
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

    const t         = frame / fps;
    const [r, g, b] = hexToVec3(palette.text);
    const [br,bg_,bb] = hexToVec3(palette.bg);

    const bp = config.params?.bg ?? {};
    gl.uniform1f(u('iTime'),       t);
    gl.uniform3f(u('iResolution'), config.width, config.height, config.width / config.height);
    gl.uniform3f(u('uColor'),      r, g, b);
    gl.uniform1f(u('uAmplitude'),  bp.amplitude ?? 1.4);
    gl.uniform1f(u('uDistance'),   bp.distance ?? 0.35);
    gl.uniform2f(u('uMouse'),      0.5, 0.5);

    gl.clearColor(br, bg_, bb, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }, [frame, fps, palette, config.width, config.height, config.params]);

  return (
    <AbsoluteFill>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </AbsoluteFill>
  );
};
