import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';
import { MARGIN_V, TEXT_H } from '../../layout';

// Inspired by reactbits.dev ShinyText:
// a shine highlight sweeps left→right across the text.
// At frame 60 (of 90) the shine is ~67% through the sweep — visually mid-sparkle.

export const ShinyText: React.FC<DimensionProps> = ({ frame, palette, config }) => {
  const isTop = config.dimensions.layout === 'titleTop';
  const posStyle: React.CSSProperties = isTop
    ? { top: config.height * MARGIN_V, height: config.height * TEXT_H }
    : { bottom: config.height * MARGIN_V, height: config.height * TEXT_H };

  // shinePos: 150% (shine off-right) at frame 0 → -50% (shine off-left) at frame 90
  // so at frame 60 shine sits at 150 - (60/90)*200 ≈ 17% = nicely visible on text
  const shinePos = interpolate(frame, [0, 90], [150, -50], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const textStyle: React.CSSProperties = {
    margin:        0,
    textAlign:     'center',
    fontSize:      88,
    fontWeight:    800,
    lineHeight:    1.15,
    letterSpacing: '-0.02em',
    fontFamily:    'system-ui, -apple-system, sans-serif',
    // gradient: base color either side of a bright white shine band
    backgroundImage:    `linear-gradient(120deg, ${palette.text} 0%, ${palette.text} 35%, rgba(255,255,255,0.92) 50%, ${palette.text} 65%, ${palette.text} 100%)`,
    backgroundSize:     '200% auto',
    backgroundPosition: `${shinePos}% center`,
    WebkitBackgroundClip: 'text',
    backgroundClip:       'text',
    WebkitTextFillColor:  'transparent',
    color: 'transparent',
  };

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', left: 80, right: 80, ...posStyle,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <h1 style={textStyle}>{config.title}</h1>
      </div>
    </AbsoluteFill>
  );
};
