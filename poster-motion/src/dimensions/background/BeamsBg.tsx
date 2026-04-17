import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';

// Inspired by reactbits.dev Beams (Three.js noise-distorted light pillars).
// Approximated with rotated linear-gradient "beams" that subtly shift over time,
// plus a base gradient and vignette for depth.

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

export const BeamsBg: React.FC<DimensionProps> = ({ frame, palette, config }) => {
  const rand = rng(hashStr(config.seed + '-beams'));

  const beams = Array.from({ length: 9 }, () => {
    const x0      = 5  + rand() * 90;  // base horizontal % of canvas
    const width   = 2  + rand() * 10;  // beam width %
    const opacity = 0.07 + rand() * 0.20;
    const speed   = 0.15 + rand() * 0.35;
    const phase   = rand() * Math.PI * 2;
    const tilt    = 10  + rand() * 20; // rotation degrees
    const useAcc2 = rand() > 0.5;
    return { x0, width, opacity, speed, phase, tilt, useAcc2 };
  });

  const t = frame / 30;

  // Global brightness gently pulses
  const brightness = interpolate(frame, [0, 45, 90], [0.85, 1.0, 0.85], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* Dark base */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(168deg, ${palette.bg} 0%, ${palette.bgEnd} 100%)`,
      }} />

      {/* Beam pillars */}
      {beams.map((b, i) => {
        const xAnim = b.x0 + Math.sin(t * b.speed + b.phase) * 3.5;
        const color = b.useAcc2 ? palette.accent2 : palette.accent;
        // hex opacity
        const hexOp = Math.round(b.opacity * brightness * 255).toString(16).padStart(2, '0');

        return (
          <div key={i} style={{
            position:      'absolute',
            left:          `${xAnim}%`,
            top:           '-30%',
            width:         `${b.width}%`,
            height:        '160%',
            background:    `linear-gradient(to bottom, transparent 0%, ${color}${hexOp} 30%, ${color}${hexOp} 70%, transparent 100%)`,
            transform:     `rotate(${b.tilt}deg)`,
            transformOrigin:'top center',
            filter:         'blur(10px)',
            pointerEvents: 'none',
          }} />
        );
      })}

      {/* Subtle glow from top — simulates distant light source */}
      <div style={{
        position: 'absolute',
        width: '120%', height: '45%',
        left: '-10%', top: '-10%',
        background: `radial-gradient(ellipse at 50% 0%, ${palette.accent}22 0%, transparent 60%)`,
        filter: 'blur(30px)',
      }} />

      {/* Edge vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 85% 85% at 50% 50%, transparent 30%, ${palette.bg}88 68%, ${palette.bg}dd 100%)`,
      }} />
    </AbsoluteFill>
  );
};
