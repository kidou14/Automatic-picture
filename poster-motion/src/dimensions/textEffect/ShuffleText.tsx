import React from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';

// Faithful Remotion port of reactbits.dev Shuffle (ScrambledText / DecryptedText).
// Each character scrambles through a random charset before snapping to its final value.
// Characters settle left-to-right with a stagger, creating a "decryption" reveal effect.

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#%^&*';

export const ShuffleText: React.FC<DimensionProps> = ({ frame, palette, config }) => {
  const isTop = config.dimensions.layout === 'titleTop';
  const posStyle: React.CSSProperties = isTop
    ? { top: 0, height: config.height * 0.22 }
    : { bottom: 0, height: config.height * 0.22 };

  const chars = Array.from(config.title);
  // Finish decryption before the clip ends so the paused final frame is fully readable.
  const SCRAMBLE_LEAD = 12;
  const stagger       = chars.length <= 1
    ? 0
    : Math.max(1, Math.floor(48 / (chars.length - 1)));

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', left: 80, right: 80, ...posStyle,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
          {chars.map((char, i) => {
            const arriveFrame = SCRAMBLE_LEAD + i * stagger;
            const settled     = frame >= arriveFrame;

            let display: string;
            if (char === ' ') {
              display = '\u00A0';
            } else if (settled) {
              display = char;
            } else {
              // Deterministic "random" index — varies quickly with frame, unique per char
              const idx = (frame * 7 + i * 13) % CHARSET.length;
              display   = CHARSET[Math.floor(idx)];
            }

            return (
              <span key={i} style={{
                display:       'inline-block',
                fontSize:      88,
                fontWeight:    800,
                lineHeight:    1.15,
                letterSpacing: '-0.02em',
                // Accent color while scrambling, text color after settling
                color:         settled ? palette.text : palette.accent,
                // Monospace keeps layout stable during scramble
                fontFamily:    '"Courier New", Courier, monospace',
                minWidth:      '0.6em',
                textAlign:     'center',
              }}>
                {display}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
