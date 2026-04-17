import React from "react";
import { Composition } from "remotion";
import { SignalPlusLoading } from "./compositions/SignalPlusLoading";
import { EvCalcPromo } from "./compositions/EvCalcPromo";
import { GenericPromo, type PromoScript } from "./compositions/GenericPromo";

const defaultScript: PromoScript = {
  product_name: "Your Product",
  tagline: "See what it can do",
  accent_color: "#6366f1",
  scenes: [
    { type: "intro", duration: 50, title: "Your Product", subtitle: "See what it can do" },
    { type: "outro", duration: 40, cta: "Try Your Product" },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Generic data-driven promo — duration computed from script */}
      <Composition
        id="GenericPromo"
        component={GenericPromo}
        calculateMetadata={async ({ props }) => {
          const total = (props as { script: PromoScript }).script?.scenes?.reduce(
            (sum, s) => sum + (s.duration || 0),
            0
          ) || 300;
          return { durationInFrames: total, fps: 30, width: 1080, height: 1920 };
        }}
        defaultProps={{ script: defaultScript }}
      />

      {/* EV Calculator product promo tutorial — 10s, 9:16, 1080×1920 */}
      <Composition
        id="EvCalcPromo"
        component={EvCalcPromo}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
      />

      {/* SignalPlus Lottie-style loading animation — 3s seamless loop, 400×400 */}
      <Composition
        id="SignalPlusLoading"
        component={SignalPlusLoading}
        durationInFrames={90}
        fps={30}
        width={400}
        height={400}
      />
    </>
  );
};
