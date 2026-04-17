import React from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';

function hashSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h || 1;
}

function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const CircleDots: React.FC<DimensionProps> = ({ palette, config }) => {
  const rng = createRng(hashSeed(config.seed + '-dots'));
  const rand = (min: number, max: number) => min + rng() * (max - min);

  const dots = Array.from({ length: 12 }, () => ({
    x: rand(4, 96),
    y: rand(4, 96),
    size: rand(16, 56),
    opacity: rand(0.15, 0.45),
  }));

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {dots.map((dot, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: dot.size,
            height: dot.size,
            borderRadius: '50%',
            background: palette.accent,
            opacity: dot.opacity,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
