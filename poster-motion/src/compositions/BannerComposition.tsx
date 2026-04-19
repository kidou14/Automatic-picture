import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { BannerConfig, DimensionProps } from '../types/BannerConfig';
import { DIMENSIONS } from '../dimensions';
import { ImageLayer } from './ImageLayer';

export const BannerComposition: React.FC<{ config: BannerConfig }> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const BackgroundComp = DIMENSIONS.background[config.dimensions.background];
  const TextComp       = DIMENSIONS.textEffect[config.dimensions.textEffect];
  // const EntranceComp = DIMENSIONS.entrance[config.dimensions.entrance]; // disabled

  const props: DimensionProps = { frame, fps, palette: config.palette, config };

  return (
    <AbsoluteFill>
      <BackgroundComp {...props} />
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${config.textScale ?? 1})`, transformOrigin: 'center center' }}>
        <TextComp {...props} />
      </div>
      <ImageLayer config={config} />
    </AbsoluteFill>
  );
};
