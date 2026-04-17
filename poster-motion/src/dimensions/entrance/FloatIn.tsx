import React from 'react';
import { interpolate } from 'remotion';
import { EntranceDimensionProps } from '../../types/BannerConfig';

// Inspired by reactbits.dev AnimatedContent:
// element slides in from the left with a slight scale and opacity ease.

export const FloatIn: React.FC<EntranceDimensionProps> = ({ frame, children }) => {
  const opacity = interpolate(frame, [0, 38], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const translateX = interpolate(frame, [0, 42], [-80, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const scale = interpolate(frame, [0, 42], [0.94, 1.0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      width: '100%', height: '100%',
      opacity,
      transform:       `translateX(${translateX}px) scale(${scale})`,
      transformOrigin: 'center center',
    }}>
      {children}
    </div>
  );
};
