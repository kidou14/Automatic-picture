# poster-motion 效果实现方法论

本文档是实现 reactbits.dev 效果的完整参考。每次开始新效果前**先读本文档**，按规范执行。

---

## 一、执行流程（每次实现新效果时必须遵循）

```
Step 1  从 reactbits 侧边栏获取该分类的完整列表（按侧边栏原始顺序）
Step 2  逐一做代码走查，按 4 档难度分类（见下方标准）
Step 3  列出各档效果，与用户确认本次实现哪些
Step 4  按 最低 → 常规 → 中等 的顺序实现
Step 5  每个效果实现后，同步更新 4 个注册文件 + rebuild（见第三节）
Step 6  在本文档的效果清单中打 ✅
```

**注意**：sidebar 原始排序仅用于参考"优先审查顺序"，不等于实现优先级。
实现优先级 = 难度最低优先。

### 4 档难度标准

| 档位 | 标准 | 代码量 |
|---|---|---|
| **最低** | 纯 CSS / SVG / 极简 Canvas 几何，无 shader | ≤ 80 行 |
| **常规** | Canvas 2D 完整动画 或 WebGL Fragment Shader | ~150-250 行 |
| **中等** | 复杂 WebGL（多 pass / 复杂噪声）或复杂物理 | ~300-500 行 |
| **很难** | 体积光 Raymarching / 流体模拟 / 复杂后处理，忠实实现不现实 | — |

---

## 二、质量红线（不可降级）

1. **GLSL shader 必须逐字复制**，不允许简化或重写
2. **所有关键参数必须对应 reactbits 默认值**（如 `amplitude=1.4`、`uInnerLines=32`）
3. **Canvas 2D 保留原始逻辑**：Perlin noise 类、循环结构、magic numbers 全部保留
4. **弹簧动画 spring config 来自原始代码**，不得猜测 stiffness/damping
5. **视觉上必须可辨识为同一个效果**：看效果截图能认出是哪个 reactbits 效果

---

## 三、核心移植规则

### 时间源替换

| 原始代码 | Remotion 替换 |
|---|---|
| `performance.now() * 0.001` | `frame / fps` |
| `t * 0.001`（ms 时间戳） | `frame / fps` |
| `frameCount * 0.02`（p5.js） | 视上下文换算 |
| `useFrame((s) => s.clock.elapsedTime)` | `frame / fps` |

组件内统一: `const t = frame / fps;`

### 鼠标交互 → 固定中心

poster-motion 无交互，**所有鼠标坐标固定为 `[0.5, 0.5]`（归一化）**。
WebGL: `gl.uniform2f(u('uMouse'), 0.5, 0.5);`

### 渲染帧

`server/render.js` 中 `frame = 45`（让入场动画处于进行中、有动感）

---

## 四、reactbits 分类 → poster-motion 维度槽映射

拿到一个 reactbits 效果，先判断它属于哪个维度槽：

| reactbits 分类 | 效果特征 | poster-motion 槽 | DimensionProps 类型 |
|---|---|---|---|
| Backgrounds | 全画布填充动画 | `background` | `DimensionProps` |
| Text Animations | 标题文字动效 | `textEffect` | `DimensionProps` |
| Animations（可视觉化） | 全画布粒子/噪声/线条 | `background` | `DimensionProps` |
| Animations（叠加层） | 局部装饰元素、发光圆环等 | `decoration` | `DimensionProps` |
| Animations（入场包裹） | 整体缩放/淡入/位移 | `entrance` | `EntranceDimensionProps` |
| Components | 通常不直接用；可提取视觉层 | 视情况 | — |

**entrance 槽特殊说明**：`EntranceDimensionProps` 含 `children` prop，需要把子元素包裹在动画容器里：
```tsx
export const XxxIn: React.FC<EntranceDimensionProps> = ({ frame, fps, children }) => (
  <AbsoluteFill style={{ transform: `scale(${progress})` }}>{children}</AbsoluteFill>
);
```

---

## 五、技术实现模板（按技术类型，适用全部分类）

### 5.1 CSS / SVG（最低难度，约 50 行）

