/**
 * concat.js — FFmpeg-based video concatenation with xfade transitions
 * Normalizes all clips to a common resolution then joins with 0.4s fade.
 */
const { execFile } = require("child_process");
const util = require("util");
const fs = require("fs");
const path = require("path");

const execFileAsync = util.promisify(execFile);

// Output video resolution (portrait 9:16 — 1080×1920)
const OUTPUT_W = 1080;
const OUTPUT_H = 1920;
const TRANSITION_DURATION = 0.4; // seconds for xfade between clips

/**
 * Get video duration in seconds via ffprobe.
 */
async function getVideoDuration(filePath) {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "quiet",
      "-print_format", "json",
      "-show_streams",
      filePath,
    ]);
    const info = JSON.parse(stdout);
    const videoStream = info.streams.find((s) => s.codec_type === "video");
    return parseFloat(videoStream?.duration || "5");
  } catch {
    return 5; // fallback assumption
  }
}

/**
 * Normalize a clip to OUTPUT_W×OUTPUT_H, H.264, no audio.
 */
async function normalizeClip(inputPath, outputPath) {
  await execFileAsync("ffmpeg", [
    "-i", inputPath,
    "-vf",
    `scale=${OUTPUT_W}:${OUTPUT_H}:force_original_aspect_ratio=decrease,` +
    `pad=${OUTPUT_W}:${OUTPUT_H}:(ow-iw)/2:(oh-ih)/2:black`,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-an",
    "-y",
    outputPath,
  ]);
}

/**
 * Concatenate clips with crossfade transitions.
 * @param {string[]} clipPaths - paths to input MP4 clips
 * @param {string}   outputPath - path for the final MP4
 */
async function concatenateClips(clipPaths, outputPath) {
  if (clipPaths.length === 0) throw new Error("No clips to concatenate");

  const workDir = path.dirname(outputPath);
  const normalizedPaths = [];

  // Step 1: normalize all clips to the same resolution
  console.log(`[concat] Normalizing ${clipPaths.length} clips to ${OUTPUT_W}×${OUTPUT_H}…`);
  for (let i = 0; i < clipPaths.length; i++) {
    const norm = path.join(workDir, `_norm_${i}.mp4`);
    await normalizeClip(clipPaths[i], norm);
    normalizedPaths.push(norm);
  }

  if (normalizedPaths.length === 1) {
    // Single clip — just copy
    await execFileAsync("ffmpeg", ["-i", normalizedPaths[0], "-c", "copy", "-y", outputPath]);
    fs.unlink(normalizedPaths[0], () => {});
    return;
  }

  // Step 2: get each clip's duration for xfade offset calculation
  const durations = await Promise.all(normalizedPaths.map(getVideoDuration));
  console.log(`[concat] Clip durations: ${durations.map((d) => d.toFixed(2) + "s").join(", ")}`);

  // Step 3: build xfade filter_complex chain
  // xfade offset = sum of previous clips' durations minus accumulated transition time
  const inputs = normalizedPaths.flatMap((p) => ["-i", p]);
  const filterParts = [];
  let offset = 0;
  let lastLabel = "[0:v]";

  for (let i = 1; i < normalizedPaths.length; i++) {
    offset += durations[i - 1] - TRANSITION_DURATION;
    const outLabel = i === normalizedPaths.length - 1 ? "[vout]" : `[v${i}]`;
    filterParts.push(
      `${lastLabel}[${i}:v]xfade=transition=fade:duration=${TRANSITION_DURATION}:offset=${offset.toFixed(3)}${outLabel}`
    );
    lastLabel = outLabel;
  }

  console.log(`[concat] Building xfade chain with ${filterParts.length} transitions…`);

  await execFileAsync("ffmpeg", [
    ...inputs,
    "-filter_complex", filterParts.join(";"),
    "-map", "[vout]",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-y",
    outputPath,
  ]);

  // Cleanup normalized intermediates
  for (const p of normalizedPaths) {
    fs.unlink(p, () => {});
  }

  console.log(`[concat] Done → ${outputPath}`);
}

module.exports = { concatenateClips };
