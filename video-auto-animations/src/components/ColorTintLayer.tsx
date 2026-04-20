/**
 * ColorTintLayer.tsx
 * Dimension L: global color temperature / tint overlay.
 *   L1 — None          (transparent, no tint)
 *   L2 — Cool Blue     (cold cinematic cast)
 *   L3 — Warm Amber    (luxury / cozy tone)
 *   L4 — Purple Neon   (cyberpunk accent shift)
 *   L5 — Dark Neutral  (high-contrast desaturation feel)
 *   L6 — Emerald Tech  (matrix / console green cast)
 */
import React from "react";
import { StyleL } from "../styles/StyleConfig";

interface Props {
  style: StyleL;
}

const TINTS: Record<string, string> = {
  L2: "rgba(0, 60, 140, 0.13)",
  L3: "rgba(140, 70, 0, 0.12)",
  L4: "rgba(100, 0, 160, 0.12)",
  L5: "rgba(8, 8, 18, 0.32)",
  L6: "rgba(0, 120, 50, 0.11)",
};

export const ColorTintLayer: React.FC<Props> = ({ style }) => {
  if (style === "L1") return null;
  const bg = TINTS[style];
  if (!bg) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: bg,
        pointerEvents: "none",
        zIndex: 50,
      }}
    />
  );
};
