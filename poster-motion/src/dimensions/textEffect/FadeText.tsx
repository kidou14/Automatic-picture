import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';

export const FadeText: React.FC<DimensionProps> = ({ frame, palette, config }) => {
  const isTop = config.dimensions.layout === 'titleTop';
  const posStyle: React.CSSProperties = isTop
    ? { top: 0, height: config.height * 0.22 }
    : { bottom: 0, height: config.height * 0.22 };

  // Deliberately slow — at frame 60 the text is ~79% through the fade so it reads as
  // "still arriving", clearly distinct from StaticText's fully-settled appearance.
  const opacity = interpolate(frame, [5, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const translateY = interpolate(frame, [5, 80], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', left: 80, right: 80, ...posStyle,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity,
        transform: `translateY(${translateY}px)`,
      }}>
        <h1 style={{
          margin: 0, textAlign: 'center',
          fontSize: 88, fontWeight: 800, lineHeight: 1.15,
          letterSpacing: '-0.02em',
          color: palette.text,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          {config.title}
        </h1>
      </div>
    </AbsoluteFill>
  );
};
