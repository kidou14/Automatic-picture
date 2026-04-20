/**
 * server.js — Express HTTP server (port 4321)
 * Endpoints:
 *   POST /api/generate   { url } → { sessionId }
 *   GET  /api/progress/:id        → SSE stream
 *   GET  /output/:file            → serve MP4
 *   GET  /sessions/:id/:file      → serve screenshots
 *   GET  /                        → public/index.html
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env.local") });

const express = require("express");
const cors = require("cors");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const EventEmitter = require("events");
const { runPipeline } = require("./pipeline");

const PORT = process.env.PORT || 4321;
const ROOT_DIR = path.resolve(__dirname, "..");

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(ROOT_DIR, "public")));
app.use("/output", express.static(path.join(ROOT_DIR, "output")));
app.use("/sessions", express.static(path.join(ROOT_DIR, "sessions")));

const sessions = new Map();

// ── POST /api/generate ────────────────────────────────────────────────────
app.post("/api/generate", (req, res) => {
  const { url } = req.body;
  if (!url || !url.startsWith("http")) {
    return res.status(400).json({ error: "Invalid URL. Must start with http/https." });
  }

  const sessionId = uuidv4();
  const emitter = new EventEmitter();
  emitter.setMaxListeners(20);

  sessions.set(sessionId, {
    emitter,
    status: "running",
    videoUrl: null,
    error: null,
    lastUpdate: null,
  });

  runPipeline(url, sessionId, (update) => {
    const sess = sessions.get(sessionId);
    if (sess) {
      sess.lastUpdate = update;
      if (update.done) sess.status = "done";
      if (update.error) sess.status = "error";
    }
    emitter.emit("update", update);
  }).catch((err) => {
    console.error(`[server] Pipeline failed for ${sessionId}:`, err);
    const update = { error: err.message, message: `Error: ${err.message}` };
    const sess = sessions.get(sessionId);
    if (sess) {
      sess.status = "error";
      sess.lastUpdate = update;
    }
    emitter.emit("update", update);
  });

  res.json({ sessionId });
});

// ── GET /api/progress/:sessionId  (SSE) ──────────────────────────────────
app.get("/api/progress/:sessionId", (req, res) => {
  const sess = sessions.get(req.params.sessionId);
  if (!sess) return res.status(404).json({ error: "Session not found" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  if (sess.status === "done" || sess.status === "error") {
    if (sess.lastUpdate) send(sess.lastUpdate);
    return res.end();
  }

  sess.emitter.on("update", send);

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 20000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sess.emitter.off("update", send);
  });
});

// ── Start server ──────────────────────────────────────────────────────────
const httpServer = app.listen(PORT, () => {
  console.log(`\n🎬  Auto Video Generator (Seedance Edition)`);
  console.log(`   Server: http://localhost:${PORT}\n`);
});

httpServer.timeout = 0;
httpServer.keepAliveTimeout = 0;
