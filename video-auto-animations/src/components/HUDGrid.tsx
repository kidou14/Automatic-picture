import React from "react";
import { interpolate } from "remotion";

interface Props {
  frame: number;
  opacity?: number;
}

/** Subtle HUD-style grid lines that fade in */
export const HUDGrid: React.FC<Props> = ({ frame, opacity = 1 }) => {
  const fadeIn = interpolate(frame, [0, 40], [0, 1], { extrapolateRight: "clamp" });
  const W = 1080, H = 1920;
  const COLS = 6, ROWS = 10;
  const colW = W / COLS, rowH = H / ROWS;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", top: 0, left: 0, opacity: fadeIn * opacity * 0.12, pointerEvents: "none" }}
    >
      {/* Vertical lines */}
      {Array.from({ length: COLS - 1 }, (_, i) => (
        <line key={`v${i}`} x1={(i + 1) * colW} y1={0} x2={(i + 1) * colW} y2={H}
          stroke="#6366f1" strokeWidth="1" />
      ))}
      {/* Horizontal lines */}
      {Array.from({ length: ROWS - 1 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={(i + 1) * rowH} x2={W} y2={(i + 1) * rowH}
          stroke="#6366f1" strokeWidth="1" />
      ))}
      {/* Corner markers */}
      {[[60,60],[W-60,60],[60,H-60],[W-60,H-60]].map(([cx,cy],i) => (
        <g key={i}>
          <line x1={cx-20} y1={cy} x2={cx+20} y2={cy} stroke="#818cf8" strokeWidth="2" />
          <line x1={cx} y1={cy-20} x2={cx} y2={cy+20} stroke="#818cf8" strokeWidth="2" />
        </g>
      ))}
    </svg>
  );
};
