import React from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';
import { MARGIN_V, TEXT_H } from '../../layout';

export const StaticText: React.FC<DimensionProps> = ({ palette, config }) => {
  const isTop = config.dimensions.layout === 'titleTop';
  const posStyle: React.CSSProperties = isTop
    ? { top: config.height * MARGIN_V, height: config.height * TEXT_H }
    : { bottom: config.height * MARGIN_V, height: config.height * TEXT_H };

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
