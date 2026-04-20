/**
 * convert.js — FFmpeg webm → mp4 conversion for Remotion compatibility
 */
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// Prefer system ffmpeg; fall back to ffmpeg-static
function getFfmpegPath() {
  try {
    return require("ffmpeg-static");
  } catch {
    return "ffmpeg";
  }
}

/**
 * Convert a webm file to mp4 (h264) suitable for Remotion <Video> rendering.
 * @param {string} inputPath  - path to .webm file
 * @param {string} outputPath - path to write .mp4
 * @returns {Promise<void>}
 */
function convertWebmToMp4(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      return reject(new Error(`Input file not found: ${inputPath}`));
    }

    const ffmpeg = getFfmpegPath();
    const args = [
      "-y",
      "-i", inputPath,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-r", "30",             // Constant 30fps for frame-accurate seeking
      "-g", "30",             // Keyframe every 1s so seeks are always clean
      "-movflags", "+faststart",
      "-an",                  // no audio
      outputPath,
    ];

    console.log(`[convert] ${path.basename(inputPath)} → ${path.basename(outputPath)}`);
    const proc = spawn(ffmpeg, args);

    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-400)}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
    });
  });
}

module.exports = { convertWebmToMp4 };
