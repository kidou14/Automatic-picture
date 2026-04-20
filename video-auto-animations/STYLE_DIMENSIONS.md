# Video Style Dimensions

13 个独立维度，每个维度由 `buildStyleConfig(seed)` 按 seed 确定性随机选取。
总组合数：10×7×8×3×3×7×9×5×5×7×6×6×5 ≈ **100 亿**

---

## A — 背景氛围 `BackgroundLayer.tsx`

| ID  | 名称              | 描述                                              |
| --- | ----------------- | ------------------------------------------------- |
| A1  | Deep Space        | 浮动粒子 + HUD 网格线，科技感星空                 |
| A2  | Constellation     | 粒子 + 自动连线（距离 <130px），星座风格          |
| A3  | Neon Rain         | 22 条彩色竖线从上往下落，赛博朋克雨效             |
| A4  | Aurora Bands      | 3 条水平极光色带缓慢上下漂移，柔和渐变淡出        |
| A5  | Floating Shapes   | 7 个薄描边几何图形（正方形/菱形/三角）缓慢旋转漂移 |
| A6  | Bokeh Circles     | 14 个模糊光斑缓慢漂移，有机柔和                   |
| A7  | Concentric Rings  | 5 条同心圆从中心向外匀速扩散消隐，极简              |
| A8  | Horizon Line      | 两条水平渐变发光线缓慢上下波动，电影感             |
| A9  | Data Lines        | 7 条短横线从右向左匀速滑过，数据流风格            |
| A10 | Gradient Mesh     | 5 个径向渐变椭圆慢速浮动，渐变网格                |

> A1 / A2 额外叠加 HUD Grid 网格线。所有变体均叠加 AmbientBlobs 环境光。

---

## B — 设备帧 / 截图边框 `GenericPromo.tsx > ScreenView`

| ID | 名称            | 描述                                                   |
| -- | --------------- | ------------------------------------------------------ |
| B1 | Raw Masked      | 截图直接渲染，顶部/底部渐隐遮罩（默认）                 |
| B2 | Shadow Float    | 截图四周大面积漫射阴影，无边框，现代浮卡感              |
| B3 | Thin Stroke     | 1px accent 色细边框，配合渐隐遮罩，极简                |
| B4 | Rounded Frame   | 圆角卡片边框，透视入场动画，accent 色边框发光           |
| B5 | Glow Frame      | 截图区域内壁 accent 色内阴影光晕，无实体边框            |
| B6 | Gradient Sides  | 左右两侧渐隐入深色背景，营造沉浸"窗口"感               |
| B7 | Corner Marks    | 四角 L 型取景框标记，设计工具/取景器风格，极简          |

---

## C — 场景切换过渡 `GenericPromo.tsx > SceneTransitionWrapper`

| ID | 名称        | 描述                                              |
| -- | ----------- | ------------------------------------------------- |
| C1 | None        | 直切，无过渡效果                                  |
| C2 | Fade        | 纯透明度淡入，28 帧                               |
| C3 | Rise        | 从下方 40px 向上浮入，同步淡入，spring 缓动        |
| C4 | Pop In      | 弹入：scale 0.88→1.04→0.98→1.0，有弹性感         |
| C5 | Settle      | 从略微放大（1.06）自然收缩落定，同步淡入           |
| C6 | Iris        | 从画面中心圆形扩散展开，36 帧                     |
| C8 | Wipe        | 从左向右水平擦开，32 帧                           |
| C9 | Blur Reveal | 从 blur(14px)+透明 淡化清晰                       |

---

## D — 点击前注意引导 `AttentionGuide.tsx`

| ID | 名称       | 描述                       |
| -- | ---------- | -------------------------- |
| D1 | Pulse Ring | 脉冲扩散圆环指向点击目标   |
| D3 | Arrow      | 箭头指向目标               |
| D9 | Spotlight  | 聚光灯效果高亮目标区域     |

---

## E — 点击后状态切换 `GenericPromo.tsx > InteractionSceneView`

| ID | 名称          | 描述                                                |
| -- | ------------- | --------------------------------------------------- |
| E1 | Crossfade     | before→after 淡入淡出过渡（spring 缓动）            |
| E2 | Ripple Reveal | 从点击坐标向外圆形扩散揭开 after 截图               |
| E6 | Glitch Cut    | 点击后 12 帧横向 glitch + 过饱和，瞬切 after 截图  |

---

## F — 步骤提示文字样式 `CalloutLayer.tsx`

| ID | 名称               | 描述                                         | 是否遵循 N 定位 |
| -- | ------------------ | -------------------------------------------- | -------------- |
| F1 | Glass Card         | 毛玻璃卡片，步骤徽章 + 标题，从右滑入         | ✅             |
| F2 | Gradient Strip     | 左侧 accent 竖线 + 步骤编号 + 标题，极简风   | ✅             |
| F3 | Hero Center        | 超大居中标题 + accent 下划线，固定底部 30%   | ❌ 固定位置    |
| F5 | Terminal           | 黑色终端风格，逐字打字动画 + 光标闪烁         | ✅             |
| F6 | Pill Compact       | 圆角胶囊，单行紧凑，从左弹入                  | ✅（仅 Y 轴）  |
| F8 | Kinetic Word       | 每个单词依次从下弹入，毛玻璃底                | ✅             |
| F9 | Corner Badge       | 右上角渐变徽章，从上滑入                      | ❌ 固定右上角  |

---

## G — 光标样式 `CursorLayer.tsx`