适用于：纯几何动画、渐变、简单 Canvas 几何、闪光/旋转文字。

```tsx
export const XxxEffect: React.FC<DimensionProps> = ({ frame, fps, palette, config }) => {
  const t = frame / fps;
  // 直接用 CSS keyframes（@keyframes 写在 <style> JSX 里）或 inline transform
  // 不需要 useRef / useEffect
  const progress = (frame % fps) / fps; // 0→1 循环
  return (
    <AbsoluteFill style={{
      background: `linear-gradient(${t * 30}deg, ${palette.bg}, ${palette.accent})`,
    }} />
  );
};
```

CSS keyframe 注入方式（Remotion 支持 `<style>` 标签）：
```tsx
return (
  <>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <div style={{ animation: `spin ${1/speed}s linear infinite` }} />
  </>
);
```

---

### 5.2 WebGL Fragment Shader（常规 / 中等）

适用于：全画布 shader 背景、粒子系统 shader、复杂视觉效果。

```tsx
import { initGL, FULLSCREEN_VERT, hexToVec3, type GLSetup } from '../../utils/webgl';

// 1. 逐字复制 reactbits GLSL fragment shader → FRAG 常量
const canvasRef = useRef<HTMLCanvasElement>(null);
const glRef     = useRef<GLSetup | null>(null);

// 2. 初始化（仅一次）
useEffect(() => {
  glRef.current = initGL(canvasRef.current!, FULLSCREEN_VERT, FRAG, config.width, config.height);
  return () => { glRef.current?.gl.getExtension('WEBGL_lose_context')?.loseContext(); };
}, []); // eslint-disable-line

// 3. 每帧渲染
useEffect(() => {
  const s = glRef.current;
  if (!s) return;
  const { gl, u } = s;
  const t = frame / fps;
  // 按 reactbits 默认参数逐一设置 uniform
  gl.clearColor(br, bg_, bb, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}, [frame, fps, palette, config.width, config.height]);

return <AbsoluteFill><canvas ref={canvasRef} style={{ width:'100%', height:'100%' }} /></AbsoluteFill>;
```

**特殊顶点着色器**：RippleGrid 等使用 `vUv = position * 0.5 + 0.5`（无 uv attribute），
需写独立的 `initXxxGL()` 函数，不强行套用 `initGL`。

**调色板 uniform 对应**：

| palette 字段 | 语义 | 常用于 |
|---|---|---|
| `palette.bg` | 背景底色 | `clearColor`、`uBgColor` |
| `palette.accent` | 主强调色 | `uColor`、`gridColor` |
| `palette.accent2` | 次强调色 | 渐变结束色、双色混合 |
| `palette.text` | 文字色 | 线条 / 粒子（高对比度） |

---

### 5.3 Canvas 2D（常规）

适用于：粒子、dot grid、波形线条、字符网格、噪声生成。

```tsx
const canvasRef = useRef<HTMLCanvasElement>(null);
useEffect(() => {
  const c = canvasRef.current!;
  c.width = config.width; c.height = config.height;
}, []); // eslint-disable-line

useEffect(() => {
  const ctx = canvasRef.current!.getContext('2d')!;
  const t = frame / fps;
  ctx.clearRect(0, 0, config.width, config.height);
  // 逐字移植 reactbits 代码，时间源替换为 t
}, [frame, fps, palette, config.width, config.height]);

return <AbsoluteFill><canvas ref={canvasRef} style={{ width:'100%', height:'100%' }} /></AbsoluteFill>;
```

p5.js 对照：`frameCount` → `frame`，`color(r,g,b,a)` → CSS `rgba(r,g,b,a/255)`

**用途扩展**：Canvas 2D 不限于背景，也可做 `decoration`（渲染透明底的装饰元素）或 `textEffect`（字符网格动画）。

---

### 5.4 Spring / Remotion 动画（常规，文字效果和入场效果专用）

**逐字 stagger 入场**（Text Animations 主要模式）：
```tsx
import { spring } from 'remotion';
const stagger = Math.max(N, Math.floor(TOTAL_FRAMES / chars.length));
// 令最后一个字符约在 frame 40 到达目标位
chars.map((char, i) => {
  const progress = Math.min(1, Math.max(0, spring({
    frame: frame - i * stagger, fps,
    config: { stiffness: XX, damping: XX }, // 值来自 reactbits 源码
  })));
  // 用 progress 驱动 translateY / opacity / blur / scale
});
```

