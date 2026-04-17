'use strict';

// Load .env.local from project root (Automatic-picture/)
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const zlib    = require('zlib');
const fs      = require('fs');
const { v4: uuidv4 }            = require('uuid');
const { generateBannerConfig }  = require('./colorGen');
const { renderBannerStill }     = require('./render');
const { captureScreenshots }    = require('./screenshot');

// ── Test screenshot generator (pure Node.js, no deps) ────────────────────────
// Generates a fake "app screenshot" PNG at 390×844 for style testing.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const tb = Buffer.from(type, 'ascii');
  const lb = Buffer.allocUnsafe(4); lb.writeUInt32BE(data.length, 0);
  const cb = Buffer.allocUnsafe(4); cb.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([lb, tb, data, cb]);
}

let _testPngCache = null;
function getTestPng() {
  if (_testPngCache) return _testPngCache;

  const W = 390, H = 844;
  // Build fake-app pixel data: header bar, hero block, content rows
  const raw = Buffer.allocUnsafe(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: None
    for (let x = 0; x < W; x++) {
      const off = y * (1 + W * 3) + 1 + x * 3;
      const nx = x / W, ny = y / H;
      let r, g, b;
      if (ny < 0.09) {           // status bar / header: deep indigo
        r = 22; g = 18; b = 55;
      } else if (ny < 0.38) {    // hero card: purple-blue gradient
        r = Math.round(30  + nx * 40  + ny * 60);
        g = Math.round(20  + ny * 50);
        b = Math.round(80  + nx * 100 + ny * 80);
      } else if (ny < 0.42) {    // divider strip
        r = 240; g = 240; b = 248;
      } else if (ny < 0.58) {    // content card 1: soft teal
        r = Math.round(220 - nx * 30); g = Math.round(240 - ny * 20); b = Math.round(235 - nx * 20);
      } else if (ny < 0.62) {    // thin gap
        r = 245; g = 245; b = 250;
      } else if (ny < 0.78) {    // content card 2: warm cream
        r = Math.round(250 - nx * 15); g = Math.round(235 - ny * 10); b = Math.round(210 + nx * 20);
      } else if (ny < 0.82) {    // thin gap
        r = 245; g = 245; b = 250;
      } else if (ny < 0.93) {    // bottom card: light grey
        r = 230; g = 232; b = 240;
      } else {                   // tab bar
        r = 25; g = 22; b = 60;
      }
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b;
    }
  }

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  _testPngCache = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return _testPngCache;
}

const PORT     = parseInt(process.env.PORT || '4330', 10);
const ROOT_DIR = path.join(__dirname, '..');

// ── Placeholder mode ──────────────────────────────────────────────────────────
// Set USE_PLACEHOLDER=true to skip Playwright screenshot capture and use a
// fixed local PNG instead. Flip to false when real screenshot capture is needed.
const USE_PLACEHOLDER   = process.env.USE_PLACEHOLDER === 'true';
const PLACEHOLDER_PATH  = path.join(ROOT_DIR, 'public', 'placeholder-screenshot.png');

// ── Build browser preview bundle ──────────────────────────────────────────────
// esbuild bundles src/preview-app.tsx → public/preview.bundle.js so the
// /preview.html iframe can run Remotion Player directly in the browser.
async function buildPreviewBundle() {
  const esbuild = require('esbuild');
  console.log('[preview] Building browser bundle…');
  await esbuild.build({
    entryPoints: [path.join(ROOT_DIR, 'src', 'preview-app.tsx')],
    bundle:      true,
    outfile:     path.join(ROOT_DIR, 'public', 'preview.bundle.js'),
    platform:    'browser',
    format:      'iife',
    jsx:         'automatic',
    loader:      { '.tsx': 'tsx', '.ts': 'ts', '.jsx': 'jsx' },
    define:      { 'process.env.NODE_ENV': '"production"' },
    minify:      false,
    logLevel:    'warning',
  });
  console.log('[preview] Browser bundle ready.');
}

// Start the build immediately (non-blocking — server starts in parallel)
buildPreviewBundle().catch(err =>
  console.error('[preview] Build failed — live preview unavailable:', err.message)
);

// In-memory image stores (no files written to the project directory)
const assetBuffers  = new Map();  // id → Buffer  (Playwright screenshots)
const renderBuffers = new Map();  // id → Buffer  (Remotion stills)

// ── In-memory job store ───────────────────────────────────────────────────────
const jobs = new Map();

