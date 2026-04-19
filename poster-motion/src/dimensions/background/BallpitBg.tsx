import React from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';

// Inspired by reactbits.dev Ballpit (Three.js InstancedMesh spheres).
// Approximated with seed-based CSS circles that float in slow sine-wave paths.
// Each "ball" has a depth value: far balls are blurred and dim; near balls sharp and bright.

function rng(seed: number) {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), s | 1) ^ 0) >>> 0;
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h || 1;
}

export const BallpitBg: React.FC<DimensionProps> = ({ frame, palette, config }) => {
  const rand = rng(hashStr(config.seed + '-ballpit'));

  const balls = Array.from({ length: 22 }, (_, i) => {
    const x0    = rand() * 100;          // base X %
    const y0    = rand() * 110 - 5;      // base Y %  (slightly off-screen allowed)
    const size  = 60 + rand() * 220;     // px diameter
    const speed = 0.25 + rand() * 0.6;
    const phase = rand() * Math.PI * 2;
    const depth = rand();                // 0 = far/back, 1 = near/front

    const t  = (frame / 30) * (config.params?.bg?.speed ?? 1.0);
    const ax = x0 + Math.sin(t * speed + phase)        * 7;
    const ay = y0 + Math.cos(t * speed * 0.8 + phase)  * 9;

    const colorIdx  = Math.floor(rand() * 3);
    const color     = [palette.accent, palette.accent2, palette.bgEnd][colorIdx];
    const blurPx    = (1 - depth) * 48 + 4;
    const opacity   = 0.12 + depth * 0.28;
    // Simulated 3D sphere highlight
    const highlight = `radial-gradient(circle at 35% 32%, rgba(255,255,255,${(0.35 + depth * 0.3).toFixed(2)}) 0%, ${color}cc 40%, ${color}88 100%)`;

    return { ax, ay, size, highlight, blurPx, opacity };
  });

  return (
    <AbsoluteFill style={{ background: palette.bg, overflow: 'hidden' }}>
      {balls.map((b, i) => (
        <div key={i} style={{
          position:     'absolute',
          width:        b.size,
          height:       b.size,
          left:         `${b.ax}%`,
          top:          `${b.ay}%`,
          transform:    'translate(-50%, -50%)',
          borderRadius: '50%',
          background:   b.highlight,
          filter:       `blur(${b.blurPx}px)`,
          opacity:      b.opacity,
          pointerEvents:'none',
        }} />
      ))}
      {/* Soft dark overlay to keep UI readable */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 100% 100% at 50% 50%, ${palette.bg}44 0%, ${palette.bg}99 60%, ${palette.bg}cc 100%)`,
      }} />
    </AbsoluteFill>
  );
};
