/**
 * Browser-side preview app — runs inside /preview.html as an iframe.
 * Renders the BannerComposition directly in the browser with @remotion/player.
 * Accepts config updates from the parent (index.html) via postMessage.
 */
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from '@remotion/player';
import { BannerComposition } from './compositions/BannerComposition';
import { BannerConfig } from './types/BannerConfig';

// Placeholder image — a simple dark rectangle so layout/animations are visible
// even before a real screenshot has been taken.
const PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="720">
    <rect width="100%" height="100%" rx="32" fill="#1a1a2e"/>
    <text x="195" y="340" text-anchor="middle" dominant-baseline="middle"
      font-family="system-ui" font-size="18" fill="#333">App Screenshot</text>
    <text x="195" y="370" text-anchor="middle" dominant-baseline="middle"
      font-family="system-ui" font-size="13" fill="#2a2a3e">生成后显示真实截图</text>
  </svg>`
)}`;

const DEFAULT_CONFIG: BannerConfig = {
  imageUrl:   PLACEHOLDER,
  mockupUrl:  '/mockup.png',
  title: '预览动效',
  dimensions: {
    background: 'gradient',
    textEffect: 'gradientText',
    decoration: 'circles',
    entrance: 'fadeSlideUp',
    layout: 'titleTop',
  },
  palette: {
    bg:      '#0f0f1a',
    bgEnd:   '#1a1040',
    accent:  '#7c6ef5',
    accent2: '#e94560',
    text:    '#f0f0f8',
    muted:   'rgba(240,240,248,0.55)',
    card:    'rgba(255,255,255,0.07)',
    shadow:  'rgba(0,0,0,0.5)',
  },
  width: 1080,
  height: 1920,
  seed: 'preview',
};

function App() {
  const [config, setConfig] = useState<BannerConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data) return;

      // Full config replacement (after a real render / re-render)
      if (e.data.type === 'UPDATE_CONFIG') {
        setConfig(e.data.config as BannerConfig);

      // Dimension-only update (before any render — keeps default palette + placeholder)
      } else if (e.data.type === 'UPDATE_DIMS') {
        setConfig(prev => ({
          ...prev,
          dimensions: { ...prev.dimensions, ...e.data.dimensions },
        }));

      // Title update from the input field
      } else if (e.data.type === 'UPDATE_TITLE') {
        setConfig(prev => ({ ...prev, title: e.data.title || prev.title }));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div style={{
      width: '100%', height: '100vh',
      background: '#050505',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <Player
        component={BannerComposition}
        inputProps={{ config }}
        durationInFrames={90}
        fps={30}
        compositionWidth={1080}
        compositionHeight={1920}
        style={{ width: '100%', height: '100%' }}
        controls
        autoPlay
        clickToPlay={false}
        loop={false}
        moveToBeginningWhenEnded={false}
        numberOfSharedAudioTags={0}
      />
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
