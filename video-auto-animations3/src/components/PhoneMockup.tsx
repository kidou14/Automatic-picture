/**
 * PhoneMockup.tsx — CSS-only iPhone-style phone frame
 *
 * Layout (all px, within a 840×1820 bounding box):
 *   Phone body:   840 × 1820, radius 56, #111
 *   Screen area:  812 × 1764, inset 14px, radius 46
 *   Dynamic Island: 130 × 36, pill at top center, 16px from top
 *   Side buttons: 4px wide, absolute on left edge
 *   Home bar:     120 × 5 pill at bottom center
 *   Screen glare: subtle radial-gradient overlay top-left
 */
import React from "react";
import { OffthreadVideo } from "remotion";

export const PHONE_W = 840;
export const PHONE_H = 1820;
const SCREEN_INSET = 14;
const SCREEN_W = PHONE_W - SCREEN_INSET * 2;
const SCREEN_H = PHONE_H - SCREEN_INSET * 2;
const SCREEN_RADIUS = 46;
const BODY_RADIUS = 56;

interface Props {
  screenVideoUrl: string;
  startFrom: number;        // Remotion <Video> startFrom (comp-fps frames)
  accentColor: string;
}

export const PhoneMockup: React.FC<Props> = ({ screenVideoUrl, startFrom, accentColor }) => {
  return (
    <div
      style={{
        position: "relative",
        width: PHONE_W,
        height: PHONE_H,
        flexShrink: 0,
      }}
    >
      {/* Phone body */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: BODY_RADIUS,
          background: "linear-gradient(160deg, #1a1a1a 0%, #0d0d0d 60%, #111 100%)",
          boxShadow: `
            0 80px 200px rgba(0,0,0,0.9),
            0 0 0 1px rgba(255,255,255,0.06),
            0 0 60px ${accentColor}22,
            inset 0 1px 0 rgba(255,255,255,0.08)
          `,
        }}
      />

      {/* Left side buttons (volume up, volume down, silent) */}
      <div style={{ position: "absolute", left: -4, top: 280, width: 4, height: 70, borderRadius: "2px 0 0 2px", background: "#2a2a2a" }} />
      <div style={{ position: "absolute", left: -4, top: 370, width: 4, height: 70, borderRadius: "2px 0 0 2px", background: "#2a2a2a" }} />
      <div style={{ position: "absolute", left: -4, top: 200, width: 4, height: 50, borderRadius: "2px 0 0 2px", background: "#2a2a2a" }} />

      {/* Right side button (power) */}
      <div style={{ position: "absolute", right: -4, top: 310, width: 4, height: 90, borderRadius: "0 2px 2px 0", background: "#2a2a2a" }} />

      {/* Screen area */}
      <div
        style={{
          position: "absolute",
          top: SCREEN_INSET,
          left: SCREEN_INSET,
          width: SCREEN_W,
          height: SCREEN_H,
          borderRadius: SCREEN_RADIUS,
          overflow: "hidden",
          background: "#000",
        }}
      >
        {/* Screen recording video — scaled 2x to fill the screen */}
        {screenVideoUrl ? (
          <OffthreadVideo
            src={screenVideoUrl}
            startFrom={startFrom}
            muted
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: SCREEN_W,
              height: SCREEN_H,
              objectFit: "cover",
            }}
          />
        ) : (
          // Fallback: dark gradient when no video
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `linear-gradient(180deg, #0a0a1a 0%, ${accentColor}22 50%, #0a0a1a 100%)`,
            }}
          />
        )}

        {/* Screen glare — subtle white shine top-left */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "50%",
            background: "radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.06) 0%, transparent 60%)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Dynamic Island */}
      <div
        style={{
          position: "absolute",
          top: SCREEN_INSET + 16,
          left: "50%",
          transform: "translateX(-50%)",
          width: 130,
          height: 36,
          borderRadius: 20,
          background: "#0a0a0a",
          zIndex: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.8)",
        }}
      />

      {/* Home indicator */}
      <div
        style={{
          position: "absolute",
          bottom: SCREEN_INSET + 10,
          left: "50%",
          transform: "translateX(-50%)",
          width: 120,
          height: 5,
          borderRadius: 3,
          background: "rgba(255,255,255,0.25)",
          zIndex: 10,
        }}
      />

      {/* Rim light — accent color glow on the phone edge */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: BODY_RADIUS,
          boxShadow: `inset 0 0 0 1px ${accentColor}18`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
