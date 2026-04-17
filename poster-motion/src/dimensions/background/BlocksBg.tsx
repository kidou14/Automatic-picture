import React from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';

export const BlocksBg: React.FC<DimensionProps> = ({ palette }) => (
  <AbsoluteFill style={{ backgroundColor: palette.bg }}>
    <div style={{
      position: 'absolute', width: 900, height: 900, borderRadius: 120,
      background: palette.accent, opacity: 0.12,
      top: -200, right: -200,
    }} />
    <div style={{
      position: 'absolute', width: 600, height: 600, borderRadius: 80,
      background: palette.accent2, opacity: 0.10,
      bottom: -100, left: -150,
    }} />
  </AbsoluteFill>
);