**整体入场包裹**（Animations → entrance 槽）：
```tsx
const progress = spring({ frame, fps, config: { stiffness: 80, damping: 14 } });
return <AbsoluteFill style={{ transform: `translateY(${(1-progress)*60}px)` }}>{children}</AbsoluteFill>;
```

**持续循环**（不用 spring，直接用 frame）：
```tsx
const rotationDeg = (frame / 90) * 360; // 每 90 帧转一圈
const phase = (frame / fps) * Math.PI * 2; // 每秒一个完整周期
```

---

## 六、注册清单（每次必做，缺一不可）

每新增一个效果，必须同步更新以下 **4 个文件**：

1. **`src/dimensions/index.ts`** — import + 加入 `DIMENSIONS` 对象
2. **`server/colorGen.js`** — 加入 `DIMENSION_OPTIONS` 数组
3. **`public/index.html`** — 加按钮（英文名，与 reactbits 侧边栏名称一致；Background 选项按 reactbits 侧边栏原始编号顺序排列）：
   `{ value: 'xxx', label: 'Xxx Name' }` 插入 `DIM_CONFIG` 对应 key 的 `options` 数组，位置对应 reactbits 编号
4. **Rebuild preview bundle**:
```bash
cd /Users/chenjiaqi/developer/Automatic-picture/poster-motion
npx esbuild src/preview-entry.tsx \
  --bundle --outfile=public/preview.bundle.js \
  --loader:.tsx=tsx --loader:.ts=tsx \
  --define:process.env.NODE_ENV='"development"' \
  --external:canvas 2>&1 | tail -3
```

### 文件命名规范

| 类型 | 目录 | 命名 |
|---|---|---|
| 背景 | `src/dimensions/background/` | `XxxBg.tsx` |
| 文字效果 | `src/dimensions/textEffect/` | `XxxText.tsx` |
| 装饰 | `src/dimensions/decoration/` | `XxxDecor.tsx` |
| 入场 | `src/dimensions/entrance/` | `XxxIn.tsx` |

---

## 七、效果总清单

图例（状态列）：`✅` 已实现 | `✅⚠️` 自制版（非精确移植）| `—` 未实现

> **项目 key 命名规则**：reactbits slug 去连字符转 camelCase。`line-waves` → `lineWaves`，`split-text` → `splitText`，单词 `silk` / `aurora` 等不变。

---

### 8.1 Backgrounds（共 42 个）

按难度从低到高排序，同难度内按 reactbits 侧边栏编号排序。

| 难度 | name | 状态 |
|------|------|------|
| 最低 | radar | — |
| 最低 | soft-aurora | — |
| 最低 | gradient-blinds | — |
| 最低 | grainient | — |
| 最低 | grid-scan | — |
| 最低 | iridescence | — |
| 最低 | letter-glitch | — |
| 最低 | grid-motion | — |
| 常规 | silk | ✅ |
| 常规 | line-waves | ✅ |
| 常规 | aurora | ✅ |
| 常规 | beams | ✅ |
| 常规 | galaxy | ✅ |
| 常规 | ripple-grid | ✅ |
| 常规 | dot-field | ✅ |
| 常规 | dot-grid | ✅ |
| 常规 | threads | ✅ |
| 常规 | waves | ✅ |
| 常规 | ballpit | ✅ |
| 常规 | balatro | ✅ |
| 常规 | particles | — |
| 常规 | pixel-snow | — |
| 常规 | faulty-terminal | — |
| 常规 | grid-distortion | — |
| 常规 | shape-grid | — |
| 常规 | orb | — |
| 中等 | dark-veil | — |
| 中等 | floating-lines | — |
| 中等 | pixel-blast | — |
| 中等 | color-bends | — |
| 中等 | plasma | — |
| 中等 | plasma-wave | — |
| 中等 | lightning | — |
| 中等 | dither | — |
| 中等 | hyperspeed | — |
| 很难 | liquid-ether | — |
| 很难 | prism | — |
| 很难 | light-pillar | — |
| 很难 | light-rays | — |
| 很难 | evil-eye | — |
| 很难 | prismatic-burst | — |
| 很难 | liquid-chrome | — |
| ⚠️自制 | gradient | ✅ |
| ⚠️自制 | blocks | ✅ |

