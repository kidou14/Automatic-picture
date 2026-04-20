require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { runPipeline } = require("./pipeline");

const app = express();
const PORT = process.env.PORT || 4322;
const ROOT_DIR = path.resolve(__dirname, "..");

app.use(cors());
app.use(express.json());
app.use("/output", express.static(path.join(ROOT_DIR, "output")));
app.use("/sessions", express.static(path.join(ROOT_DIR, "sessions")));
app.use(express.static(path.join(ROOT_DIR, "public")));

// In-memory session registry
const sessions = new Map();

app.post("/api/generate", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });

  const sessionId = uuidv4();
  sessions.set(sessionId, { emitter: null, status: "pending", videoUrl: null, error: null });
  res.json({ sessionId });

  // Run pipeline async
  runPipeline(url, sessionId, (update) => {
    const session = sessions.get(sessionId);
    if (!session) return;
    if (session.emitter) {
      session.emitter.write(`data: ${JSON.stringify(update)}\n\n`);
    }
    if (update.done) {
      session.status = "done";
      session.videoUrl = update.videoUrl;
    }
    if (update.error) {
      session.status = "error";
      session.error = update.error;
    }
  }).catch((err) => {
    console.error("[server] pipeline error:", err);
    const session = sessions.get(sessionId);
    if (session) {
      session.status = "error";
      session.error = err.message;
      if (session.emitter) {
        session.emitter.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      }
    }
  });
});

app.get("/api/progress/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: "session not found" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  session.emitter = res;

  // If already done/error, send final event immediately
  if (session.status === "done") {
    res.write(`data: ${JSON.stringify({ done: true, videoUrl: session.videoUrl })}\n\n`);
  } else if (session.status === "error") {
    res.write(`data: ${JSON.stringify({ error: session.error })}\n\n`);
  }

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 20000);

  req.on("close", () => {
    clearInterval(heartbeat);
    session.emitter = null;
  });
});

app.listen(PORT, () => {
  console.log(`[v3] Server running at http://localhost:${PORT}`);
});
