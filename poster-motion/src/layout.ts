/**
 * Shared vertical layout constants — all values as fractions of banner height.
 *
 * titleTop  : [MARGIN_V] text [TEXT_GAP] phone [MARGIN_V]
 * titleBottom: [MARGIN_V] phone [TEXT_GAP] text [MARGIN_V]
 */

export const MARGIN_V = 0.07;  // equal top & bottom clearance
export const TEXT_H   = 0.20;  // text strip height
export const TEXT_GAP = 0.03;  // gap between text and phone mockup

/** First pixel of the image area (titleTop) or text area (titleBottom) */
export const IMG_OFFSET = MARGIN_V + TEXT_H + TEXT_GAP; // 0.30
