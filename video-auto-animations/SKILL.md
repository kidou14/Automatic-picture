---
name: video-auto-animations
description: Use when you need to auto-generate animated marketing videos, motion graphics, or app promo clips. Built on Remotion (React-based video framework) + FFmpeg for rendering. Triggers on: 视频动效, 自动化视频, app 宣传片, motion graphics, remotion, animated video, promo video, video render.
---

# Video Auto-Animations

## Overview

Generates animated videos programmatically using **Remotion** (React components → video frames) + **FFmpeg** (encoding). Output: MP4 files at any resolution and framerate.

**Installed versions:**
- Remotion 4.0.443
- FFmpeg 8.1 (system, via Homebrew)

**Working directory:** `video-auto-animations/`

---

## Architecture

```
video-auto-animations/
├── src/
│   ├── index.tsx          # Remotion entry — registerRoot
│   ├── Root.tsx           # <Composition> registry — add new compositions here
│   └── Composition.tsx    # Default demo composition
├── scripts/
│   └── render.js          # Node.js programmatic render (Remotion Renderer API)
├── output/                # Rendered MP4s go here (auto-created)
└── package.json
```

---

## Core Concepts

### Remotion Fundamentals

| Concept | What it is |
|---------|-----------|
| `useCurrentFrame()` | Returns current frame number (0-based) |
| `useVideoConfig()` | Returns `{ fps, durationInFrames, width, height }` |
| `interpolate(frame, [in], [out])` | Linear mapping of frame range to value range |
| `spring({ frame, fps, config })` | Physics-based spring animation |
| `<AbsoluteFill>` | Full-canvas absolutely-positioned container |
| `<Sequence from={N} durationInFrames={D}>` | Time-offset children |
| `<Audio>`, `<Video>`, `<Img>` | Media primitives |

### Frame Math

```
seconds × fps = frames
1 second at 30fps = 30 frames
5 second video = durationInFrames: 150
```

### Easing & Motion

```tsx
// Fade in over first 30 frames
const opacity = interpolate(frame, [0, 30], [0, 1], {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
});

// Spring scale from 0 → 1
const scale = spring({ frame, fps, config: { damping: 200, stiffness: 200, mass: 0.5 } });

// Slide up (translateY from 60px to 0)
const y = interpolate(frame, [0, 20], [60, 0], { extrapolateRight: "clamp" });
```

---

## Phase 0: Gather Input

Ask ALL of these in a **single message** before writing code:

### Required

1. **What is this video for?** — App promo, product demo, social post, explainer, App Store preview
2. **Resolution & aspect ratio** — Portrait 9:16 (1080×1920) / Landscape 16:9 (1920×1080) / Square 1:1 (1080×1080)
3. **Duration** — How many seconds?
4. **Content / message** — What should the video show or say?

### Optional

5. **Assets** — Any images, screenshots, icons, or fonts to include? (provide paths)
6. **Brand colors** — Accent, background, text colors
7. **Style** — Clean/minimal, bold/dark, playful, tech gradient, warm organic
8. **Audio** — Any background music or sound effects? (provide path)

### Auto-decided (do NOT ask)

- Animation timing and easing curves
- Text sizing and layout
- Background treatment (gradient, blur, shapes)

---

## Phase 1: Define the Composition

### Step 1.1 — Register in `src/Root.tsx`

```tsx
import { Composition } from "remotion";
import { AppPromo } from "./compositions/AppPromo";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="AppPromo"
      component={AppPromo}
      durationInFrames={180}   // 6s at 30fps
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        appName: "MyApp",
        accentColor: "#6C63FF",
      }}
    />
  </>
);
```

### Step 1.2 — Create the Composition File

Each composition = one React component in `src/compositions/`.

**Sequence-based structure (for multi-scene videos):**

```tsx
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

export const AppPromo: React.FC<{ appName: string; accentColor: string }> = ({ appName, accentColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "#0B1020" }}>
      {/* Scene 1: 0–60 frames (0–2s) */}
      <Sequence from={0} durationInFrames={60}>
        <Scene1 appName={appName} accentColor={accentColor} />
      </Sequence>

      {/* Scene 2: 45–120 frames (1.5–4s, overlapping for crossfade) */}
      <Sequence from={45} durationInFrames={75}>
        <Scene2 />
      </Sequence>

      {/* Scene 3: 105–180 frames (3.5–6s) */}
      <Sequence from={105} durationInFrames={75}>
        <Scene3 accentColor={accentColor} />
      </Sequence>
    </AbsoluteFill>
  );
};
```

### Common Scene Patterns

**Text reveal with spring:**
```tsx
const scale = spring({ frame, fps, config: { damping: 200 } });
const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
<div style={{ transform: `scale(${scale})`, opacity }}>{text}</div>
```

