import React from 'react';
import { Composition } from 'remotion';
import { BannerComposition } from './compositions/BannerComposition';
import { BannerConfig } from './types/BannerConfig';

// Default config for Remotion Studio preview
const defaultConfig: BannerConfig = {
  imageUrl: 'https://via.placeholder.com/390x844',
  mockupUrl: '/mockup.png',
  title: '全新体验',
  dimensions: {
    background: 'gradient',
    textEffect: 'fade',
    decoration: 'circles',
    entrance: 'fadeSlideUp',
    layout: 'titleTop',
  },
  palette: {
    bg: '#1a1a2e', bgEnd: '#16213e',
    accent: '#e94560', accent2: '#0f3460',
    text: '#ffffff', muted: 'rgba(255,255,255,0.65)',
    card: 'rgba(255,255,255,0.08)', shadow: 'rgba(0,0,0,0.5)',
  },
  width: 1080,
  height: 1920,
  seed: 'default',
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="BannerComposition"
    component={BannerComposition}
    durationInFrames={90}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={{ config: defaultConfig }}
  />
);
