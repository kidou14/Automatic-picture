import React from "react";
import { Img, interpolate, staticFile, Easing } from "remotion";

// Canvas layout constants
export const FRAME_TOP = 200;       // where device screen starts in canvas
export const FRAME_HEIGHT = 1660;   // device screen height in canvas
export const SS_WIDTH = 1080;       // screenshot native width
export const SS_HEIGHT = 2338;      // screenshot native height

/** Map a native-pixel y coordinate in a screenshot (at a given scrollOffset)
 *  to the corresponding y in the Remotion canvas. */
export function ssYToCanvas(nativeY: number, scrollOffset = 0): number {
  return FRAME_TOP + nativeY - scrollOffset;
}

interface ScreenshotLayer {
  file: string;          // staticFile path
  scrollOffset?: number; // how many native px the image is shifted up (default 0)
}

interface Props {
  frame: number;
  layers: [ScreenshotLayer, ScreenshotLayer?]; // [from, to?] — if to exists, crossfade
  crossfadeStart?: number;  // frame when crossfade begins
  crossfadeDuration?: number; // default 15
  enterFrame?: number;        // frame when the whole viewer enters (3D tilt)
  fps?: number;
}

export const ScreenshotViewer: React.FC<Props> = ({
  frame,
  layers,
  crossfadeStart,
  crossfadeDuration = 15,
  enterFrame = 0,
  fps = 30,
}) => {
  const [from, to] = layers;

  // 3D perspective entrance
  const ENTER_DURATION = 35;
  const enterProgress = Math.min(1, Math.max(0, (frame - enterFrame) / ENTER_DURATION));
  const rotateX = interpolate(enterProgress, [0, 1], [22, 0], {
    easing: Easing.out(Easing.cubic),
  });
  const translateY = interpolate(enterProgress, [0, 1], [120, 0], {
    easing: Easing.out(Easing.cubic),
  });
  const entryOpacity = interpolate(enterProgress, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Crossfade alpha
  let fromAlpha = 1;
  let toAlpha = 0;
  if (to && crossfadeStart !== undefined) {
    const rel = frame - crossfadeStart;
    toAlpha = interpolate(rel, [0, crossfadeDuration], [0, 1], {
      easing: Easing.inOut(Easing.sin),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    fromAlpha = 1 - toAlpha;
  }

  const imgStyle = (scrollOffset = 0): React.CSSProperties => ({
    width: SS_WIDTH,
    height: SS_HEIGHT,
    objectFit: "cover",
    objectPosition: "top",
    display: "block",
    marginTop: -scrollOffset,
  });

  return (
    <div
      style={{
        position: "absolute",
        top: FRAME_TOP,
        left: 0,
        width: SS_WIDTH,
        height: FRAME_HEIGHT,
        overflow: "hidden",
        opacity: entryOpacity,
        transform: `perspective(1400px) rotateX(${rotateX}deg) translateY(${translateY}px)`,
        transformOrigin: "top center",
        borderRadius: "0 0 32px 32px",
      }}
    >
      {/* From layer */}
      <div style={{ position: "absolute", top: 0, left: 0, width: SS_WIDTH, height: SS_HEIGHT, opacity: fromAlpha }}>
        <Img src={staticFile(from.file)} style={imgStyle(from.scrollOffset)} />
      </div>

      {/* To layer */}
      {to && (
        <div style={{ position: "absolute", top: 0, left: 0, width: SS_WIDTH, height: SS_HEIGHT, opacity: toAlpha }}>
          <Img src={staticFile(to.file)} style={imgStyle(to.scrollOffset)} />
        </div>
      )}

      {/* Bottom fade to blend with background */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 260,
          background: "linear-gradient(to bottom, transparent, #050714)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
