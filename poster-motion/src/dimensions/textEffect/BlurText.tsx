import React from 'react';
import { AbsoluteFill, spring, interpolate } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';

// Faithful Remotion port of reactbits.dev BlurText.
// Each character enters from above: blur 10px→0, opacity 0→1, translateY -50→0.
// Stagger matches the original Framer Motion per-char delay pattern.

export const BlurText: React.FC<DimensionProps> = ({ frame, fps, palette, config }) => {
  const isTop = config.dimensions.layout === 'titleTop';
  const posStyle: React.CSSProperties = isTop
    ? { top: 0, height: config.height * 0.22 }
    : { bottom: 0, height: config.height * 0.22 };

  const chars = Array.from(config.title);
  // Keep the stagger tight enough that long titles resolve fully by the final frame.
  const stagger = chars.length <= 1
    ? 0
    : Math.max(1, Math.floor(42 / (chars.length - 1)));

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', left: 80, right: 80, ...posStyle,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexWrap: 'wrap',
      }}>
        {chars.map((char, i) => {
          const progress = spring({
            frame: frame - i * stagger,
            fps,
            config: { stiffness: 45, damping: 10 },
          });
          const clamped    = Math.min(1, Math.max(0, progress));
          const opacity    = clamped;
          const translateY = (1 - clamped) * -50;             // drop in from above
          const blur       = interpolate(clamped, [0, 1], [10, 0]); // 10px → clear

          return (
            <span key={i} style={{
              display:       'inline-block',
              fontSize:      88,
              fontWeight:    800,
              lineHeight:    1.15,
              letterSpacing: '-0.02em',
              color:         palette.text,
              fontFamily:    'system-ui, -apple-system, sans-serif',
              opacity,
              filter:        `blur(${blur.toFixed(2)}px)`,
              transform:     `translateY(${translateY.toFixed(1)}px)`,
            }}>
              {char === ' ' ? '\u00A0' : char}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
