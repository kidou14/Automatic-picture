import React from 'react';
import { AbsoluteFill, spring } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';
import { MARGIN_V, TEXT_H } from '../../layout';

// Faithful Remotion port of reactbits.dev SplitText.
// Each character enters from below with a spring-based fade+slide stagger,
// matching the GSAP stagger entrance used in the original.

export const SplitText: React.FC<DimensionProps> = ({ frame, fps, palette, config }) => {
  const isTop = config.dimensions.layout === 'titleTop';
  const posStyle: React.CSSProperties = isTop
    ? { top: config.height * MARGIN_V, height: config.height * TEXT_H }
    : { bottom: config.height * MARGIN_V, height: config.height * TEXT_H };

  const chars = Array.from(config.title);
  // Ensure even long titles have enough time to fully settle before the clip ends.
  const stagger = chars.length <= 1
    ? 0
    : Math.max(1, Math.floor(42 / (chars.length - 1)));

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', left: 80, right: 80, ...posStyle,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
          {chars.map((char, i) => {
            const progress = spring({
              frame: frame - i * stagger,
              fps,
              config: { stiffness: 60, damping: 11 },
            });
            const opacity    = Math.min(1, Math.max(0, progress));
            const translateY = (1 - progress) * 56; // slide up from 56 px below

            return (
              <span key={i} style={{
                display:       'inline-block',
                fontSize:      88,
                fontWeight:    800,
                lineHeight:    1.15,
                letterSpacing: '-0.02em',
                color:         palette.text,
                fontFamily:    'system-ui, -apple-system, sans-serif',
                opacity,
                transform:     `translateY(${translateY.toFixed(1)}px)`,
              }}>
                {char === ' ' ? '\u00A0' : char}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
