import React from "react";
import { Composition } from "remotion";
import { SignalPlusLoading } from "./compositions/SignalPlusLoading";
import { EvCalcPromo } from "./compositions/EvCalcPromo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
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