**Slide in from bottom:**
```tsx
const y = interpolate(frame, [0, 25], [100, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
<div style={{ transform: `translateY(${y}px)` }}>{content}</div>
```

**Image with phone mockup (reuse appstore-auto-screenshots mockup):**
```tsx
<Img src={staticFile("mockup.png")} style={{ width: "80%", position: "absolute", bottom: 0 }} />
```

**Staggered text lines:**
```tsx
{lines.map((line, i) => {
  const lineFrame = Math.max(0, frame - i * 8);
  const opacity = interpolate(lineFrame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  return <div key={i} style={{ opacity }}>{line}</div>;
})}
```

**Looping pulsing glow:**
```tsx
const pulse = Math.sin((frame / fps) * Math.PI * 2) * 0.3 + 0.7;
<div style={{ opacity: pulse, boxShadow: `0 0 ${60 * pulse}px ${accentColor}` }} />
```

---

## Phase 2: Preview in Studio

```bash
cd video-auto-animations
npm run studio
# Opens http://localhost:3000 — live preview with scrubber
```

The studio auto-reloads on file save. Use it to:
- Scrub through the timeline
- Inspect per-frame rendering
- Verify animation timing before rendering

---

## Phase 3: Render to MP4

### Option A — CLI (quick)

```bash
# Render to MP4
npx remotion render src/index.tsx MyVideo output/my-video.mp4

# With custom props
npx remotion render src/index.tsx AppPromo output/app-promo.mp4 --props='{"appName":"MyApp"}'
```

### Option B — Programmatic (scripts/render.js)

```bash
node scripts/render.js MyVideo output/my-video.mp4
node scripts/render.js AppPromo output/app-promo.mp4 --props '{"appName":"MyApp","accentColor":"#6C63FF"}'
```

### Option C — FFmpeg post-processing

After rendering, use FFmpeg to transform the output:

```bash
# Convert to GIF (for previews)
ffmpeg -i output/my-video.mp4 -vf "fps=15,scale=540:-1" output/preview.gif

# Add fade in/out
ffmpeg -i output/my-video.mp4 -vf "fade=in:0:15,fade=out:135:15" output/my-video-fade.mp4

# Loop 3 times
ffmpeg -stream_loop 2 -i output/my-video.mp4 -c copy output/my-video-loop.mp4

# Trim
ffmpeg -i output/my-video.mp4 -ss 0 -t 3 output/my-video-3s.mp4

# Stack two videos side-by-side
ffmpeg -i left.mp4 -i right.mp4 -filter_complex "[0:v][1:v]hstack" output/side-by-side.mp4

# Scale for Instagram Reels (1080×1920)
ffmpeg -i output/my-video.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" output/reels.mp4
```

---

## Phase 4: QA Gate

Before delivering the rendered video:

### Animation Quality
- [ ] Animations start and end cleanly (no abrupt jumps)
- [ ] Spring animations don't overshoot unintentionally
- [ ] Crossfades between scenes are smooth (use overlapping Sequences)
- [ ] Text is readable at the target platform's thumbnail size

### Technical Quality
- [ ] No blank frames at start or end
- [ ] Correct resolution and aspect ratio
- [ ] File size is reasonable (< 20MB for social, < 500MB for broadcast)
- [ ] FFmpeg encoding completed without errors

### Delivery
- [ ] Output file exists at the expected path
- [ ] Confirm with user: "Your video is at `output/xxx.mp4`"

---

## Common Patterns & Recipes

### App Store Preview Video (15s)
```
0–2s:   App icon + name spring-in
2–5s:   Screenshot 1 — core feature
5–8s:   Screenshot 2 — key differentiator
8–11s:  Screenshot 3 — social proof / result
11–13s: "Available on the App Store" + rating
13–15s: Logo/icon fade out
```

### Social Media Short (6–15s)
```
0–1s:   Hook — bold problem statement or striking visual
1–4s:   Demo / core content
4–5.5s: CTA (Call to action)
5.5–6s: Logo/brand
```

### Loading/Onboarding Animation (3s loop)
```
Use spring + interpolate for micro-interactions.
Set durationInFrames to 90 (3s) and loop in player.
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Cannot find module 'remotion'` | Run `npm install` in `video-auto-animations/` |
| Studio blank white screen | Check `src/index.tsx` calls `registerRoot` correctly |
| Render hangs at 0% | Check Chrome/Chromium is available: `npx remotion browser` |
| Animation jumps on first frame | Add `extrapolateLeft: "clamp"` to all interpolate calls |
| Spring overshoots | Lower `stiffness` or increase `damping` |
| Output file too large | Add `--crf=23` flag or reduce resolution |
| FFmpeg `No such file` | Verify: `which ffmpeg` — should show `/opt/homebrew/bin/ffmpeg` |
| Fonts not loading | Use `delayRender` / `continueRender` pattern for async font load |
