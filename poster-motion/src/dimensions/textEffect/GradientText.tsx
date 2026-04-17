import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';

// Inspired by reactbits.dev GradientText:
// text rendered with an animated moving gradient fill.
// gradient position is driven by Remotion frame so it's fully deterministic.

export const GradientText: React.FC<DimensionProps> = ({ frame, palette, config }) => {
  const isTop = config.dimensions.layout === 'titleTop';
  const posStyle: React.CSSProperties = isTop
    ? { top: 0, height: config.height * 0.22 }
    : { bottom: 0, height: config.height * 0.22 };

  // Full yoyo sweep over 90 frames: 0 → 100 → 0 (matches reactbits yoyo: true default)
  const gradientPos = interpolate(frame, [0, 45, 90], [0, 100, 0], {
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
    // reactbits: [...colors, colors[0]] → 4-stop gradient that wraps back to start
    backgroundImage:    `linear-gradient(to right, ${palette.accent}, ${palette.accent2}, ${palette.text}, ${palette.accent})`,
    backgroundSize:     '300% 100%',
    backgroundPosition: `${gradientPos}% 50%`,
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
