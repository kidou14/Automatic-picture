/**
 * Minimal raw-WebGL bootstrap for fullscreen-shader backgrounds.
 * Replaces OGL / React Three Fiber while keeping the same GLSL shaders.
 * Works in both Remotion live preview (Player) and headless renderStill.
 */

// Standard fullscreen-triangle vertex shader (matches OGL's Triangle geometry).
// Vertices: [-1,-1], [3,-1], [-1,3] — covers entire clip space with one triangle.
export const FULLSCREEN_VERT = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export interface GLSetup {
  gl:      WebGLRenderingContext;
  program: WebGLProgram;
  u:       (name: string) => WebGLUniformLocation | null;
}

export function initGL(
  canvas:  HTMLCanvasElement,
  vertSrc: string,
  fragSrc: string,
  width:   number,
  height:  number,
): GLSetup | null {
  const gl = (canvas.getContext('webgl') ??
              canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
  if (!gl) return null;

  canvas.width  = width;
  canvas.height = height;
  gl.viewport(0, 0, width, height);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function compile(type: number, src: string): WebGLShader {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.error('[GL shader]', gl.getShaderInfoLog(s));
    return s;
  }

  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER,   vertSrc));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('[GL link]', gl.getProgramInfoLog(prog));
    return null;
  }
  gl.useProgram(prog);

  // Upload fullscreen-triangle geometry
  function attrib(name: string, data: Float32Array, size: number) {
    const loc = gl.getAttribLocation(prog, name);
    if (loc < 0) return;
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }

  attrib('position', new Float32Array([-1, -1, 3, -1, -1, 3]),       2);
  attrib('uv',       new Float32Array([ 0,  0, 2,  0,  0, 2]),       2);

  return { gl, program: prog, u: (n) => gl.getUniformLocation(prog, n) };
}

// ── Colour helpers ────────────────────────────────────────────────────────────

export function hexToVec3(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToVec3(hex).map(v => Math.round(v * 255));
  return `rgba(${r},${g},${b},${alpha})`;
}
