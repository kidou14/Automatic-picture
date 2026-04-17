import React from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';

export const GradientBg: React.FC<DimensionProps> = ({ palette }) => (
  <AbsoluteFill style={{
    background: `linear-gradient(145deg, ${palette.bg} 0%, ${palette.bgEnd} 100%)`,
  }} />
);
