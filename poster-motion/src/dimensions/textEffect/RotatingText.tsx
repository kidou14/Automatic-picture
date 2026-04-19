import React from 'react';
import { AbsoluteFill, spring } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';
import { MARGIN_V, TEXT_H } from '../../layout';

// Faithful Remotion port of reactbits.dev RotatingText.
// Characters slide in from y=100% with per-char spring stagger (damping:25, stiffness:300).
// Multiple texts: split config.title by " / " (e.g. "Hello / World / Test").
// Single text: one-time entrance animation (no rotation needed).
// rotationInterval = 2s (reactbits default).

const SPRING_CFG   = { damping: 25, stiffness: 300 };
const STAGGER_GAP  = 1.5; // frames between each character's spring start

export const RotatingText: React.FC<DimensionProps> = ({ frame, fps, palette, config }) => {
  const isTop = config.dimensions.layout === 'titleTop';
  const areaH = Math.round(config.height * TEXT_H);
  const posStyle: React.CSSProperties = isTop
    ? { top: Math.round(config.height * MARGIN_V), height: areaH }
    : { bottom: Math.round(config.height * MARGIN_V), height: areaH };

  const texts = config.title.includes(' / ')
    ? config.title.split(' / ').map((s: string) => s.trim())
    : [config.title];

  const intervalFrames = Math.round(fps * 2);              // 2 s per text
  const textIdx        = texts.length > 1
    ? Math.floor(frame / intervalFrames) % texts.length
    : 0;
  const currentText = texts[textIdx];

  // baseFrame: time elapsed since current text began displaying
  const baseFrame = texts.length > 1 ? frame % intervalFrames : frame;

  const chars = currentText.split('');

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', left: 80, right: 80, ...posStyle,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <h1 style={{
          margin:        0,
          textAlign:     'center',
          fontSize:      88,
          fontWeight:    800,
          lineHeight:    1.15,
          letterSpacing: '-0.02em',
          fontFamily:    'system-ui, -apple-system, sans-serif',
          color:         palette.text,
          display:       'block',
          width:         '100%',
          overflow:      'hidden',
        }}>
          {chars.map((char, i) => {
            const charFrame = Math.max(0, baseFrame - i * STAGGER_GAP);
            const progress  = spring({ fps, frame: charFrame, config: SPRING_CFG });
            const y         = (1 - progress) * 100;

            return (
              <span
                key={`${textIdx}-${i}`}
                style={{
                  display:    'inline-block',
                  transform:  `translateY(${y}%)`,
                  opacity:    Math.min(1, Math.max(0, progress)),
                  whiteSpace: 'pre',
                }}
              >
                {char}
              </span>
            );
          })}
        </h1>
      </div>
    </AbsoluteFill>
  );
};
