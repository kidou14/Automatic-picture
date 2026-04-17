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

export const LineStrokes: React.FC<DimensionProps> = ({ palette, config }) => {
  const rng = createRng(hashSeed(config.seed + '-lines'));
  const rand = (min: number, max: number) => min + rng() * (max - min);

  const lines = Array.from({ length: 4 }, () => ({
    x: rand(5, 95),
    y: rand(5, 95),
    length: rand(100, 250),
    angle: rand(0, 360),
  }));

  const { width, height } = config;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {lines.map((line, i) => {
          const cx = (line.x / 100) * width;
          const cy = (line.y / 100) * height;
          const rad = (line.angle * Math.PI) / 180;
          const dx = Math.cos(rad) * line.length * 0.5;
          const dy = Math.sin(rad) * line.length * 0.5;
          return (
            <line
              key={i}
              x1={cx - dx}
              y1={cy - dy}
              x2={cx + dx}
              y2={cy + dy}
              stroke={palette.accent2}
              strokeWidth={2}
              opacity={0.2}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
