/**
 * StyleConfig.ts — V3 simplified 4-dimension style system
 */

/** P: Camera motion preset */
export type StyleP = "P1" | "P2" | "P3";
/** F: Callout text style */
export type StyleF = "F1" | "F5" | "F8";
/** H: Intro text opening */
export type StyleH = "H1" | "H4" | "H5";
/** I: Outro ending */
export type StyleI = "I1" | "I5" | "I6";

export interface StyleConfig {
  P: StyleP;
  F: StyleF;
  H: StyleH;
  I: StyleI;
}

export const DEFAULT_STYLE: StyleConfig = {
  P: "P1",
  F: "F1",
  H: "H1",
  I: "I1",
};

function seededRng(seed: string): () => number {
  let s = 0;
  for (let i = 0; i < seed.length; i++) {
    s = ((s << 5) - s + seed.charCodeAt(i)) | 0;
  }
  s = s === 0 ? 0x5eed : s;
  return function () {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function buildStyleConfig(seed: string): StyleConfig {
  const rng = seededRng(seed);
  return {
    P: pick<StyleP>(["P1", "P2", "P3"], rng),
    F: pick<StyleF>(["F1", "F5", "F8"], rng),
    H: pick<StyleH>(["H1", "H4", "H5"], rng),
    I: pick<StyleI>(["I1", "I5", "I6"], rng),
  };
}