| ID | 名称           | 描述                                                |
| -- | -------------- | --------------------------------------------------- |
| G1 | OS Cursor      | 白色箭头光标 + 点击时涟漪扩散环                     |
| G2 | Long Trail     | 8 点渐变拖尾（accent→靛蓝），带 glow                |
| G3 | Glowing Orb    | 半透明发光圆球 + 点击涟漪                           |
| G4 | Ring           | 薄圆环跟随光标 + 中心小点，精准感                   |
| G5 | Crosshair      | 十字准星（4 段分离线 + 中心点），瞄准风格            |
| G6 | Dot Trail      | 5 点短拖尾圆点，简洁                                |
| G7 | Sparkle        | 5 个旋转十字星形尾迹，轻盈动感                      |
| G8 | Magnetic       | 大圆圈滞后跟随 + 精准小点，磁吸感                   |
| G9 | Point          | 单个 6px 发光圆点，极简                             |

---

## H — 开场 Intro 动效 `GenericPromo.tsx > IntroSceneView`

| ID | 名称               | 描述                                               |
| -- | ------------------ | -------------------------------------------------- |
| H1 | Text Spring        | 标题从下弹入，accent 横线延伸展开（默认）          |
| H2 | Split Reveal       | 左右 accent 面板分开，标题从后方弹出               |
| H3 | Color Burst        | 中心径向爆炸光效，标题在爆炸消散后浮现             |
| H4 | Typewriter Resolve | 随机字符逐字"解析"成真实标题，等宽字体            |
| H5 | Record Start       | 红色 REC 录制提示符闪烁后淡出，标题从下滑入        |

---

## I — 结尾 Outro 动效 `GenericPromo.tsx > OutroSceneView`

| ID | 名称           | 描述                                              |
| -- | -------------- | ------------------------------------------------- |
| I1 | Brand Card     | 毛玻璃卡片 + 双圆环扩散，spring 弹入（默认）      |
| I2 | Glitch Out     | 正常显示后尾部 28 帧横向 glitch + 过饱和消失      |
| I3 | Scale Burst    | 尾部 32 帧 scale 放大至 1.28 同时淡出             |
| I5 | Confetti Burst | 32 片彩纸从中心爆射，CTA 文字弹入                 |
| I6 | Cinematic Fade | 整体缓慢缩放 1.06→1.0，配合淡入淡出，电影感       |

---

## J — 截图运镜（Ken Burns）`GenericPromo.tsx > ScreenView`

| ID | 名称              | 描述                                       |
| -- | ----------------- | ------------------------------------------ |
| J1 | Static            | 截图静止，无运动（默认）                   |
| J2 | Drift Right       | 缓慢放大 + 向右漂移                        |
| J3 | Drift Top-Right   | 缓慢放大 + 向左上漂移（揭示右下内容）     |
| J4 | Scroll Spring     | 点击后以 spring 缓动从 before 滚动到 after |
| J5 | Drift Bottom-Left | 缓慢放大 + 向右下漂移（揭示左上内容）     |
| J6 | Vertical Pan      | 纯竖向平移，0.022px/帧                     |
| J7 | Rotation Zoom     | 极微旋转 0.0018°/帧 + 缓慢放大，最电影感  |

---

## K — 场景入场方向 `GenericPromo.tsx > SceneTransitionWrapper`

| ID | 名称        | 描述                              |
| -- | ----------- | --------------------------------- |
| K1 | None        | 无方向动画（直接出现，默认）       |
| K2 | From Left   | 从左侧滑入（translateX -1080→0）  |
| K3 | From Right  | 从右侧滑入（translateX 1080→0）   |
| K4 | From Bottom | 从下方滑入（translateY 600→0）    |
| K5 | From Top    | 从上方滑入（translateY -600→0）   |
| K6 | Zoom In     | 从放大状态缩入（scale 1.18→1.0）  |

> K 是最外层 wrapper，与 C 叠加不冲突。spring 参数：damping 28 / stiffness 110 / 50 帧。

---

## L — 全局色温滤镜 `ColorTintLayer.tsx`

| ID | 名称         | 颜色值                    | 描述              |
| -- | ------------ | ------------------------- | ----------------- |
| L1 | None         | 无                        | 无色温偏移（默认）|
| L2 | Cool Blue    | rgba(0,60,140, 0.13)      | 冷色调，电影感    |
| L3 | Warm Amber   | rgba(140,70,0, 0.12)      | 暖色调，奢华感    |
| L4 | Purple Neon  | rgba(100,0,160, 0.12)     | 赛博朋克紫        |
| L5 | Dark Neutral | rgba(8,8,18, 0.32)        | 高对比度暗化      |
| L6 | Emerald Tech | rgba(0,120,50, 0.11)      | 矩阵绿，科技感    |

> L 是最顶层 div（zIndex: 50），覆盖所有其他层。

---

## N — 提示文字锚点位置 `CalloutLayer.tsx > calloutPosition()`

| ID | 名称          | CSS 位置                               |
| -- | ------------- | -------------------------------------- |
| N1 | Bottom Center | bottom:60, left:40, right:40（默认）  |
| N2 | Top           | top:60, left:40, right:40             |
| N3 | Bottom-Left   | bottom:60, left:40, right:"45%"       |
| N4 | Flush Bottom  | bottom:0, left:0, right:0（全宽贴底） |
| N5 | Lower Third   | bottom:"28%", left:40, right:40       |

> F3（Hero Center）和 F9（Corner Badge）忽略 N，固定自身位置。
> F6（Pill）仅使用 N 的 Y 轴，忽略 right。

---

## 组合计算

```
A(10) × B(7) × C(8) × D(3) × E(3) × F(7) × G(9) × H(5) × I(5) × J(7) × K(6) × L(6) × N(5)
≈ 100 亿种组合
```

同一个 `style_seed` 字符串每次产生完全相同的组合（xorshift32 PRNG）。
