/**
 * StyleConfig.ts
 * 13-dimension visual style system for GenericPromo.
 * Each dimension is independently selectable; buildStyleConfig() derives
 * a deterministic combination from a seed string.
 */

// ─── Dimension types ──────────────────────────────────────────────────────────

/** A: Background atmosphere */
export type StyleA = 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A7' | 'A8' | 'A9' | 'A10';
/** B: Device / screen frame */
export type StyleB = 'B1' | 'B2' | 'B3' | 'B4' | 'B5' | 'B6' | 'B7';
/** C: Scene entrance transition style */
export type StyleC = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C8' | 'C9';
/** D: Pre-click attention guide */
export type StyleD = 'D1' | 'D3' | 'D9';
/** E: After-state reveal */
export type StyleE = 'E1' | 'E2' | 'E6';
/** F: Callout / subtitle style */
export type StyleF = 'F1' | 'F2' | 'F3' | 'F5' | 'F6' | 'F8' | 'F9';
/** G: Cursor style */
export type StyleG = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7' | 'G8' | 'G9';
/** H: Intro opening style */
export type StyleH = 'H1' | 'H2' | 'H3' | 'H4' | 'H5';
/** I: Outro ending style */
export type StyleI = 'I1' | 'I2' | 'I3' | 'I5' | 'I6';
/** J: Screenshot motion (Ken Burns / scroll) */
export type StyleJ = 'J1' | 'J2' | 'J3' | 'J4' | 'J5' | 'J6' | 'J7';
/** K: Scene entry direction */
export type StyleK = 'K1' | 'K2' | 'K3' | 'K4' | 'K5' | 'K6';
/** L: Global color temperature tint */
export type StyleL = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';
/** N: Callout position anchor */
export type StyleN = 'N1' | 'N2' | 'N3' | 'N4' | 'N5';

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
  K: StyleK;
  L: StyleL;
  N: StyleN;
}

// ─── Defaults (original hardcoded behaviour) ─────────────────────────────────

export const DEFAULT_STYLE: StyleConfig = {
  A: 'A1', B: 'B1', C: 'C1', D: 'D1', E: 'E1',
  F: 'F1', G: 'G1', H: 'H1', I: 'I1', J: 'J1',
  K: 'K1', L: 'L1', N: 'N1',
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
    A: pick<StyleA>(['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10'], rng),
    B: pick<StyleB>(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'], rng),
    C: pick<StyleC>(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C8', 'C9'], rng),
    D: pick<StyleD>(['D1', 'D3', 'D9'], rng),
    E: pick<StyleE>(['E1', 'E2', 'E6'], rng),
    F: pick<StyleF>(['F1', 'F2', 'F3', 'F5', 'F6', 'F8', 'F9'], rng),
    G: pick<StyleG>(['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9'], rng),
    H: pick<StyleH>(['H1', 'H2', 'H3', 'H4', 'H5'], rng),
    I: pick<StyleI>(['I1', 'I2', 'I3', 'I5', 'I6'], rng),
    J: pick<StyleJ>(['J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7'], rng),
    K: pick<StyleK>(['K1', 'K2', 'K3', 'K4', 'K5', 'K6'], rng),
    L: pick<StyleL>(['L1', 'L2', 'L3', 'L4', 'L5', 'L6'], rng),
    N: pick<StyleN>(['N1', 'N2', 'N3', 'N4', 'N5'], rng),
  };
}
