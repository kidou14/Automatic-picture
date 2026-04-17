import React from 'react';
import { AbsoluteFill, spring } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';

// Faithful Remotion port of reactbits.dev CountUp.
// Uses Remotion spring() mirroring reactbits' useSpring params:
//   damping = 20 + 40*(1/duration)  → duration=2s → damping=40
//   stiffness = 100*(1/duration)    → duration=2s → stiffness=50
//
// Numeric target: first number found in config.title (e.g. "10,000 Users" → 10000).
// Falls back to 100 if no number detected.
// Any non-numeric suffix (e.g. "+ Users") is preserved and appended.

export const CountUpText: React.FC<DimensionProps> = ({ frame, fps, palette, config }) => {
  const isTop = config.dimensions.layout === 'titleTop';
  const areaH = Math.round(config.height * 0.22);
  const posStyle: React.CSSProperties = isTop
    ? { top: 0, height: areaH }
    : { bottom: 0, height: areaH };

  // Parse numeric target and optional suffix from title
  const numMatch = config.title.match(/([\d,]+\.?\d*)/);
  const target   = numMatch ? parseFloat(numMatch[1].replace(/,/g, '')) : 100;
  const suffix   = numMatch
    ? config.title.slice(config.title.indexOf(numMatch[1]) + numMatch[1].length)
    : '';

  // Count decimal places so display matches input precision
  const decimals = numMatch?.[1].includes('.')
    ? numMatch[1].split('.')[1].replace(/0+$/, '').length
    : 0;

  // spring() → 0..1, settles by durationInFrames
  const progress = spring({
    fps,
    frame,
    config: { damping: 40, stiffness: 50 },
    durationInFrames: fps * 2,
  });

  const current = progress * target;

  const display = Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(current);

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', left: 80, right: 80, ...posStyle,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <h1 style={{
          margin:        0,
          textAlign:     'center',
          fontSize:      88,
          fontWeight:    800,
          lineHeight:    1.15,
          letterSpacing: '-0.02em',
          fontFamily:    'system-ui, -apple-system, sans-serif',
          color:         palette.text,
        }}>
          {display}{suffix}
        </h1>
      </div>
    </AbsoluteFill>
  );
};
