/**
 * seedance.js — OpenRouter Video API integration for Seedance 2.0
 * Endpoint: POST /api/v1/videos  →  poll until completed  →  download MP4
 */
const fs = require("fs");
const https = require("https");
const http = require("http");

const MODEL = process.env.SEEDANCE_MODEL || "bytedance/seedance-2.0";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

const NEGATIVE_PROMPT =
  "low quality, blurry, distorted UI, text hallucination, garbled characters, pixelated, " +
  "amateurish, shaky camera, unnatural movement, poor lighting, cartoonish, noisy, watermark, " +
  "bad composition, ugly, deformed, extra limbs, bad anatomy, cropped, out of frame, " +
  "jpeg artifacts, glitch, error";

const CLIP_DURATION = 5;
const POLL_INTERVAL_MS = 10_000; // 10s between polls
const TIMEOUT_MS = 600_000;      // 10 min total

function getApiKey() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set in environment");
  return key;
}

/**
 * Generate a single video clip via OpenRouter.
 * @param {string|null} screenshotPath - local PNG path (null = text-only)
 * @param {string} prompt - cinematic prompt
 * @param {string} outputPath - where to save the downloaded MP4
 * @param {number} [duration] - clip length in seconds
 * @param {string} [modelOverride] - override the default model
 * @returns {string} outputPath
 */
async function generateClip(screenshotPath, prompt, outputPath, duration = CLIP_DURATION, modelOverride) {
  const apiKey = getApiKey();
  const activeModel = modelOverride || MODEL;

  const requestBody = {
    model: activeModel,
    prompt,
    negative_prompt: NEGATIVE_PROMPT,
    duration,
    resolution: "1080p",
    aspect_ratio: "9:16",
    generate_audio: false,
  };

  if (screenshotPath && fs.existsSync(screenshotPath)) {
    const base64 = fs.readFileSync(screenshotPath).toString("base64");
    requestBody.frame_images = [
      {
        type: "image_url",
        image_url: { url: `data:image/png;base64,${base64}` },
        frame_type: "first_frame",
      },
    ];
  }

  console.log(`[seedance] Submitting [${activeModel}]: "${prompt.substring(0, 70)}…" (${duration}s)`);

  const submitRes = await fetch(`${OPENROUTER_BASE}/videos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text().catch(() => "");
    throw new Error(`OpenRouter submit error ${submitRes.status}: ${errText.slice(0, 400)}`);
  }

  const job = await submitRes.json();
  const jobId = job.id;
  if (!jobId) {
    throw new Error(`No job ID in response: ${JSON.stringify(job).slice(0, 400)}`);
  }

  console.log(`[seedance] Job ${jobId} submitted, polling…`);

  // Poll until completed or timeout
  const startTime = Date.now();
  const deadline = startTime + TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const pollRes = await fetch(`${OPENROUTER_BASE}/videos/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!pollRes.ok) {
      const errText = await pollRes.text().catch(() => "");
      throw new Error(`OpenRouter poll error ${pollRes.status}: ${errText.slice(0, 400)}`);
    }

    const status = await pollRes.json();
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[seedance] Job ${jobId} status: ${status.status} (${elapsed}s elapsed)`);

    if (status.status === "failed") {
      throw new Error(`Seedance job failed: ${JSON.stringify(status).slice(0, 400)}`);
    }

    if (status.status === "completed") {
      const videoUrl = status.unsigned_urls?.[0];
      if (!videoUrl) {
        throw new Error(`No video URL in completed job: ${JSON.stringify(status).slice(0, 400)}`);
      }
      console.log(`[seedance] Downloading from ${videoUrl}`);
      await downloadFile(videoUrl, outputPath, apiKey);
      console.log(`[seedance] Saved → ${outputPath}`);
      return outputPath;
    }
  }

  throw new Error(`Seedance job ${jobId} timed out after ${TIMEOUT_MS / 1000}s`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function downloadFile(url, dest, apiKey) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const proto = url.startsWith("https") ? https : http;

    const options = url.startsWith("https://openrouter.ai")
      ? Object.assign(new URL(url), { headers: { Authorization: `Bearer ${apiKey}` } })
      : url;

    proto
      .get(options, (res) => {
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => {});
          reject(new Error(`Download failed: HTTP ${res.statusCode} from ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
        file.on("error", (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
      })
      .on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

module.exports = { generateClip, CLIP_DURATION };
