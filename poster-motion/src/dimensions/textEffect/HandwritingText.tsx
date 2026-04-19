import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';
import { MARGIN_V, TEXT_H } from '../../layout';

// Remotion port of hand-writing-text.tsx (KokonutUI).
// Respects titleTop / titleBottom layout like all other text effects.
// SVG <ellipse> adapts to strip dimensions so it's never hidden by the mockup.

const DASH = 3200; // larger than any ellipse circumference we'll render

export const HandwritingText: React.FC<DimensionProps> = ({ frame, fps, palette, config }) => {
  const isTop = config.dimensions.layout === 'titleTop';

  // Strip dimensions — same convention as BlurText / SplitText etc.
  const stripH = config.height * TEXT_H;
  const stripW = config.width;

  // Timings
  const drawEnd   = Math.floor(2.5 * fps);
  const fadeStart = Math.floor(0.4 * fps);
  const fadeEnd   = Math.floor(1.2 * fps);

  // Ellipse draws itself in — stroke starts hidden, reveals fully by drawEnd
  const dashOffset = interpolate(frame, [0, drawEnd], [DASH, 0], {
    extrapolateRight: 'clamp',
  });

  // Title fades + slides in from the correct direction
  const textOpacity = interpolate(frame, [fadeStart, fadeEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const textSlide = interpolate(frame, [fadeStart, fadeEnd], [isTop ? -22 : 22, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Ellipse dimensions — fits snugly within the strip with padding
  const cx = stripW / 2;
  const cy = stripH / 2;
  const rx = stripW * 0.41;
  const ry = stripH * 0.36;

  // Font size scales down for longer titles
  const len      = config.title.length;
  const fontSize = len <= 8 ? 80 : len <= 14 ? 66 : len <= 20 ? 54 : 42;

  const posStyle: React.CSSProperties = isTop
    ? { top: config.height * MARGIN_V,    height: stripH }
    : { bottom: config.height * MARGIN_V, height: stripH };

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 0, right: 0, ...posStyle }}>

        {/* Adaptive ellipse — starts drawing from 12 o'clock via rotate(-90) */}
        <svg
          width={stripW}
          height={stripH}
          style={{ position: 'absolute', inset: 0 }}
        >
          <ellipse
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            fill="none"
            strokeWidth="7"
            stroke={palette.accent}
            strokeLinecap="round"
            strokeDasharray={DASH}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${cx} ${cy})`}
            opacity={0.88}
          />
        </svg>

        {/* Title text, centered in the strip */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: textOpacity,
          transform: `translateY(${textSlide.toFixed(1)}px)`,
        }}>
          <span style={{
            fontSize,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            color: palette.text,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textAlign: 'center',
            padding: '0 80px',
          }}>
            {config.title}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
