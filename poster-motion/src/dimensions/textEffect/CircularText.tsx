import React from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';

// Faithful Remotion port of reactbits.dev CircularText.
// Characters are arranged evenly around a circle; the whole ring spins
// continuously at one full rotation per 90 frames.

export const CircularText: React.FC<DimensionProps> = ({ frame, palette, config }) => {
  const isTop   = config.dimensions.layout === 'titleTop';
  const areaH   = config.height * 0.22;
  const centerX = config.width  / 2;
  const centerY = isTop ? areaH / 2 : config.height - areaH / 2;

  // Repeat title + separator to fill a full ring (~24 characters)
  const SEP      = ' ✦ ';
  const cycle    = Array.from(config.title + SEP);
  const TARGET   = 24;
  const repeated = Array.from(
    (config.title + SEP).repeat(Math.ceil(TARGET / cycle.length))
  ).slice(0, TARGET);

  const radius       = 155;                          // px from center to char center
  const rotationDeg  = (frame / 90) * 360;           // one full revolution per clip
  const anglePerChar = 360 / repeated.length;        // degrees between chars

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute',
        left:     centerX,
        top:      centerY,
        width:    0,
        height:   0,
      }}>
        {repeated.map((char, i) => {
          const angle    = anglePerChar * i + rotationDeg;
          const angleRad = (angle - 90) * (Math.PI / 180); // −90° so 0 = top
          const x        = Math.cos(angleRad) * radius;
          const y        = Math.sin(angleRad) * radius;

          return (
            <span key={i} style={{
              position:   'absolute',
              display:    'inline-block',
              left:       x,
              top:        y,
              fontSize:   30,
              fontWeight: 700,
              color:      palette.text,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              opacity:    0.88,
              // center the glyph on (x,y) and rotate it to face outward
              transform:  `translate(-50%, -50%) rotate(${angle}deg)`,
              whiteSpace: 'nowrap',
            }}>
              {char}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
