import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';

// Inspired by reactbits.dev BorderGlow:
// a pulsing multi-color glow halo positioned behind the image card.
// Since the decoration layer renders below the image, the glow bleeds
// around all four edges of the image — visible as a neon border effect.

export const GlowRing: React.FC<DimensionProps> = ({ frame, palette, config }) => {
  const isTop = config.dimensions.layout === 'titleTop';
  const titleFrac = 0.26;

  // Image area: full width minus margins, non-title portion of canvas
  const imageTop    = isTop ? titleFrac * 100 + 1  : 1;
  const imageBottom = isTop ? 99                   : (1 - titleFrac) * 100 - 1;
  const imageHeight = imageBottom - imageTop;

  // Slow breathe pulse — shadow radius oscillates
  const pulse = interpolate(frame, [0, 45, 90], [0.75, 1.0, 0.75], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const glow1 = Math.round(80  * pulse);
  const glow2 = Math.round(160 * pulse);
  const glow3 = Math.round(40  * pulse);

  const spread1 = Math.round(40  * pulse);
  const spread2 = Math.round(80  * pulse);

  return (
    <AbsoluteFill>
      <div style={{
        position:     'absolute',
        left:         '6%',
        right:        '6%',
        top:          `${imageTop}%`,
        height:       `${imageHeight}%`,
        borderRadius: 52,
        boxShadow: [
          `0 0 ${glow1}px ${spread1}px ${palette.accent}77`,
          `0 0 ${glow2}px ${spread2}px ${palette.accent2}44`,
          `0 0 ${glow3}px ${glow3}px   ${palette.accent}55`,
        ].join(', '),
        pointerEvents: 'none',
      }} />
    </AbsoluteFill>
  );
};
