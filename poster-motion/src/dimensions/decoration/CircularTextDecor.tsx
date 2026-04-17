import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';

// Inspired by reactbits.dev CircularText:
// the banner title + a separator character are arranged in a circle and
// rotate slowly over the 90-frame timeline.  Rendered as a large faint ring
// behind the image — purely decorative.

export const CircularTextDecor: React.FC<DimensionProps> = ({ frame, palette, config }) => {
  const isTop = config.dimensions.layout === 'titleTop';
  const titleFrac = 0.26;

  // Centre of the image area (as % of canvas height)
  const imageCentreY = isTop
    ? (titleFrac + (1 - titleFrac) / 2) * 100
    : ((1 - titleFrac) / 2) * 100;

  // Rotation: 30° over the full 90-frame clip
  const rotation = interpolate(frame, [0, 90], [0, 30], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Repeat the title enough times to fill the circle
  const separator = '  ·  ';
  const unit      = config.title + separator;
  const fullText  = (unit.repeat(Math.ceil(40 / unit.length) + 1)).slice(0, 44);
  const chars     = Array.from(fullText);
  const radius    = Math.round(config.width * 0.41); // px — ~82% of half-width
  const angleStep = 360 / chars.length;

  return (
    <AbsoluteFill>
      {/* Wrapper: placed at the centre of the image area */}
      <div style={{
        position: 'absolute',
        left:     '50%',
        top:      `${imageCentreY}%`,
        width:    0,
        height:   0,
        transform:`translate(-50%, -50%) rotate(${rotation}deg)`,
      }}>
        {chars.map((char, i) => {
          const angle = i * angleStep;
          return (
            <span key={i} style={{
              position:        'absolute',
              left:            0,
              top:             0,
              fontSize:        32,
              fontWeight:      700,
              color:           palette.accent,
              opacity:         0.22,
              fontFamily:      'system-ui, -apple-system, sans-serif',
              letterSpacing:   1,
              transform:       `rotate(${angle}deg) translateY(-${radius}px)`,
              transformOrigin: '0 0',
              pointerEvents:   'none',
            }}>
              {char}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
