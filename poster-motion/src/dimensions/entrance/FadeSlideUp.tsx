import React from 'react';
import { interpolate } from 'remotion';
import { EntranceDimensionProps } from '../../types/BannerConfig';

export const FadeSlideUp: React.FC<EntranceDimensionProps> = ({ frame, children }) => {
  const opacity = interpolate(frame, [0, 42], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const translateY = interpolate(frame, [0, 42], [80, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ width: '100%', height: '100%', opacity, transform: `translateY(${translateY}px)` }}>
      {children}
    </div>
  );
};
