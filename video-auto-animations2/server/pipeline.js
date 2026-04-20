/**
 * pipeline.js — Orchestrates the full URL → MP4 pipeline (Seedance edition)
 *
 * Steps:
 *  1. Playwright: initial screenshot + DOM metadata
 *  2. Claude API: interaction plan
 *  3. Playwright: execute plan → before/after screenshots
 *  4. Claude API: generate Seedance cinematic prompt per scene
 *  5. Seedance (via Replicate): generate one video clip per scene
 *  6. FFmpeg: xfade-concatenate all clips → final MP4
 */
const path = require("path");
const fs = require("fs");
const { captureInitial, executeInteractionPlan } = require("./capture");
const { planInteractions, generateScenePrompts } = require("./analyze");
const { generateClip, CLIP_DURATION } = require("./seedance");
const { concatenateClips } = require("./concat");

const ROOT_DIR = path.resolve(__dirname, "..");
const SESSIONS_DIR = path.join(ROOT_DIR, "sessions");
const OUTPUT_DIR = path.join(ROOT_DIR, "output");

const MAX_SCENES = 3;

/**
 * Run the full pipeline.
 * @param {string} url
 * @param {string} sessionId
 * @param {(update: object) => void} emit — progress emitter
 * @returns {string} videoUrl (relative to server root)
 */
async function runPipeline(url, sessionId, emit) {
  const sessionDir = path.join(SESSIONS_DIR, sessionId);
  const clipsDir = path.join(sessionDir, "clips");
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.mkdirSync(clipsDir, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // ── Step 1: initial capture ──────────────────────────────────────────────
  emit({ step: 1, total: 6, message: "Capturing page screenshots…" });
  const { ssFile, aiSsFile, metadata } = await captureInitial(url, sessionDir);
  const aiSsPath = path.join(sessionDir, aiSsFile);

  // ── Step 2: AI interaction planning ─────────────────────────────────────
  emit({ step: 2, total: 6, message: "AI is analyzing page features…" });
  const plan = await planInteractions(url, metadata, aiSsPath);
  console.log(`[pipeline] Plan: ${plan.product_name} — ${plan.steps.length} steps`);
  fs.writeFileSync(path.join(sessionDir, "plan.json"), JSON.stringify(plan, null, 2));

  // ── Step 3: execute interactions ─────────────────────────────────────────
  emit({ step: 3, total: 6, message: "Executing interactions & capturing frames…" });
  const { interactions } = await executeInteractionPlan(url, plan, sessionDir);

  // ── Step 4: generate Seedance prompts ───────────────────────────────────
  emit({ step: 4, total: 6, message: "Writing cinematic prompts for each scene…" });

  // Build scene descriptors for Claude
  const sceneList = [];

  // Intro — uses the initial full screenshot
  sceneList.push({
    type: "intro",
    description: `${plan.product_name} — ${plan.tagline}. Opening reveal.`,
    screenshotPath: path.join(sessionDir, ssFile),
    callout_text: plan.tagline,
  });

  // Interaction scenes (all except the last, which becomes the result)
  const interactionCount = interactions.length;
  for (let i = 0; i < interactionCount - 1; i++) {
    const intr = interactions[i];
    sceneList.push({
      type: "interaction",
      description: intr.description || `User ${intr.action}: ${intr.callout_text}`,
      screenshotPath: path.join(sessionDir, intr.before_ss),
      callout_text: intr.callout_text,
    });
  }

  // Result — last interaction's after screenshot
  if (interactionCount > 0) {
    const last = interactions[interactionCount - 1];
    sceneList.push({
      type: "result",
      description: `${plan.product_name} final result: ${last.description || last.callout_text}`,
      screenshotPath: path.join(sessionDir, last.after_ss),
      callout_text: last.callout_text,
    });
  } else {
    sceneList.push({
      type: "result",
      description: `${plan.product_name} key feature showcase`,
      screenshotPath: path.join(sessionDir, ssFile),
      callout_text: "Explore the features",
    });
  }

  // Outro — no screenshot, pure text-to-video
  sceneList.push({
    type: "outro",
    description: `Brand outro. Product: ${plan.product_name}. Tagline: ${plan.tagline}. CTA: Try it free.`,
    screenshotPath: null,
    callout_text: `Try ${plan.product_name}`,
  });

  // Select most representative scenes up to MAX_SCENES
  // Strategy: always keep intro + result; fill middle slots evenly from interactions
  if (sceneList.length > MAX_SCENES) {
    const intro = sceneList[0];
    const result = sceneList.find((s) => s.type === "result") || sceneList[sceneList.length - 2];
    const interactions = sceneList.filter((s) => s.type === "interaction");
    const middleSlots = MAX_SCENES - 2; // slots between intro and result
    const selected = [intro];
    if (middleSlots > 0 && interactions.length > 0) {
      for (let i = 0; i < middleSlots; i++) {
        const idx = Math.round((i / middleSlots) * (interactions.length - 1));
        selected.push(interactions[idx]);
      }
    }
    selected.push(result);
    sceneList.length = 0;
    sceneList.push(...selected);
    console.log(`[pipeline] Trimmed to ${sceneList.length} scenes (MAX_SCENES=${MAX_SCENES})`);
  }

  const seedancePrompts = await generateScenePrompts(plan, sceneList, aiSsPath);
  fs.writeFileSync(
    path.join(sessionDir, "seedance_prompts.json"),
    JSON.stringify(
      sceneList.map((s, i) => ({ scene: s.type, prompt: seedancePrompts[i] })),
      null,
      2
    )
  );
  console.log(`[pipeline] Generated ${seedancePrompts.length} Seedance prompts`);

  // ── Step 5: generate video clips (parallel) ──────────────────────────────
  const totalClips = sceneList.length;
  let completedClips = 0;

  emit({ step: 5, total: 6, message: `Submitting ${totalClips} clips in parallel…`, clipProgress: 0 });

  const clipPaths = await Promise.all(
    sceneList.map(async (scene, i) => {
      const prompt = seedancePrompts[i];
      const clipPath = path.join(clipsDir, `clip_${String(i).padStart(2, "0")}.mp4`);
      await generateClip(scene.screenshotPath, prompt, clipPath, CLIP_DURATION);
      completedClips++;
      emit({
        step: 5,
        total: 6,
        message: `Clip ${completedClips}/${totalClips} ready…`,
        clipProgress: Math.round((completedClips / totalClips) * 100),
      });
      return clipPath;
    })
  );

  // ── Step 6: concatenate ───────────────────────────────────────────────────
  emit({ step: 6, total: 6, message: "Concatenating clips with transitions…" });
  const outputPath = path.join(OUTPUT_DIR, `${sessionId}.mp4`);
  await concatenateClips(clipPaths, outputPath);

  const videoUrl = `/output/${sessionId}.mp4`;
  emit({ done: true, videoUrl, message: "Done!" });
  return videoUrl;
}

module.exports = { runPipeline };
