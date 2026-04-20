/**
 * BackgroundCinema.tsx — V3 cinematic background
 *
 * When backgroundVideoUrl is provided (Seedance AI-generated):
 *   - Loops the 5s abstract atmosphere video as the base layer
 *   - Overlays brand-color glow and bottom gradient on top
 *
 * Fallback (no video / OPENROUTER_API_KEY not set):
 *   - Pure CSS: drifting radial-gradient blobs in brand color
 */
import React from "react";
import { OffthreadVideo, Sequence } from "remotion";

interface Props {
  frame: number;
  accentColor: string;
  backgroundVideoUrl?: string;
}

const W = 1080;
const H = 1920;

// Background video is generated at 5s; loop it across the full composition
const BG_VIDEO_DURATION_FRAMES = 300; // 5s × 60fps
const BG_LOOPS = 5; // covers up to 25s = any realistic composition length

export const BackgroundCinema: React.FC<Props> = ({ frame, accentColor, backgroundVideoUrl }) => {
  // Subtle pulse on the accent glow (same for both modes)
  const glowOpacity = 0.08 + Math.sin(frame * 0.04) * 0.025;

  // CSS blob positions (used in fallback mode)
  const blob1X = W * 0.3 + Math.sin(frame * 0.008) * W * 0.12;
  const blob1Y = H * 0.28 + Math.cos(frame * 0.006) * H * 0.06;
  const blob2X = W * 0.72 + Math.cos(frame * 0.007) * W * 0.1;
  const blob2Y = H * 0.6 + Math.sin(frame * 0.009) * H * 0.08;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: W,
        height: H,
        background: "#020510",
        overflow: "hidden",
      }}
    >
      {backgroundVideoUrl ? (
        /* ── AI video mode ─────────────────────────────────────────────────── */
        <>
          {/* Loop the 5s background video for the full composition duration */}
          {Array.from({ length: BG_LOOPS }, (_, i) => (
            <Sequence key={i} from={i * BG_VIDEO_DURATION_FRAMES} durationInFrames={BG_VIDEO_DURATION_FRAMES}>
              <OffthreadVideo
                src={backgroundVideoUrl}
                muted
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: W,
                  height: H,
                  objectFit: "cover",
                }}
              />
            </Sequence>
          ))}

          {/* Darken overlay so the phone mockup stays legible over the video */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(2,5,16,0.52)",
              pointerEvents: "none",
            }}
          />
        </>
      ) : (
        /* ── CSS fallback mode ─────────────────────────────────────────────── */
        <>
          {/* Drifting blob 1 */}
          <div
            style={{
              position: "absolute",
              left: blob1X - 350,
              top: blob1Y - 350,
              width: 700,
              height: 700,
              background: `radial-gradient(circle, ${accentColor}22 0%, transparent 70%)`,
              pointerEvents: "none",
            }}
          />
          {/* Drifting blob 2 */}
          <div
            style={{
              position: "absolute",
              left: blob2X - 280,
              top: blob2Y - 280,
              width: 560,
              height: 560,
              background: `radial-gradient(circle, #818cf822 0%, transparent 70%)`,
              pointerEvents: "none",
            }}
          />
        </>
      )}

      {/* ── Shared overlays (always rendered on top) ────────────────────────── */}

      {/* Primary brand ambient glow */}
      <div
        style={{
          position: "absolute",
          left: W * 0.5 - W * 0.6,
          top: H * 0.15,
          width: W * 1.2,
          height: H * 0.45,
          background: `radial-gradient(ellipse at 50% 40%, ${accentColor} 0%, transparent 65%)`,
          opacity: glowOpacity,
          pointerEvents: "none",
        }}
      />

      {/* Bottom accent uplift */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: W,
          height: 600,
          background: `linear-gradient(to top, ${accentColor}12 0%, transparent 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* Top vignette */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: W,
          height: 300,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
