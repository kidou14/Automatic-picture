import React, { useRef, useEffect } from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';
import { hexToRgba } from '../../utils/webgl';

// Faithful Remotion port of reactbits.dev DotField.
// Canvas 2D grid of dots animated by a continuous sine-wave ripple (waveAmplitude).
// Mouse interaction replaced by automatic wave — always visually active.

interface Dot { ax: number; ay: number }

export const DotFieldBg: React.FC<DimensionProps> = ({ frame, fps, palette, config }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef   = useRef<Dot[]>([]);

  const W = config.width;
  const H = config.height;

  // Build dot grid once (or when canvas dimensions change)
  useEffect(() => {
    const DOT_RADIUS  = 2.5;
    const DOT_SPACING = 18;
    const step = DOT_RADIUS + DOT_SPACING;
    const cols = Math.floor(W / step);
    const rows = Math.floor(H / step);
    const padX = (W % step) / 2;
    const padY = (H % step) / 2;
    const dots: Dot[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        dots.push({
          ax: padX + c * step + step / 2,
          ay: padY + r * step + step / 2,
        });
      }
    }
    dotsRef.current = dots;
  }, [W, H]);

  // Render this frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dotsRef.current.length === 0) return;
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, W, H);

    // Dot gradient (accent → accent2 diagonal)
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, hexToRgba(palette.accent,  0.55));
    grad.addColorStop(1, hexToRgba(palette.accent2, 0.40));
    ctx.fillStyle = grad;

    const DOT_RADIUS   = 2.5;
    const WAVE_AMP     = 9;           // px ripple amplitude
    const t            = frame * 0.02; // matches original frameCount * 0.02

    ctx.beginPath();
    for (const d of dotsRef.current) {
      const drawX = d.ax + Math.cos(d.ay * 0.03 + t * 0.7) * WAVE_AMP * 0.5;
      const drawY = d.ay + Math.sin(d.ax * 0.03 + t)       * WAVE_AMP;
      ctx.moveTo(drawX + DOT_RADIUS, drawY);
      ctx.arc(drawX, drawY, DOT_RADIUS, 0, Math.PI * 2);
    }
    ctx.fill();
  }, [frame, fps, palette, W, H]);

  return (
    <AbsoluteFill>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </AbsoluteFill>
  );
};
