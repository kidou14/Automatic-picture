/**
 * background.js — Generate abstract cinematic background video via Seedance
 *
 * Runs in parallel with Steps 3-4 (Playwright + FFmpeg).
 * No screenshot — purely text-driven, so zero hallucination risk.
 * The result is a 5s looping abstract atmosphere video in brand colors.
 */
const path = require("path");
const { generateClip } = require("./seedance");

/**
 * Map a hex accent color to a descriptive color phrase for the Seedance prompt.
 * Rough heuristic — good enough for cinematic atmosphere descriptions.
 */
function hexToColorPhrase(hex) {
  const h = (hex || "#6366f1").replace("#", "").toLowerCase().padEnd(6, "0");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (b > r + 50 && b > g + 30) return "deep blue and violet";
  if (r > b + 60 && r > g + 40) return "deep crimson and red";
  if (g > r + 40 && g > b + 40) return "emerald and teal";
  if (r > 180 && g > 140 && b < 80) return "golden amber and orange";
  if (r > 180 && g < 100 && b > 100) return "magenta and electric purple";
  if (r > 140 && g > 100 && b > 200) return "indigo and periwinkle";
  return "indigo and violet";
}

/**
 * Build a Seedance prompt for a pure abstract background (no UI, no people).
 */
function buildBackgroundPrompt(productName, accentColor) {
  const colorPhrase = hexToColorPhrase(accentColor);
  return (
    `Cinematic abstract technology background, deep dark space atmosphere, ` +
    `${colorPhrase} luminous light rays and floating particles drifting slowly, ` +
    `bokeh depth of field, smooth slow camera drift, luxury digital aesthetic. ` +
    `No text, no UI elements, no people, no products.`
  );
}

/**
 * Generate a 5-second abstract background video for the given product/brand.
 * Falls back gracefully if OPENROUTER_API_KEY is not set.
 *
 * @param {{ product_name: string, accent_color: string }} plan
 * @param {string} sessionDir
 * @returns {Promise<string|null>} path to background.mp4, or null on failure
 */
async function generateBackground(plan, sessionDir) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.log("[background] OPENROUTER_API_KEY not set — skipping AI background");
    return null;
  }

  const prompt = buildBackgroundPrompt(
    plan.product_name || "Product",
    plan.accent_color || "#6366f1"
  );
  const outputPath = path.join(sessionDir, "background.mp4");

  console.log(`[background] Generating: "${prompt.substring(0, 80)}…"`);
  await generateClip(null, prompt, outputPath, 5);
  console.log(`[background] Saved → ${outputPath}`);
  return outputPath;
}

module.exports = { generateBackground };
