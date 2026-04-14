import React from "react";
import { interpolate } from "remotion";

const W = 1080, H = 1920;
const COUNT = 38;

// Pre-computed particle data (golden-angle distribution)
const PARTICLES = Array.from({ length: COUNT }, (_, i) => ({
  x: (i * 137.508) % W,
  baseY: (i * 113.7) % H,
  speed: 0.28 + (i % 7) * 0.06,
  size: 2 + (i % 4),
  phase: i * 0.83,
  color: i % 3 === 0 ? "#818cf8" : i % 3 === 1 ? "#6366f1" : "#38bdf8",
  opacity: 0.25 + (i % 5) * 0.09,
}));

interface Props { frame: number }

export const ParticleField: React.FC<Props> = ({ frame }) => (
  <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, pointerEvents: "none" }}>
    {PARTICLES.map((p, i) => {
      const y = ((p.baseY - p.speed * frame) % H + H) % H;
      const pulse = 0.7 + Math.sin(frame * 0.04 + p.phase) * 0.3;
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: p.x - p.size / 2,
            top: y - p.size / 2,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: p.color,
            opacity: p.opacity * pulse,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          }}
        />
      );
    })}
  </div>
);
