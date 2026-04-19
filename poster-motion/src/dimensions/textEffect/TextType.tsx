import React from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';
import { MARGIN_V, TEXT_H } from '../../layout';

// Faithful Remotion port of reactbits.dev TextType (typewriter effect).
// Characters appear one at a time; a blinking cursor follows the insertion point.
// Typing spreads evenly across frames 0–70 so the animation is still in progress
// at the default render frame, while completing well within the 90-frame clip.

export const TextType: React.FC<DimensionProps> = ({ frame, palette, config }) => {
  const isTop = config.dimensions.layout === 'titleTop';
  const posStyle: React.CSSProperties = isTop
    ? { top: config.height * MARGIN_V, height: config.height * TEXT_H }
    : { bottom: config.height * MARGIN_V, height: config.height * TEXT_H };

  const chars           = Array.from(config.title);
  // Finish typing well before the clip ends so the final paused frame shows the full title.
  const framesPerChar   = Math.max(1, Math.floor(60 / Math.max(chars.length, 1)));
  const charsVisible    = Math.min(chars.length, Math.floor((frame + 1) / framesPerChar));
  const doneTyping      = charsVisible >= chars.length;

  // Cursor blinks every 7 frames once typing finishes; during typing always on
  const cursorVisible   = doneTyping ? Math.floor(frame / 7) % 2 === 0 : true;

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', left: 80, right: 80, ...posStyle,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <h1 style={{
          margin:        0,
          textAlign:     'center',
          fontSize:      88,
          fontWeight:    800,
          lineHeight:    1.15,
          letterSpacing: '-0.02em',
          color:         palette.text,
          fontFamily:    'system-ui, -apple-system, sans-serif',
        }}>
          {chars.slice(0, charsVisible).join('')}
          {cursorVisible && (
            <span style={{ color: palette.accent, fontWeight: 400, opacity: 0.9 }}>|</span>
          )}
        </h1>
      </div>
    </AbsoluteFill>
  );
};
