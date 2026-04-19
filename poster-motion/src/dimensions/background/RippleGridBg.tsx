import React, { useRef, useEffect } from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';
import { hexToVec3, type GLSetup } from '../../utils/webgl';

// Faithful Remotion port of reactbits.dev RippleGrid.
// Uses its own vertex shader (derives vUv from position, not uv attribute).

const VERT = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

uniform float iTime;
uniform vec2  iResolution;
uniform vec3  gridColor;
uniform float rippleIntensity;
uniform float gridSize;
uniform float gridThickness;
uniform float fadeDistance;
uniform float vignetteStrength;
uniform float glowIntensity;
uniform float opacity;
varying vec2  vUv;

float pi = 3.141592;

void main() {
  vec2  uv   = vUv * 2.0 - 1.0;
  uv.x      *= iResolution.x / iResolution.y;
  float dist = length(uv);
  float func = sin(pi * (iTime - dist));
  vec2  rUv  = uv + uv * func * rippleIntensity;

  vec2 a = sin(gridSize * 0.5 * pi * rUv - pi / 2.0);
  vec2 b = abs(a);

  float aaW = 0.5;
  vec2 sB = vec2(smoothstep(0.0, aaW, b.x), smoothstep(0.0, aaW, b.y));

  vec3 color = vec3(0.0);
  color += exp(-gridThickness * sB.x * (0.8 + 0.5 * sin(pi * iTime)));
  color += exp(-gridThickness * sB.y);
  color += 0.5 * exp(-(gridThickness / 4.0) * sin(sB.x));
  color += 0.5 * exp(-(gridThickness / 3.0) * sB.y);
  if (glowIntensity > 0.0) {
    color += glowIntensity * exp(-gridThickness * 0.5 * sB.x);
    color += glowIntensity * exp(-gridThickness * 0.5 * sB.y);
  }

  float ddd      = exp(-2.0 * clamp(pow(dist, fadeDistance), 0.0, 1.0));
  float vignDist = length(vUv - 0.5);
  float vign     = clamp(1.0 - pow(vignDist * 2.0, vignetteStrength), 0.0, 1.0);

  float finalFade = ddd * vign;
  float alpha     = length(color) * finalFade * opacity;
  gl_FragColor    = vec4(color * gridColor * finalFade * opacity, alpha);
}
`;

function initRippleGL(canvas: HTMLCanvasElement, w: number, h: number): GLSetup | null {
  const gl = (canvas.getContext('webgl') ??
              canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
  if (!gl) return null;
  canvas.width  = w;
  canvas.height = h;
  gl.viewport(0, 0, w, h);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function compile(type: number, src: string) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.error('[RippleGrid]', gl.getShaderInfoLog(s));
    return s;
  }
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER,   VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'position');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  return { gl, program: prog, u: (n) => gl.getUniformLocation(prog, n) };
}

export const RippleGridBg: React.FC<DimensionProps> = ({ frame, fps, palette, config }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef     = useRef<GLSetup | null>(null);

  useEffect(() => {
    glRef.current = initRippleGL(canvasRef.current!, config.width, config.height);
    return () => { glRef.current?.gl.getExtension('WEBGL_lose_context')?.loseContext(); };
  }, []); // eslint-disable-line

  useEffect(() => {
    const s = glRef.current;
    if (!s) return;
    const { gl, u } = s;

    const t         = frame / fps;
    const [cr,cg,cb]  = hexToVec3(palette.accent);
    const [br,bg_,bb] = hexToVec3(palette.bg);

    const bp = config.params?.bg ?? {};
    gl.uniform1f(u('iTime'),           t);
    gl.uniform2f(u('iResolution'),     config.width, config.height);
    gl.uniform3f(u('gridColor'),       cr, cg, cb);
    gl.uniform1f(u('rippleIntensity'), bp.rippleIntensity ?? 0.06);
    gl.uniform1f(u('gridSize'),        bp.gridSize ?? 10.0);
    gl.uniform1f(u('gridThickness'),   bp.gridThickness ?? 12.0);
    gl.uniform1f(u('fadeDistance'),    1.5);
    gl.uniform1f(u('vignetteStrength'),2.0);
    gl.uniform1f(u('glowIntensity'),   0.12);
    gl.uniform1f(u('opacity'),         1.0);

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
