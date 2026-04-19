import React, { useRef, useEffect } from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';
import { initGL, FULLSCREEN_VERT, type GLSetup } from '../../utils/webgl';

// Remotion port of "Shader Lines" (shader-lines.tsx).
// Original used Three.js CDN + requestAnimationFrame.
// Ported to raw WebGL 1 via initGL; time driven by frame/fps.

const FRAG = `
precision highp float;

uniform vec2  resolution;
uniform float time;

float random(in float x) {
  return fract(sin(x) * 1e4);
}

void main(void) {
  vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);

  vec2 fMosaicScal = vec2(4.0, 2.0);
  vec2 vScreenSize = vec2(256.0, 256.0);
  uv.x = floor(uv.x * vScreenSize.x / fMosaicScal.x) / (vScreenSize.x / fMosaicScal.x);
  uv.y = floor(uv.y * vScreenSize.y / fMosaicScal.y) / (vScreenSize.y / fMosaicScal.y);

  float t         = time * 0.06 + random(uv.x) * 0.4;
  float lineWidth = 0.0008;

  vec3 color = vec3(0.0);
  for (int j = 0; j < 3; j++) {
    for (int i = 0; i < 5; i++) {
      color[j] += lineWidth * float(i * i)
                  / abs(fract(t - 0.01 * float(j) + float(i) * 0.01) - length(uv));
    }
  }

  gl_FragColor = vec4(color[2], color[1], color[0], 1.0);
}
`;

export const ShaderLinesBg: React.FC<DimensionProps> = ({ frame, fps, config }) => {
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
