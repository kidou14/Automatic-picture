import React from "react";

interface Props { frame: number }

/** Slowly moving ambient light blobs — pure math, no canvas */
export const GlowBlobs: React.FC<Props> = ({ frame }) => {
  const t = frame * 0.008;

  const blobs = [
    {
      x: 540 + Math.sin(t * 1.1) * 280,
      y: 580 + Math.cos(t * 0.7) * 220,
      r: 520,
      color: "#6366f1",
      opacity: 0.13,
    },
    {
      x: 200 + Math.cos(t * 0.9) * 200,
      y: 1200 + Math.sin(t * 1.3) * 300,
      r: 460,
      color: "#38bdf8",
      opacity: 0.09,
    },
    {
      x: 900 + Math.sin(t * 0.6) * 160,
      y: 1600 + Math.cos(t * 1.0) * 200,
      r: 400,
      color: "#818cf8",
      opacity: 0.10,
    },
  ];

  return (
    <svg
      width="1080"
      height="1920"
      viewBox="0 0 1080 1920"
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
    >
      <defs>
        {blobs.map((b, i) => (
          <radialGradient key={i} id={`blob${i}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={b.color} stopOpacity={b.opacity} />
            <stop offset="100%" stopColor={b.color} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      {blobs.map((b, i) => (
        <ellipse key={i} cx={b.x} cy={b.y} rx={b.r} ry={b.r * 0.85} fill={`url(#blob${i})`} />
      ))}
    </svg>
  );
};