---

### 8.2 Text Animations（共 23 个）

按难度从低到高排序，同难度内按 reactbits 侧边栏编号排序。

| 难度 | name | 状态 |
|------|------|------|
| 最低 | shiny-text | ✅ |
| 最低 | fuzzy-text | ✅ |
| 最低 | gradient-text | ✅ |
| 最低 | text-cursor | — 交互依赖，跳过 |
| 最低 | rotating-text | ✅ |
| 最低 | glitch-text | ✅ |
| 最低 | count-up | ✅ |
| 常规 | split-text | ✅ |
| 常规 | blur-text | ✅ |
| 常规 | circular-text | ✅ |
| 常规 | text-type | ✅ |
| 常规 | shuffle | ✅ |
| 常规 | falling-text | — |
| 常规 | decrypted-text | — |
| 常规 | true-focus | — |
| 常规 | scrambled-text | — |
| 中等 | text-pressure | — |
| 中等 | curved-loop | — |
| 中等 | scroll-float | — |
| 中等 | scroll-reveal | — |
| 中等 | ascii-text | — |
| 中等 | scroll-velocity | — |
| 中等 | variable-proximity | — |

---

### 8.3 Animations（共 29 个）

> 大多数 Animations 是 mouse/cursor/click 依赖效果，不适合无交互的帧渲染。
> 可移植的效果挂到对应槽（background / decoration / entrance）。

**可移植（按难度从低到高）：**

| 难度 | name | 适用槽 | 状态 |
|------|------|--------|------|
| 最低 | fade-content | entrance | — |
| 最低 | logo-loop | decoration | — |
| 最低 | gradual-blur | entrance | — |
| 最低 | shape-blur | decoration | — |
| 最低 | star-border | decoration | — |
| 常规 | animated-content | entrance | — |
| 常规 | electric-border | decoration | — |
| 常规 | pixel-transition | background/entrance | — |
| 常规 | magic-rings | decoration | — |
| 常规 | magnet-lines | background | — |
| 常规 | sticker-peel | decoration | — |
| 常规 | cubes | background | — |
| 常规 | noise | background/decoration | — |
| 中等 | orbit-images | decoration | — |
| 中等 | ribbons | background | — |
| 中等 | meta-balls | background | — |
| 很难 | metallic-paint | background | — |

**不可移植（交互依赖，跳过）：**
glare-hover, target-cursor, antigravity, ghost-cursor, click-spark, laser-flow, magnet, pixel-trail, crosshair, image-trail, splash-cursor, blob-cursor

---

### 8.4 Components（共 36 个）

> 大多是完整 UI 组件（卡片、导航、画廊），暂不实现。以下有视觉层可借鉴的标注。

fluid-glass（毛玻璃）、reflective-card（反光卡片）、tilted-card（3D 倾斜）、glass-surface（玻璃材质）、border-glow（边框发光）、chroma-grid（色彩网格）、magic-bento（网格布局动画）、flying-posters（多图海报布局参考）

---

## 八、常见陷阱

1. **reactbits 用 OGL/Three.js** — 不安装这些库。提取 GLSL shader，用 raw WebGL + `initGL` 运行。
2. **GSAP InertiaPlugin** — 私有插件，不可用。用帧驱动虚拟轨道点替代：`hx = W/2 + cos(t)*W*0.28`
3. **CSS Modules / Tailwind** — 转为 React inline style 对象。
4. **两个 `useEffect` 分开是正确的** — `[]` 初始化 GL，`[frame]` 渲染帧。不要合并。
5. **构建后必须硬刷新浏览器** — `http://127.0.0.1:4330`，不是热更新。
6. **渲染帧 45 vs 60** — render.js 中 `frame = 45`，入场动画有动感；60 看起来已经静止。
