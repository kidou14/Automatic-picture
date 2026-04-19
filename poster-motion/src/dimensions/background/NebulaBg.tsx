import React, { useRef, useEffect } from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';
import { initGL, FULLSCREEN_VERT, type GLSetup } from '../../utils/webgl';

// Remotion port of the "AnoAI" nebula shader (animated-shader-background).
// Original Three.js version → raw WebGL 1 via initGL utility.
// Drives iTime from frame/fps instead of requestAnimationFrame.

const FRAG = `
precision mediump float;

uniform float iTime;
uniform vec2  iResolution;

#define NUM_OCTAVES 3

// tanh is not a WebGL 1 built-in — implement manually
vec4 tanh4(vec4 x) {
  vec4 e2 = exp(clamp(2.0 * x, -40.0, 40.0));
  return (e2 - 1.0) / (e2 + 1.0);
}

float rand(vec2 n) {
  return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 ip = floor(p);
  vec2 u  = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  float res = mix(
    mix(rand(ip),                   rand(ip + vec2(1.0, 0.0)), u.x),
    mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x),
    u.y
  );
  return res * res;
}

float fbm(vec2 x) {
  float v = 0.0;
  float a = 0.3;
  vec2  shift = vec2(100.0);
  mat2  rot   = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < NUM_OCTAVES; ++i) {
    v += a * noise(x);
    x  = rot * x * 2.0 + shift;
    a *= 0.4;
  }
  return v;
}

void main() {
  vec2 shake = vec2(sin(iTime * 1.2) * 0.005, cos(iTime * 2.1) * 0.005);
  vec2 p = ((gl_FragCoord.xy + shake * iResolution.xy) - iResolution.xy * 0.5)
           / iResolution.y * mat2(6.0, -4.0, 4.0, 6.0);
  vec2 v;
  vec4 o = vec4(0.0);

  float f = 2.0 + fbm(p + vec2(iTime * 5.0, 0.0)) * 0.5;

  // WebGL 1: use int loop counter, cast to float inside
  for (int ii = 0; ii < 35; ii++) {
    float i = float(ii);

    v = p + cos(i * i + (iTime + p.x * 0.08) * 0.025 + i * vec2(13.0, 11.0)) * 3.5
          + vec2(sin(iTime * 3.0 + i) * 0.003, cos(iTime * 3.5 - i) * 0.003);

    float tailNoise = fbm(v + vec2(iTime * 0.5, i)) * 0.3 * (1.0 - (i / 35.0));

    vec4 auroraColors = vec4(
      0.1 + 0.3 * sin(i * 0.2 + iTime * 0.4),
      0.3 + 0.5 * cos(i * 0.3 + iTime * 0.5),
      0.7 + 0.3 * sin(i * 0.4 + iTime * 0.3),
      1.0
    );

    vec4 contrib   = auroraColors * exp(sin(i * i + iTime * 0.8))
                     / length(max(v, vec2(v.x * f * 0.015, v.y * 1.5)));
    float thinness = smoothstep(0.0, 1.0, i / 35.0) * 0.6;
    o += contrib * (1.0 + tailNoise * 0.8) * thinness;
  }

  o = tanh4(pow(max(o / 100.0, vec4(0.0)), vec4(1.6)));
  gl_FragColor = o * 1.5;
}
`;

export const NebulaBg: React.FC<DimensionProps> = ({ frame, fps, config }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef     = useRef<GLSetup | null>(null);

  useEffect(() => {
    const setup = initGL(canvasRef.current!, FULLSCREEN_VERT, FRAG, config.width, config.height);
    glRef.current = setup;
    return () => {
      glRef.current?.gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    const s = glRef.current;
    if (!s) return;
    const { gl, u } = s;

    gl.uniform1f(u('iTime'),       frame / fps);
    gl.uniform2f(u('iResolution'), config.width, config.height);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }, [frame, fps, config.width, config.height]);

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </AbsoluteFill>
  );
};
