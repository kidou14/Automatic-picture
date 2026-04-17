import React, { useRef, useEffect } from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';
import { initGL, FULLSCREEN_VERT, hexToVec3, type GLSetup } from '../../utils/webgl';

// Faithful Remotion port of reactbits.dev Balatro.
// OGL WebGL → WebGL 1 GLSL. Fragment shader verbatim (bool → int for compatibility).
// Source: github.com/DavidHDev/react-bits — Backgrounds/Balatro/Balatro.jsx

const FRAG = `
precision highp float;
#define PI 3.14159265359

uniform float iTime;
uniform vec3  iResolution;
uniform float uSpinRotation;
uniform float uSpinSpeed;
uniform vec2  uOffset;
uniform vec4  uColor1;
uniform vec4  uColor2;
uniform vec4  uColor3;
uniform float uContrast;
uniform float uLighting;
uniform float uSpinAmount;
uniform float uPixelFilter;
uniform float uSpinEase;
uniform int   uIsRotate;
uniform vec2  uMouse;

varying vec2 vUv;

vec4 effect(vec2 screenSize, vec2 screen_coords) {
  float pixel_size = length(screenSize.xy) / uPixelFilter;
  vec2 uv = (floor(screen_coords.xy * (1.0 / pixel_size)) * pixel_size
             - 0.5 * screenSize.xy) / length(screenSize.xy) - uOffset;
  float uv_len = length(uv);

  float speed = (uSpinRotation * uSpinEase * 0.2);
  if (uIsRotate != 0) {
    speed = iTime * speed;
  }
  speed += 302.2;
  float mouseInfluence = (uMouse.x * 2.0 - 1.0);
  speed += mouseInfluence * 0.1;

  float new_pixel_angle = atan(uv.y, uv.x) + speed
    - uSpinEase * 20.0 * (uSpinAmount * uv_len + (1.0 - uSpinAmount));
  vec2 mid = (screenSize.xy / length(screenSize.xy)) / 2.0;
  uv = (vec2(uv_len * cos(new_pixel_angle) + mid.x,
             uv_len * sin(new_pixel_angle) + mid.y) - mid);
  uv *= 30.0;

  float baseSpeed = iTime * uSpinSpeed;
  float speed2    = baseSpeed + mouseInfluence * 2.0;
  vec2  uv2       = vec2(uv.x + uv.y);

  for (int i = 0; i < 5; i++) {
    uv2 += sin(max(uv.x, uv.y)) + uv;
    uv  += 0.5 * vec2(
      cos(5.1123314 + 0.353 * uv2.y + speed2 * 0.131121),
      sin(uv2.x - 0.113 * speed2)
    );
    uv -= cos(uv.x + uv.y) - sin(uv.x * 0.711 - uv.y);
  }

  float contrast_mod = (0.25 * uContrast + 0.5 * uSpinAmount + 1.2);
  float paint_res    = min(2.0, max(0.0, length(uv) * 0.035 * contrast_mod));
  float c1p = max(0.0, 1.0 - contrast_mod * abs(1.0 - paint_res));
  float c2p = max(0.0, 1.0 - contrast_mod * abs(paint_res));
  float c3p = 1.0 - min(1.0, c1p + c2p);
  float light = (uLighting - 0.2) * max(c1p * 5.0 - 4.0, 0.0)
              + uLighting          * max(c2p * 5.0 - 4.0, 0.0);

  return (0.3 / uContrast) * uColor1
    + (1.0 - 0.3 / uContrast)
      * (uColor1 * c1p + uColor2 * c2p + vec4(c3p * uColor3.rgb, c3p * uColor1.a))
    + light;
}

void main() {
  vec2 pixelCoords = vUv * iResolution.xy;
  gl_FragColor = effect(iResolution.xy, pixelCoords);
}
`;

export const BalatrosBg: React.FC<DimensionProps> = ({ frame, fps, palette, config }) => {
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
    const [c1r, c1g, c1b] = hexToVec3(palette.accent);
    const [c2r, c2g, c2b] = hexToVec3(palette.accent2);
    const [c3r, c3g, c3b] = hexToVec3(palette.bg);

    gl.uniform1f(u('iTime'),          t);
    gl.uniform3f(u('iResolution'),    config.width, config.height, config.width / config.height);
    gl.uniform1f(u('uSpinRotation'),  -2.0);
    gl.uniform1f(u('uSpinSpeed'),     7.0);
    gl.uniform2f(u('uOffset'),        0.0, 0.0);
    gl.uniform4f(u('uColor1'),        c1r, c1g, c1b, 1.0);
    gl.uniform4f(u('uColor2'),        c2r, c2g, c2b, 1.0);
    gl.uniform4f(u('uColor3'),        c3r, c3g, c3b, 1.0);
    gl.uniform1f(u('uContrast'),      3.5);
    gl.uniform1f(u('uLighting'),      0.4);
    gl.uniform1f(u('uSpinAmount'),    0.25);
    gl.uniform1f(u('uPixelFilter'),   745.0);
    gl.uniform1f(u('uSpinEase'),      1.0);
    gl.uniform1i(u('uIsRotate'),      1);   // animate inner loop with iTime
    gl.uniform2f(u('uMouse'),         0.5, 0.5);

    gl.clearColor(c3r, c3g, c3b, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }, [frame, fps, palette, config.width, config.height]);

  return (
    <AbsoluteFill>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </AbsoluteFill>
  );
};
