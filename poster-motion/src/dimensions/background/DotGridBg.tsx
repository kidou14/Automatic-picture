import React, { useRef, useEffect } from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';
import { hexToVec3 } from '../../utils/webgl';

// Faithful Remotion port of reactbits.dev DotGrid.
// GSAP InertiaPlugin interaction replaced by a continuously orbiting virtual hotspot
// that creates the same proximity-based colour shift across the grid.

interface Dot { cx: number; cy: number }

export const DotGridBg: React.FC<DimensionProps> = ({ frame, fps, palette, config }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef   = useRef<Dot[]>([]);

  const W = config.width;
  const H = config.height;

  useEffect(() => {
    const DOT_SIZE = 10;
    const GAP      = 22;
    const cell     = DOT_SIZE + GAP;
    const cols     = Math.floor((W + GAP) / cell);
    const rows     = Math.floor((H + GAP) / cell);
    const startX   = (W - (cols * cell - GAP)) / 2 + DOT_SIZE / 2;
    const startY   = (H - (rows * cell - GAP)) / 2 + DOT_SIZE / 2;
    const dots: Dot[] = [];
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        dots.push({ cx: startX + x * cell, cy: startY + y * cell });
    dotsRef.current = dots;
  }, [W, H]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dotsRef.current.length === 0) return;
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, W, H);

    const bp         = config.params?.bg ?? {};
    const DOT_RADIUS = bp.dotRadius ?? 5;
    const PROXIMITY  = bp.proximity ?? 220;
    const proxSq     = PROXIMITY * PROXIMITY;

    // Virtual hotspot: slow elliptical orbit across the canvas
    const t   = frame / fps;
    const hx  = W / 2 + Math.cos(t * 0.4) * W * 0.28;
    const hy  = H / 2 + Math.sin(t * 0.3) * H * 0.18;

    const [br, bg, bb] = hexToVec3(palette.accent).map(v => Math.round(v * 255));
    const [ar, ag, ab] = hexToVec3(palette.accent2).map(v => Math.round(v * 255));

    for (const dot of dotsRef.current) {
      const dx  = dot.cx - hx;
      const dy  = dot.cy - hy;
      const dsq = dx * dx + dy * dy;

      let fillStyle: string;
      if (dsq <= proxSq) {
        const dist = Math.sqrt(dsq);
        const mix  = 1 - dist / PROXIMITY;        // 0…1, stronger near hotspot
        const r = Math.round(br + (ar - br) * mix);
        const g = Math.round(bg + (ag - bg) * mix);
        const b = Math.round(bb + (ab - bb) * mix);
        const a = 0.25 + mix * 0.55;
        fillStyle = `rgba(${r},${g},${b},${a})`;
      } else {
        fillStyle = `rgba(${br},${bg},${bb},0.20)`;
      }

      ctx.beginPath();
      ctx.arc(dot.cx, dot.cy, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }, [frame, fps, palette, W, H, config.params]);

  return (
    <AbsoluteFill>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </AbsoluteFill>
  );
};
