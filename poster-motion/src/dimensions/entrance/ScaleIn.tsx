import React from 'react';
import { interpolate } from 'remotion';
import { EntranceDimensionProps } from '../../types/BannerConfig';

export const ScaleIn: React.FC<EntranceDimensionProps> = ({ frame, children }) => {
  const opacity = interpolate(frame, [0, 28], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(frame, [0, 36], [0.88, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{
      width: '100%', height: '100%',
      opacity,
      transform: `scale(${scale})`,
      transformOrigin: 'center center',
    }}>
      {children}
    </div>
  );
};
