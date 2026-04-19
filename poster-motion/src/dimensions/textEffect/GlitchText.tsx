import React from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';
import { MARGIN_V, TEXT_H } from '../../layout';

// Faithful Remotion port of reactbits.dev GlitchText.
// Three-layer approach: main text + red shadow ghost + cyan shadow ghost.
// Ghost layers are clipped to randomised horizontal strips via clip-path: polygon().
// Active for ~20% of frames (6 out of every 30) — matches speed=1 tempo.
// All randomness is frame-seeded (LCG) → fully deterministic.

const lcg = (s: number): number =>
  ((Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967295;

const polygonStrip = (top: number, h: number): string => {
  const t = top.toFixed(1);
  const b = Math.min(top + h, 100).toFixed(1);
  return `polygon(0% ${t}%, 100% ${t}%, 100% ${b}%, 0% ${b}%)`;
};

export const GlitchText: React.FC<DimensionProps> = ({ frame, palette, config }) => {
  const isTop = config.dimensions.layout === 'titleTop';
  const areaH = Math.round(config.height * TEXT_H);
  const posStyle: React.CSSProperties = isTop
    ? { top: Math.round(config.height * MARGIN_V), height: areaH }
    : { bottom: Math.round(config.height * MARGIN_V), height: areaH };

  // Glitch active for 6 frames out of every 30 (~speed=1 CSS animation tempo)
  const isGlitching = (frame % 30) < 6;

  // Ghost strip positions change every 2 frames for rapid flicker
  const seed = Math.floor(frame / 2);
  const strip1 = polygonStrip(lcg(seed * 11)      * 80, lcg(seed * 11 + 3) * 15 + 5);
  const strip2 = polygonStrip(lcg(seed * 17)      * 80, lcg(seed * 17 + 5) * 15 + 5);

  const tp            = config.params?.text ?? {};
  const fontSize      = tp.fontSize ?? 88;
  const letterSpacing = tp.letterSpacing !== undefined ? `${tp.letterSpacing}em` : '-0.02em';

  const baseStyle: React.CSSProperties = {
    margin:        0,
    textAlign:     'center',
    fontSize,
    fontWeight:    800,
    lineHeight:    1.15,
    letterSpacing,
    fontFamily:    'system-ui, -apple-system, sans-serif',
    color:         palette.text,
    width:         '100%',
  };

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', left: 80, right: 80, ...posStyle,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ position: 'relative', width: '100%', textAlign: 'center' }}>

          {/* Main layer — always visible */}
          <h1 style={baseStyle}>{config.title}</h1>

          {/* Red ghost — --after-shadow: '-5px 0 red' */}
          {isGlitching && (
            <h1 style={{
              ...baseStyle,
              position:   'absolute',
              inset:      0,
              textShadow: '-5px 0 red',
              clipPath:   strip1,
            }}>
              {config.title}
            </h1>
          )}

          {/* Cyan ghost — --before-shadow: '5px 0 cyan' */}
          {isGlitching && (
            <h1 style={{
              ...baseStyle,
              position:   'absolute',
              inset:      0,
              textShadow: '5px 0 cyan',
              clipPath:   strip2,
            }}>
              {config.title}
            </h1>
          )}

        </div>
      </div>
    </AbsoluteFill>
  );
};
