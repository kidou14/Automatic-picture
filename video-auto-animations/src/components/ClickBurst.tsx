import React from "react";
import { interpolate, Easing } from "remotion";

interface Props {
  frame: number;      // local frame since click happened (0 = click moment)
  x: number;
  y: number;
  color?: string;
}

/** Particle burst + glow flash at a click point */
export const ClickBurst: React.FC<Props> = ({ frame, x, y, color = "#6366f1" }) => {
  if (frame < 0 || frame > 80) return null;

  const PARTICLES = 12;
  const flash = interpolate(frame, [0, 10, 30], [0.8, 0.3, 0], { extrapolateRight: "clamp" });

  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      {/* Flash */}
      <div style={{
        position: "absolute",
        left: x - 50,
        top: y - 50,
        width: 100,
        height: 100,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color}cc 0%, transparent 70%)`,
        opacity: flash,
      }} />

      {/* Particles */}
      {Array.from({ length: PARTICLES }, (_, i) => {
        const angle = (i / PARTICLES) * Math.PI * 2;
        const speed = 1.75 + (i % 4) * 0.6; // halved — same pixels/sec at 60fps
        const px = x + Math.cos(angle) * speed * frame;
        const py = y + Math.sin(angle) * speed * frame + frame * frame * 0.01; // gravity
        const opacity = interpolate(frame, [0, 30, 80], [1, 0.8, 0], { extrapolateRight: "clamp" });
        const size = 4 + (i % 3) * 2;
        return (
          <div key={i} style={{
            position: "absolute",
            left: px - size / 2,
            top: py - size / 2,
            width: size,
            height: size,
            borderRadius: "50%",
            background: i % 2 === 0 ? color : "#818cf8",
            opacity,
            boxShadow: `0 0 ${size * 2}px ${color}`,
          }} />
        );
      })}
    </div>
  );
};
