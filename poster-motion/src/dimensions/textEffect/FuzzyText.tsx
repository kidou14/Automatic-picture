import React, { useRef, useEffect } from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';

// Faithful Remotion port of reactbits.dev FuzzyText.
// Canvas-based: each row is drawn with a random horizontal offset.
// Randomness is driven by a frame-seeded xorshift32 PRNG → fully deterministic.
// Defaults: baseIntensity=0.18, fuzzRange=30 (same as reactbits).

const xorshift32 = (n: number): number => {
  n = Math.imul(n ^ (n >>> 15), 1 | n);
  n = Math.imul(n ^ (n >>> 7), 61 | n) ^ n;
  return (n ^ (n >>> 14)) >>> 0;
};
const rand01 = (seed: number): number => xorshift32(seed) / 0xFFFFFFFF;

const FONT_SIZE   = 88;
const FONT_WEIGHT = 800;
const FONT_FAMILY = 'system-ui, -apple-system, sans-serif';
const FUZZ_RANGE  = 30;
const INTENSITY   = 0.18;

export const FuzzyText: React.FC<DimensionProps> = ({ frame, palette, config }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isTop = config.dimensions.layout === 'titleTop';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fontStr = `${FONT_WEIGHT} ${FONT_SIZE}px ${FONT_FAMILY}`;
    const text    = config.title;

    // ── Render text to offscreen canvas ───────────────────────────────────────
    const off    = document.createElement('canvas');
    const offCtx = off.getContext('2d')!;
    offCtx.font         = fontStr;
    offCtx.textBaseline = 'alphabetic';
    const m       = offCtx.measureText(text);
    const ascent  = m.actualBoundingBoxAscent  ?? FONT_SIZE;
    const descent = m.actualBoundingBoxDescent ?? FONT_SIZE * 0.2;
    const tW      = Math.ceil(m.width) + 20;   // 10px padding each side
    const tH      = Math.ceil(ascent + descent);

    off.width  = tW;
    off.height = tH;
    offCtx.font         = fontStr;
    offCtx.textBaseline = 'alphabetic';
    offCtx.fillStyle    = palette.text;
    offCtx.fillText(text, 10, ascent);

    // ── Resize main canvas, translate origin past margin ──────────────────────
    const margin   = FUZZ_RANGE + 20;
    canvas.width   = tW + margin * 2;
    canvas.height  = tH;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(margin, 0);

    // ── Per-row fuzz with deterministic seed = f(frame, row) ──────────────────
    for (let j = 0; j < tH; j++) {
      const seed = xorshift32(frame * 100003 + j + 1);
      const dx   = Math.floor(INTENSITY * (rand01(seed) - 0.5) * FUZZ_RANGE);
      ctx.drawImage(off, 0, j, tW, 1, dx, j, tW, 1);
    }

    ctx.restore();
  }, [frame, palette.text, config.title]);

  const areaH   = Math.round(config.height * 0.22);
  const areaTop = isTop ? 0 : config.height - areaH;

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', left: 0, right: 0,
        top: areaTop, height: areaH,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <canvas ref={canvasRef} />
      </div>
    </AbsoluteFill>
  );
};
