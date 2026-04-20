/**
 * CameraRig.tsx — CSS 3D perspective animation system
 *
 * Wraps PhoneMockup in a perspective container and animates:
 *   rotateX, rotateY, scale, translateY
 * based on the current scene type and a camera preset (P1/P2/P3).
 *
 * Three presets (driven by style_seed):
 *   P1 "Cinematic Push" — starts at angle, slow push to straight
 *   P2 "Float Orbit"    — constant gentle rotation
 *   P3 "Snap Focus"     — quick snap to straight, then near-static
 */
import React from "react";
import { interpolate, spring, Easing } from "remotion";
import { StyleP } from "../styles/StyleConfig";
import { PHONE_W, PHONE_H } from "./PhoneMockup";

interface Props {
  frame: number;            // global composition frame
  localFrame: number;       // frame within current scene
  fps: number;
  sceneType: "intro" | "interaction" | "result" | "outro";
  sceneIndex: number;       // which scene (0-based) for transition timing
  cameraPreset: StyleP;
  children: React.ReactNode;
}

const W = 1080;
const H = 1920;

export const CameraRig: React.FC<Props> = ({
  frame,
  localFrame,
  fps,
  sceneType,
  sceneIndex,
  cameraPreset,
  children,
}) => {
  let rotX = 0;
  let rotY = 0;
  let scale = 1;
  let translateY = 0;

  if (cameraPreset === "P1") {
    // Cinematic Push: dramatic angled entry, slow push to straight
    if (sceneType === "intro") {
      const push = spring({ frame: localFrame, fps, config: { damping: 20, stiffness: 50 }, durationInFrames: 100 });
      rotY = interpolate(push, [0, 1], [32, 0]);
      rotX = interpolate(push, [0, 1], [12, 1.5]);
      scale = interpolate(push, [0, 1], [0.72, 1.0]);
      translateY = interpolate(push, [0, 1], [180, 0]);
    } else if (sceneType === "interaction") {
      // Continuous breathing — more pronounced than before
      rotX = 2.5 + Math.sin(frame * 0.025) * 1.2;
      rotY = Math.sin(frame * 0.018) * 3.0;
      scale = 1 + Math.sin(frame * 0.022) * 0.008;
    } else if (sceneType === "result") {
      const pullBack = spring({ frame: localFrame, fps, config: { damping: 22, stiffness: 70 }, durationInFrames: 70 });
      rotX = interpolate(pullBack, [0, 1], [2, 4]);
      rotY = interpolate(pullBack, [0, 1], [0, -6]);
      scale = interpolate(pullBack, [0, 1], [1.0, 0.92]);
    } else if (sceneType === "outro") {
      translateY = interpolate(localFrame, [0, 55], [0, 2600], {
        easing: Easing.in(Easing.cubic),
        extrapolateRight: "clamp",
      });
    }
  } else if (cameraPreset === "P2") {
    // Float Orbit: continuous organic rotation throughout
    const introEnter = sceneType === "intro"
      ? spring({ frame: localFrame, fps, config: { damping: 26, stiffness: 55 }, durationInFrames: 90 })
      : 1;
    const entryScale = sceneType === "intro" ? interpolate(introEnter, [0, 1], [0.78, 1]) : 1;
    const entryY = sceneType === "intro" ? interpolate(introEnter, [0, 1], [220, 0]) : 0;
    const baseAmp = 9;
    rotY = Math.sin(frame * 0.016) * baseAmp;
    rotX = Math.cos(frame * 0.012) * (baseAmp * 0.5);
    scale = (0.96 + Math.sin(frame * 0.019) * 0.018) * entryScale;
    translateY = entryY;

    if (sceneType === "outro") {
      const fadeScale = interpolate(localFrame, [0, 65], [1, 0], {
        easing: Easing.in(Easing.cubic),
        extrapolateRight: "clamp",
      });
      scale *= fadeScale;
    }
  } else {
    // P3 Snap Focus: aggressive snap entry, then deliberate near-static
    if (sceneType === "intro") {
      const snap = spring({ frame: localFrame, fps, config: { damping: 12, stiffness: 260 }, durationInFrames: 35 });
      rotY = interpolate(snap, [0, 1], [28, 0]);
      rotX = interpolate(snap, [0, 1], [10, 0]);
      scale = interpolate(snap, [0, 1], [0.8, 1.0]);
      translateY = interpolate(snap, [0, 1], [140, 0]);
    } else if (sceneType === "interaction") {
      rotX = Math.sin(frame * 0.018) * 1.2;
      rotY = Math.cos(frame * 0.014) * 1.5;
    } else if (sceneType === "result") {
      rotX = 1 + Math.sin(frame * 0.018) * 0.8;
      rotY = Math.cos(frame * 0.014) * 1.2;
      scale = 0.97 + Math.sin(frame * 0.02) * 0.005;
    } else if (sceneType === "outro") {
      scale = interpolate(localFrame, [0, 75], [1, 0], {
        easing: Easing.in(Easing.quad),
        extrapolateRight: "clamp",
      });
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: W,
        height: H,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        perspective: "2400px",
        perspectiveOrigin: "50% 40%",
      }}
    >
      <div
        style={{
          transform: `rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${scale}) translateY(${translateY}px)`,
          transformStyle: "preserve-3d",
          // Slight vertical offset to keep phone centered in frame
          marginTop: -40,
        }}
      >
        {children}
      </div>
    </div>
  );
};
