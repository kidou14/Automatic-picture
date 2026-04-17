import React from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';

export const StaticText: React.FC<DimensionProps> = ({ palette, config }) => {
  const isTop = config.dimensions.layout === 'titleTop';
  const posStyle: React.CSSProperties = isTop
    ? { top: 0, height: config.height * 0.22 }
    : { bottom: 0, height: config.height * 0.22 };

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', left: 80, right: 80, ...posStyle,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <h1 style={{
          margin: 0, textAlign: 'center',
          fontSize: 88, fontWeight: 800, lineHeight: 1.15,
          letterSpacing: '-0.02em',
          color: palette.text,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          {config.title}
        </h1>
      </div>
    </AbsoluteFill>
  );
};
