import React, { useRef, useEffect } from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';
import { initGL, FULLSCREEN_VERT, type GLSetup } from '../../utils/webgl';

// Remotion port of "Neno Shader" (neno-shader.tsx) — Gaming vibe rings.
// Original used Three.js + requestAnimationFrame.
// Ported to raw WebGL 1 via initGL; time driven by frame/fps.

const FRAG = `
precision highp float;

uniform vec2  resolution;
uniform float time;

mat2 rotate2d(float angle) {
  return mat2(cos(angle), -sin(angle),
              sin(angle),  cos(angle));
}

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main(void) {
  vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
  float t = time * 0.1;

  // Warp and breathe
  uv += vec2(sin(uv.y * 4.0 + t * 2.0), cos(uv.x * 4.0 + t * 2.0)) * 0.1;
  uv  = rotate2d(t * 0.25) * uv;

  float intensity = 0.0;
  float lineWidth = 0.02;

  for (int i = 0; i < 7; i++) {
    float fi   = float(i);
    float wave = sin(t * 2.0 + fi * 0.5) * 0.5 + 0.5;
    intensity += lineWidth / abs(wave - length(uv) + sin(uv.x + uv.y) * 0.1);
  }

  vec3 color1   = vec3(0.0, 0.5, 1.0);   // Electric Blue
  vec3 color2   = vec3(1.0, 0.2, 0.5);   // Magenta/Pink
  vec3 baseColor = mix(color1, color2, sin(length(uv) * 2.0 - t) * 0.5 + 0.5);

  vec3 finalColor = baseColor * intensity;
  finalColor += (random(uv + t) - 0.5) * 0.08;

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

export const NenoShaderBg: React.FC<DimensionProps> = ({ frame, fps, config }) => {
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

    gl.uniform1f(u('time'),       frame / fps);
    gl.uniform2f(u('resolution'), config.width, config.height);

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
