/**
 * pipeline.js — V3 URL → MP4 pipeline (6 steps)
 *
 *  1. Playwright: initial screenshot + DOM metadata
 *  2. Claude API: interaction plan
 *  3. Playwright: execute plan + record video + track timestamps
 *  4. FFmpeg: webm → mp4
 *  5. Build MockupScript JSON
 *  6. Remotion render → final MP4
 */
const path = require("path");
const fs = require("fs");
const { captureInitial, recordInteractions } = require("./capture");
const { planInteractions } = require("./analyze");
const { convertWebmToMp4 } = require("./convert");
const { renderScript } = require("./render");
const { generateBackground } = require("./background");

const ROOT_DIR = path.resolve(__dirname, "..");
const SESSIONS_DIR = path.join(ROOT_DIR, "sessions");
const OUTPUT_DIR = path.join(ROOT_DIR, "output");

// Frame budgets at 60fps
const FRAME_INTRO = 120;
const FRAME_INTERACTION = 150;
const FRAME_RESULT = 120;
const FRAME_OUTRO = 100;

/**
 * Convert a timestamp (ms relative to t0) into a Remotion startFrom frame number.
 * startFrom tells Remotion which frame of the video to start playing from,
 * expressed in the composition's FPS (60).
 *
 * The recorded video is ~30fps internally; Remotion's <Video> component
 * handles the fps difference automatically when startFrom is in comp-fps.
 */
function msToFrame(ms) {
  return Math.max(0, Math.round(ms / 1000 * 60));
}

async function runPipeline(url, sessionId, emit) {
  const sessionDir = path.join(SESSIONS_DIR, sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // ── Step 1 ────────────────────────────────────────────────────────────────
  emit({ step: 1, total: 6, message: "Capturing page screenshots…" });
  const { ssFile, aiSsFile, ssHeight, metadata } = await captureInitial(url, sessionDir);
  const aiSsPath = path.join(sessionDir, aiSsFile);

  // ── Step 2 ────────────────────────────────────────────────────────────────
  emit({ step: 2, total: 6, message: "AI is analyzing page features…" });
  const plan = await planInteractions(url, metadata, aiSsPath);
  console.log(`[pipeline] Plan: ${plan.product_name} — ${plan.steps.length} steps`);
  fs.writeFileSync(path.join(sessionDir, "plan.json"), JSON.stringify(plan, null, 2));

  // Launch background video generation in parallel — Seedance takes 2-3 min so
  // we start it now and await the result just before the Remotion render.
  const bgPromise = generateBackground(plan, sessionDir).catch((err) => {
    console.warn("[pipeline] AI background failed (non-fatal):", err.message);
    return null;
  });

  // ── Step 3 ────────────────────────────────────────────────────────────────
  emit({ step: 3, total: 6, message: "Recording interaction video…" });
  const { interactions, timeline, webmPath, resultMs } = await recordInteractions(url, plan, sessionDir);
  fs.writeFileSync(path.join(sessionDir, "timeline.json"), JSON.stringify({ timeline, resultMs }, null, 2));
  console.log(`[pipeline] Recorded ${timeline.length} steps, total ${(resultMs / 1000).toFixed(1)}s`);

  // ── Step 4 ────────────────────────────────────────────────────────────────
  emit({ step: 4, total: 6, message: "Converting video format…" });
  const mp4Path = path.join(sessionDir, "screen.mp4");
  await convertWebmToMp4(webmPath, mp4Path);

  // ── Step 5 ────────────────────────────────────────────────────────────────
  emit({ step: 5, total: 6, message: "Finalizing AI background video…" });
  const bgPath = await bgPromise; // waits here only if Seedance is still running

  const baseUrl = `http://localhost:${process.env.PORT || 4322}/sessions/${sessionId}`;
  const screenVideoUrl = `${baseUrl}/screen.mp4`;

  const scenes = [];
  const RESULT_DURATION_MS = FRAME_RESULT / 60 * 1000;

  // Interaction scenes — synced to timeline timestamps
  const interactionCount = interactions.length;
  for (let i = 0; i < interactionCount - 1; i++) {
    const intr = interactions[i];
    const t = timeline[i] || {};
    // video_start_ms: 500ms before the "before" state to give visual context
    const videoStartMs = Math.max(0, (t.before_ms ?? 0) - 500);
    const clickMs = t.click_ms ?? t.before_ms ?? 0;

    scenes.push({
      type: "interaction",
      duration: FRAME_INTERACTION,
      video_start_ms: videoStartMs,
      click_ms: clickMs,
      click_x: intr.click_x,
      click_y: intr.click_y,
      scroll_before: intr.scroll_before,
      callout_text: intr.callout_text,
      step_number: i + 1,
    });
  }

  // Result — last interaction or initial screenshot
  // Cap video_start_ms so the result scene never seeks past the recording end.
  if (interactionCount > 0) {
    const last = interactions[interactionCount - 1];
    const lastT = timeline[interactionCount - 1] || {};
    const rawStart = Math.max(0, (lastT.after_ms ?? resultMs) - 500);
    // Ensure at least RESULT_DURATION_MS + 500ms buffer remains in the recording
    const maxStart = Math.max(0, resultMs - RESULT_DURATION_MS - 500);
    const videoStartMs = Math.min(rawStart, maxStart);
    scenes.push({
      type: "result",
      duration: FRAME_RESULT,
      video_start_ms: videoStartMs,
      callout_text: last.callout_text,
    });
  } else {
    scenes.push({
      type: "result",
      duration: FRAME_RESULT,
      video_start_ms: 0,
      callout_text: "Explore the features",
    });
  }

  // Intro — shows the loaded page just before the first interaction so the
  // video plays continuously from intro into interaction 1 (no jump cut).
  const firstInteractionVideoStartMs =
    scenes.find((s) => s.type === "interaction")?.video_start_ms ??
    scenes.find((s) => s.type === "result")?.video_start_ms ??
    0;
  const introVideoStartMs = Math.max(0, firstInteractionVideoStartMs - FRAME_INTRO / 60 * 1000);
  scenes.unshift({
    type: "intro",
    duration: FRAME_INTRO,
    title: plan.product_name,
    subtitle: plan.tagline,
    video_start_ms: introVideoStartMs,
  });

  // Outro
  scenes.push({
    type: "outro",
    duration: FRAME_OUTRO,
    cta: `Try ${plan.product_name}`,
  });

  const bgVideoUrl = bgPath ? `${baseUrl}/background.mp4` : null;
  if (bgVideoUrl) console.log("[pipeline] AI background ready:", bgVideoUrl);

  const script = {
    product_name: plan.product_name,
    tagline: plan.tagline,
    accent_color: plan.accent_color || "#6366f1",
    screen_video_url: screenVideoUrl,
    background_video_url: bgVideoUrl || undefined,
    style_seed: sessionId,
    scenes,
  };

  fs.writeFileSync(path.join(sessionDir, "script.json"), JSON.stringify(script, null, 2));

  // ── Step 6 ────────────────────────────────────────────────────────────────
  const outputPath = path.join(OUTPUT_DIR, `${sessionId}.mp4`);
  emit({ step: 6, total: 6, message: "Rendering video…", renderProgress: 0 });

  await renderScript(script, outputPath, (pct) => {
    emit({ step: 6, total: 6, message: `Rendering video… ${pct}%`, renderProgress: pct });
  });

  const videoUrl = `/output/${sessionId}.mp4`;
  emit({ done: true, videoUrl, message: "Done!" });
  return videoUrl;
}

module.exports = { runPipeline };
