import React, { useRef, useEffect } from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';
import { initGL, FULLSCREEN_VERT, hexToVec3, type GLSetup } from '../../utils/webgl';

// Faithful Remotion port of reactbits.dev Aurora.
// OGL WebGL 300 es → WebGL 1 GLSL. Alpha composited over palette.bg.
// Source: github.com/DavidHDev/react-bits — Backgrounds/Aurora/Aurora.jsx

const FRAG = `
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3  uColorStops[3];
uniform vec2  uResolution;
uniform float uBlend;
uniform vec3  uBgColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,  0.366025403784439,
    -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(
    permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0)
  );
  vec3 m = max(
    0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)),
    0.0
  );
  m = m * m;
  m = m * m;
  vec3 x  = 2.0 * fract(p * C.www) - 1.0;
  vec3 h  = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  // 3-stop colour ramp along X (WebGL-1-safe — no dynamic array indexing)
  vec3 rampColor;
  if (uv.x < 0.5) {
    rampColor = mix(uColorStops[0], uColorStops[1], uv.x * 2.0);
  } else {
    rampColor = mix(uColorStops[1], uColorStops[2], (uv.x - 0.5) * 2.0);
  }

  float height     = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height           = exp(height);
  height           = (uv.y * 2.0 - height + 0.2);
  float intensity  = 0.6 * height;
  float midPoint   = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);
  vec3  auroraColor = intensity * rampColor;

  // Composite aurora over solid background
  vec3 finalColor = mix(uBgColor, auroraColor, clamp(auroraAlpha, 0.0, 1.0));
  gl_FragColor = vec4(finalColor, 1.0);
}
`;

export const AuroraBg: React.FC<DimensionProps> = ({ frame, fps, palette, config }) => {
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

    const t = frame / fps;
    const [c0r, c0g, c0b] = hexToVec3(palette.accent);
    const [c1r, c1g, c1b] = hexToVec3(palette.accent2);
    const [c2r, c2g, c2b] = hexToVec3(palette.accent);
    const [br,  bg_, bb ] = hexToVec3(palette.bg);

    const bp = config.params?.bg ?? {};
    gl.uniform1f(u('uTime'),        t);
    gl.uniform1f(u('uAmplitude'),   bp.amplitude ?? 1.0);
    gl.uniform1f(u('uBlend'),       bp.blend ?? 0.5);
    gl.uniform2f(u('uResolution'),  config.width, config.height);
    gl.uniform3fv(u('uColorStops'), new Float32Array([c0r,c0g,c0b, c1r,c1g,c1b, c2r,c2g,c2b]));
    gl.uniform3f(u('uBgColor'),     br, bg_, bb);

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
