/**
 * StyleConfig.ts
 * 10-dimension visual style system for GenericPromo.
 * Each dimension is independently selectable; buildStyleConfig() derives
 * a deterministic combination from a seed string.
 */

// ─── Dimension types ──────────────────────────────────────────────────────────

/** A: Background atmosphere */
export type StyleA = 'A1' | 'A2' | 'A6' | 'A10';
/** B: Device / screen frame */
export type StyleB = 'B1' | 'B4';
/** C: Scene entrance transition */
export type StyleC = 'C1' | 'C4' | 'C7' | 'C9';
/** D: Pre-click attention guide */
export type StyleD = 'D1' | 'D3' | 'D9';
/** E: After-state reveal */
export type StyleE = 'E1' | 'E2' | 'E6';
/** F: Callout / subtitle style */
export type StyleF = 'F1' | 'F5' | 'F8';
/** G: Cursor style */
export type StyleG = 'G1' | 'G3' | 'G6';
/** H: Intro opening style */
export type StyleH = 'H1' | 'H4' | 'H5';
/** I: Outro ending style */
export type StyleI = 'I1' | 'I5' | 'I6';
/** J: Screenshot motion */
export type StyleJ = 'J1' | 'J2' | 'J4';

export interface StyleConfig {
  A: StyleA;
  B: StyleB;
  C: StyleC;
  D: StyleD;
  E: StyleE;
  F: StyleF;
  G: StyleG;
  H: StyleH;
  I: StyleI;
  J: StyleJ;
}

// ─── Defaults (original hardcoded behaviour) ─────────────────────────────────

export const DEFAULT_STYLE: StyleConfig = {
  A: 'A1', B: 'B1', C: 'C1', D: 'D1', E: 'E1',
  F: 'F1', G: 'G1', H: 'H1', I: 'I1', J: 'J1',
};

// ─── Seeded random picker ─────────────────────────────────────────────────────

/** xorshift32 PRNG — deterministic, no Math.random() */
function seededRng(seed: string): () => number {
  let s = 0;
  for (let i = 0; i < seed.length; i++) {
    s = ((s << 5) - s + seed.charCodeAt(i)) | 0;
  }
  s = s === 0 ? 0x5EED : s;
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

/**
 * Derive a complete StyleConfig from a seed string.
 * Same seed always produces the same combination.
 */
export function buildStyleConfig(seed: string): StyleConfig {
  const rng = seededRng(seed);
  return {
    A: pick<StyleA>(['A1', 'A2', 'A6', 'A10'], rng),
    B: pick<StyleB>(['B1', 'B4'], rng),
    C: pick<StyleC>(['C1', 'C4', 'C7', 'C9'], rng),
    D: pick<StyleD>(['D1', 'D3', 'D9'], rng),
    E: pick<StyleE>(['E1', 'E2', 'E6'], rng),
    F: pick<StyleF>(['F1', 'F5', 'F8'], rng),
    G: pick<StyleG>(['G1', 'G3', 'G6'], rng),
    H: pick<StyleH>(['H1', 'H4', 'H5'], rng),
    I: pick<StyleI>(['I1', 'I5', 'I6'], rng),
    J: pick<StyleJ>(['J1', 'J2', 'J4'], rng),
  };
}
