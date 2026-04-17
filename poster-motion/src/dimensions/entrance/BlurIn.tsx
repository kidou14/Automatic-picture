import React from 'react';
import { interpolate } from 'remotion';
import { EntranceDimensionProps } from '../../types/BannerConfig';

// Inspired by reactbits.dev FadeContent (blur variant):
// element fades in while simultaneously resolving from soft blur to sharp.

export const BlurIn: React.FC<EntranceDimensionProps> = ({ frame, children }) => {
  const opacity = interpolate(frame, [0, 48], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const blur = interpolate(frame, [0, 48], [22, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const scale = interpolate(frame, [0, 48], [1.06, 1.0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      width: '100%', height: '100%',
      opacity,
      filter:          `blur(${blur}px)`,
      transform:       `scale(${scale})`,
      transformOrigin: 'center center',
    }}>
      {children}
    </div>
  );
};
