/**
 * pipeline.js — Orchestrates the full URL → MP4 pipeline
 *
 * Steps:
 *  1. Playwright: initial screenshot + DOM metadata
 *  2. Claude API: interaction plan
 *  3. Playwright: execute plan → screenshots + coords
 *  4. Build GenericPromo Script JSON
 *  5. Remotion render → MP4
 */
const path = require("path");
const fs = require("fs");
const { captureInitial, executeInteractionPlan } = require("./capture");
const { planInteractions } = require("./analyze");
const { renderScript } = require("./render");

const ROOT_DIR = path.resolve(__dirname, "..");
const SESSIONS_DIR = path.join(ROOT_DIR, "sessions");
const OUTPUT_DIR = path.join(ROOT_DIR, "output");

// Per-scene frame budgets
const FRAME_INTRO = 50;
const FRAME_INTERACTION = 58;
const FRAME_RESULT = 65;
const FRAME_OUTRO = 40;

/**
 * Run the full pipeline.
 * @param {string} url
 * @param {string} sessionId
 * @param {(update: object) => void} emit  — progress emitter
 * @returns {string} videoUrl (relative to server root)
 */
async function runPipeline(url, sessionId, emit) {
  const sessionDir = path.join(SESSIONS_DIR, sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // ── Step 1: initial capture ──────────────────────────────────────────────
  emit({ step: 1, total: 5, message: "Capturing page screenshots…" });
  const { ssFile, aiSsFile, ssHeight, metadata } = await captureInitial(url, sessionDir);
  const aiSsPath = path.join(sessionDir, aiSsFile);

  // ── Step 2: AI interaction planning ─────────────────────────────────────
  emit({ step: 2, total: 5, message: "AI is analyzing page features…" });
  const plan = await planInteractions(url, metadata, aiSsPath);
  console.log(`[pipeline] AI plan: ${plan.product_name} — ${plan.steps.length} steps`);

  // Save plan for debugging
  fs.writeFileSync(
    path.join(sessionDir, "plan.json"),
    JSON.stringify(plan, null, 2)
  );

  // ── Step 3: execute interactions ─────────────────────────────────────────
  emit({ step: 3, total: 5, message: "Executing interactions & capturing frames…" });
  const { interactions, ssHeights } = await executeInteractionPlan(url, plan, sessionDir);

  // ── Step 4: build Script JSON ────────────────────────────────────────────
  emit({ step: 4, total: 5, message: "Building animation script…" });

  const baseUrl = `http://localhost:${process.env.PORT || 4320}/sessions/${sessionId}`;

  const scenes = [];

  // Intro scene
  scenes.push({
    type: "intro",
    duration: FRAME_INTRO,
    title: plan.product_name,
    subtitle: plan.tagline,
  });

  // Interaction scenes (all except last)
  const interactionCount = interactions.length;
  for (let i = 0; i < interactionCount - 1; i++) {
    const intr = interactions[i];
    scenes.push({
      type: "interaction",
      duration: FRAME_INTERACTION,
      before_url: `${baseUrl}/${intr.before_ss}`,
      after_url: `${baseUrl}/${intr.after_ss}`,
      ss_height: intr.ss_height || ssHeight,
      scroll_before: intr.scroll_before,
      scroll_after: intr.scroll_after,
      click_x: intr.click_x,
      click_y: intr.click_y,
      callout_text: intr.callout_text,
      callout_side: i % 2 === 0 ? "right" : "left",
      step_number: i + 1,
    });
  }

  // Last interaction → result scene
  if (interactionCount > 0) {
    const last = interactions[interactionCount - 1];
    scenes.push({
      type: "result",
      duration: FRAME_RESULT,
      screenshot_url: `${baseUrl}/${last.after_ss}`,
      ss_height: last.ss_height || ssHeight,
      scroll: last.scroll_after,
      callout_text: last.callout_text,
    });
  } else {
    // Fallback: show initial screenshot as result
    scenes.push({
      type: "result",
      duration: FRAME_RESULT,
      screenshot_url: `${baseUrl}/${ssFile}`,
      ss_height: ssHeight,
      scroll: 0,
      callout_text: "Explore the features",
    });
  }

  // Outro
  scenes.push({
    type: "outro",
    duration: FRAME_OUTRO,
    cta: `Try ${plan.product_name}`,
  });

  const script = {
    product_name: plan.product_name,
    tagline: plan.tagline,
    accent_color: plan.accent_color || "#6366f1",
    url,
    style_seed: sessionId, // deterministic per-session style variety (A–J dimensions)
    scenes,
  };

  fs.writeFileSync(
    path.join(sessionDir, "script.json"),
    JSON.stringify(script, null, 2)
  );

  // ── Step 5: Remotion render ───────────────────────────────────────────────
  const outputPath = path.join(OUTPUT_DIR, `${sessionId}.mp4`);
  emit({ step: 5, total: 5, message: "Rendering video…", renderProgress: 0 });

  await renderScript(script, outputPath, (pct) => {
    emit({ step: 5, total: 5, message: `Rendering video… ${pct}%`, renderProgress: pct });
  });

  const videoUrl = `/output/${sessionId}.mp4`;
  emit({ done: true, videoUrl, message: "Done!" });
  return videoUrl;
}

module.exports = { runPipeline };
