import React, { useRef, useEffect } from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';
import { initGL, FULLSCREEN_VERT, hexToVec3, type GLSetup } from '../../utils/webgl';

// Faithful Remotion port of reactbits.dev Silk.
// Fragment shader is verbatim; bg→accent colour blending added via uBgColor uniform.

const FRAG = `
precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec3  uColor;
uniform vec3  uBgColor;
uniform float uSpeed;
uniform float uScale;
uniform float uNoiseIntensity;

const float e = 2.71828182845904523536;

float noise(vec2 tc) {
  float G = e;
  vec2  r = G * sin(G * tc);
  return fract(r.x * r.y * (1.0 + tc.x));
}

void main() {
  float rnd     = noise(gl_FragCoord.xy);
  vec2  tex     = vUv * uScale;
  float tOffset = uSpeed * uTime;

  tex.y += 0.03 * sin(8.0 * tex.x - tOffset);

  float pattern = 0.6 + 0.4 * sin(
    5.0 * (tex.x + tex.y + cos(3.0 * tex.x + 5.0 * tex.y) + 0.02 * tOffset) +
    sin(20.0 * (tex.x + tex.y - 0.1 * tOffset))
  );

  vec3  col = mix(uBgColor, uColor, pattern) - rnd / 15.0 * uNoiseIntensity;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const SilkBg: React.FC<DimensionProps> = ({ frame, fps, palette, config }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef     = useRef<GLSetup | null>(null);

  // Init once
  useEffect(() => {
    const setup = initGL(canvasRef.current!, FULLSCREEN_VERT, FRAG, config.width, config.height);
    glRef.current = setup;
    return () => { glRef.current?.gl.getExtension('WEBGL_lose_context')?.loseContext(); };
  }, []); // eslint-disable-line

  // Render each frame
  useEffect(() => {
    const s = glRef.current;
    if (!s) return;
    const { gl, u } = s;

    // Original Silk increments uTime by 0.1*delta (seconds), so uTime = elapsed*0.1
    const t = (frame / fps) * 0.1;
    const [cr, cg, cb] = hexToVec3(palette.accent);
    const [br, bg, bb] = hexToVec3(palette.bg);

    const bp = config.params?.bg ?? {};
    gl.uniform1f(u('uTime'),          t);
    gl.uniform1f(u('uSpeed'),         bp.speed ?? 5.0);
    gl.uniform1f(u('uScale'),         bp.scale ?? 1.0);
    gl.uniform1f(u('uNoiseIntensity'),bp.noiseIntensity ?? 1.5);
    gl.uniform3f(u('uColor'),  cr, cg, cb);
    gl.uniform3f(u('uBgColor'),br, bg, bb);

    gl.clearColor(br, bg, bb, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }, [frame, fps, palette, config.params]);

  return (
    <AbsoluteFill>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </AbsoluteFill>
  );
};
