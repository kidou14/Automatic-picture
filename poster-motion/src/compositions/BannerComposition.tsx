import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { BannerConfig, DimensionProps } from '../types/BannerConfig';
import { DIMENSIONS } from '../dimensions';
import { ImageLayer } from './ImageLayer';

export const BannerComposition: React.FC<{ config: BannerConfig }> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const BackgroundComp = DIMENSIONS.background[config.dimensions.background];
  const DecorationComp = DIMENSIONS.decoration[config.dimensions.decoration];
  const TextComp       = DIMENSIONS.textEffect[config.dimensions.textEffect];
  const EntranceComp   = DIMENSIONS.entrance[config.dimensions.entrance];

  const props: DimensionProps = { frame, fps, palette: config.palette, config };

  return (
    <AbsoluteFill>
      <BackgroundComp {...props} />
      <DecorationComp {...props} />
      <TextComp {...props} />
      <EntranceComp {...props}>
        <ImageLayer config={config} />
      </EntranceComp>
    </AbsoluteFill>
  );
};
