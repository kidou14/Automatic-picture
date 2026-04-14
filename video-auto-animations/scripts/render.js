/**
 * Render script: programmatically renders a Remotion composition to MP4 via FFmpeg.
 * Usage: node scripts/render.js [compositionId] [outputPath]
 *
 * Examples:
 *   node scripts/render.js MyVideo output/my-video.mp4
 *   node scripts/render.js MyVideo output/my-video.mp4 --props '{"titleText":"Hello"}'
 */

const { bundle } = require("@remotion/bundler");
const { renderMedia, selectComposition } = require("@remotion/renderer");
const path = require("path");
const fs = require("fs");

async function render() {
  const args = process.argv.slice(2);
  const compositionId = args[0] || "MyVideo";
  const outputPath = args[1] || `output/${compositionId}.mp4`;

  // Parse optional --props flag
  let inputProps = {};
  const propsIdx = args.indexOf("--props");
  if (propsIdx !== -1 && args[propsIdx + 1]) {
    inputProps = JSON.parse(args[propsIdx + 1]);
  }

  // Ensure output directory exists
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`Bundling composition "${compositionId}"...`);
  const studioRenderEntry = path.resolve(
    "node_modules/@remotion/studio/dist/esm/renderEntry.mjs"
  );
  const bundleLocation = await bundle({
    entryPoint: path.resolve("src/index.tsx"),
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...config.resolve?.alias,
          // Fix double-esm path resolution bug in some Remotion versions
          "@remotion/studio/renderEntry": studioRenderEntry,
        },
      },
    }),
  });

  console.log("Selecting composition...");
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps,
  });

  console.log(`Rendering ${composition.durationInFrames} frames at ${composition.fps}fps...`);
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: outputPath,
    inputProps,
    onProgress: ({ progress }) => {
      process.stdout.write(`\rProgress: ${Math.round(progress * 100)}%`);
    },
  });

  console.log(`\nDone! Video saved to: ${outputPath}`);
}

render().catch((err) => {
  console.error("Render failed:", err);
  process.exit(1);
});