function createJob(id) {
  return {
    id,
    status: 'running',  // 'running' | 'completed' | 'failed'
    phase: 'queued',    // 'queued' | 'capturing' | 'rendering' | 'done'
    total: 0,           // total screenshots discovered
    screenshotsDone: 0, // screenshots captured so far
    rendersDone: 0,     // renders completed so far
    renders: [],        // [{ previewUrl, config, index, label }]
    error: null,
  };
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

const MOCKUP_URL = `http://127.0.0.1:${PORT}/mockup.png`;

async function runPipeline(job, url, title, dimensions) {
  try {
    // Step 1: obtain screenshots (placeholder or Playwright)
    let screenshots;
    if (USE_PLACEHOLDER) {
      job.phase = 'capturing';
      const pngBuffer = fs.existsSync(PLACEHOLDER_PATH)
        ? fs.readFileSync(PLACEHOLDER_PATH)
        : getTestPng();
      screenshots = [{ pngBuffer, label: 'placeholder' }];
      job.total = 1;
      job.screenshotsDone = 1;
      console.log(`[${job.id}] placeholder mode — skipping Playwright`);
    } else {
      job.phase = 'capturing';
      screenshots = await captureScreenshots(url, (done, total, label) => {
        job.total = total;
        job.screenshotsDone = done;
        console.log(`[${job.id}] screenshot ${done}/${total} — ${label}`);
      });
      job.total = screenshots.length;
      job.screenshotsDone = screenshots.length;
    }

    job.phase = 'rendering';
    console.log(`[${job.id}] captured ${screenshots.length} screenshots, now rendering...`);

    // Step 2: render each screenshot as a Remotion still
    for (let i = 0; i < screenshots.length; i++) {
      const { pngBuffer, label } = screenshots[i];

      // Store screenshot in memory
      const assetId  = `${job.id}-${i}.png`;
      assetBuffers.set(assetId, pngBuffer);

      // Generate config with a per-poster seed
      const seed     = `${job.id}-${i}`;
      const imageUrl = `http://127.0.0.1:${PORT}/api/assets/${assetId}`;
      const config   = await generateBannerConfig({ seed, imageUrl, mockupUrl: MOCKUP_URL, title, dimensions });

      // Render still → buffer in memory
      const renderId = `${job.id}-${i}.png`;
      console.log(`[${job.id}] rendering ${i + 1}/${screenshots.length}...`);
      const renderBuf = await renderBannerStill(config);
      renderBuffers.set(renderId, renderBuf);

      job.renders.push({
        index: i,
        label,
        previewUrl: `/api/renders/${renderId}`,
        config,
      });
      job.rendersDone = i + 1;
      console.log(`[${job.id}] render ${i + 1}/${screenshots.length} done`);
    }

    job.phase  = 'done';
    job.status = 'completed';
    console.log(`[${job.id}] all done — ${job.renders.length} posters`);
  } catch (err) {
    job.status = 'failed';
    job.error  = err.message;
    console.error(`[${job.id}] pipeline failed:`, err);
  }
}

// ── Express app ───────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use((req, res, next) => {
  // Keep local dev deterministic: avoid stale HTML/bundle/assets after restarts.
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Test screenshot (fake app UI, no Playwright needed)
app.get('/test-screenshot.png', (_req, res) => {
  res.set('Content-Type', 'image/png').send(getTestPng());
});

// In-memory image routes
app.get('/api/assets/:id', (req, res) => {
  const buf = assetBuffers.get(req.params.id);
  if (!buf) return res.status(404).end();
  res.set('Content-Type', 'image/png').send(buf);
});
app.get('/api/renders/:id', (req, res) => {
  const buf = renderBuffers.get(req.params.id);
  if (!buf) return res.status(404).end();
  res.set('Content-Type', 'image/png').send(buf);
});

// ── POST /api/render ──────────────────────────────────────────────────────────
// Body: { url: string, title?: string, dimensions?: BannerDimensions }
// Response: { jobId: string }
app.post('/api/render', (req, res) => {
  try {
    const { url, title = '全新体验', dimensions } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });

    const jobId = uuidv4();
    const job   = createJob(jobId);
    jobs.set(jobId, job);

    // Queue the work so the HTTP response returns immediately with the job id.
    setImmediate(() => {
      runPipeline(job, url, title, dimensions).catch(() => {});
    });

    res.status(201).json({ jobId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/rerender ────────────────────────────────────────────────────────
// Skips Playwright — re-renders an already-captured imageUrl with new dimensions.
// Body: { imageUrl: string, title?: string, dimensions?: BannerDimensions }
// Response: { previewUrl: string, config: BannerConfig }
app.post('/api/rerender', async (req, res) => {
  try {
    const { imageUrl, title = '全新体験', dimensions, seed: suppliedSeed } = req.body;
    if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });

    // Re-use the original seed so palette colours stay identical across dimension switches.
    // If no seed is supplied (legacy call), fall back to a fresh random one.
    const seed   = suppliedSeed || uuidv4();
    const config = await generateBannerConfig({ seed, imageUrl, mockupUrl: MOCKUP_URL, title, dimensions });

    const renderId  = `${seed}.png`;
    const renderBuf = await renderBannerStill(config);
    renderBuffers.set(renderId, renderBuf);

    res.json({ previewUrl: `/api/renders/${renderId}`, config });
  } catch (err) {
    console.error('[rerender] error:', err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// ── GET /api/jobs/:jobId ──────────────────────────────────────────────────────
// Response: { status, phase, total, screenshotsDone, rendersDone, renders, error }
app.get('/api/jobs/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({
    status:          job.status,
    phase:           job.phase,
    total:           job.total,
    screenshotsDone: job.screenshotsDone,
    rendersDone:     job.rendersDone,
    renders:         job.renders,
    error:           job.error,
  });
});

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

const server = app.listen(PORT, () => {
  console.log(`✦ poster-motion server running at http://127.0.0.1:${PORT}`);
  console.log(`  Studio: npx remotion studio src/index.tsx`);
});

process.on('SIGINT',  () => { server.close(); process.exit(0); });
process.on('SIGTERM', () => { server.close(); process.exit(0); });
