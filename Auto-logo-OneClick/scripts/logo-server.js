#!/usr/bin/env node
/**
 * logo-server.js — Auto-logo-OneClick
 *
 * Endpoints:
 *   GET /health
 *   GET /                          — serve index.html
 *   GET /api/generate-logo?url=    — generate 512×512 logo via Qwen
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

loadLocalEnv();

const PORT = Number.parseInt(process.env.PORT || "4319", 10);
const DASHSCOPE_API_KEY = String(process.env.DASHSCOPE_API_KEY || "").trim();
const NANOBANANA_API_KEY = String(process.env.NANOBANANA_API_KEY || "").trim();
const ANTHROPIC_API_KEY = String(process.env.ANTHROPIC_API_KEY || "").trim();
const OPENROUTER_API_KEY = String(process.env.OPENROUTER_API_KEY || "").trim();

const OPENROUTER_MODELS = {
  gemini:     { id: "google/gemini-3.1-flash-image-preview", modalities: ["image", "text"] },
  gemini3pro: { id: "google/gemini-3-pro-image-preview",     modalities: ["image", "text"] },
  gpt5:       { id: "openai/gpt-5-image",                    modalities: ["image", "text"] },
  gpt5mini:   { id: "openai/gpt-5-image-mini",               modalities: ["image", "text"] },
};
const AI_TIMEOUT_MS = 90000;
const RATE_LIMIT_DELAYS = [20000, 40000, 60000];

// ─── Env loader ───────────────────────────────────────────────────────────────

function loadLocalEnv() {
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(__dirname, "..", ".env.local"),
    path.resolve(__dirname, "..", "..", ".env.local"),
  ];
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const source = fs.readFileSync(filePath, "utf8");
    source.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const sep = trimmed.indexOf("=");
      if (sep <= 0) return;
      const key = trimmed.slice(0, sep).trim();
      if (!key || process.env[key]) return;
      let value = trimmed.slice(sep + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    });
    return;
  }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

// ─── Fetch app name from URL title ───────────────────────────────────────────

function fetchPageTitle(targetUrl) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (val) => { if (!settled) { settled = true; resolve(val); } };

    const parsed = new URL(targetUrl);
    const lib = parsed.protocol === "https:" ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept": "text/html",
        "Connection": "close",
      },
      timeout: 6000,
    };

    const req = lib.request(options, (res) => {
      // Follow one redirect
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        fetchPageTitle(res.headers.location).then(done).catch(() => done(null));
        res.resume();
        return;
      }
      let html = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        html += chunk;
        // Resolve immediately once title tag is found
        const m = html.match(/<title[^>]*>([^<]{1,120})<\/title>/i);
        if (m) { done(m[1].trim()); req.destroy(); return; }
        // Give up after enough data
        if (html.length > 50000) { done(null); req.destroy(); }
      });
      res.on("end", () => {
        const m = html.match(/<title[^>]*>([^<]{1,120})<\/title>/i);
        done(m ? m[1].trim() : null);
      });
      res.on("error", () => done(null));
      res.on("close", () => done(null));
    });

    req.on("timeout", () => { req.destroy(); done(null); });
    req.on("error", () => done(null));
    req.end();
  });
}

async function resolveAppName(targetUrl) {
  try {
    const title = await fetchPageTitle(targetUrl);
    if (title) return title;
  } catch (_) {}
  // Fallback: use hostname
  try {
    return new URL(targetUrl).hostname.replace(/^www\./, "");
  } catch (_) {
    return "App";
  }
}

// ─── Prompt definition ────────────────────────────────────────────────────────
// 修改这里即可更新风格，UI 会自动同步显示

const PROMPT_STYLE = "5词库随机组合：主题概念(30) × 主体形状(30) × 主体颜色(30) × 背景颜色(30) × 设计风格(30) · 24,300,000种组合";
const PROMPT_STYLE_NEW = "AI自由创作版：Claude自由生成主题/形状/颜色(无上限) × 设计风格词库(30) · 无限组合";

// ─── 词库 A：主题概念 ─────────────────────────────────────────────────────────
const THEME_CONCEPTS = [
  "能量爆发的瞬间",
  "无限循环与永续",
  "破壳而出的突破感",
  "跨越边界的飞跃",
  "聚焦核心的专注力",
  "从混沌走向秩序",
  "向内深度探索",
  "向外辐射扩张",
  "速度与极致流动",
  "精准命中目标",
  "层层递进的成长",
  "两极之间的平衡",
  "时间加速与压缩",
  "连接与共鸣",
  "超越维度的跃升",
  "静止中蕴含的势能",
  "裂变释放巨大能量",
  "收缩聚合的引力",
  "从零诞生的起点",
  "周而复始的轮回",
  "镜像折叠的对称之美",
  "隐匿黑暗中忽然亮起的光",
  "智慧交易的胜利",
  "创造新机遇的工具",
  "边缘地带的野性与自由",
  "人工智能机器的自动化",
  "万物归一的终极形态",
  "突破历史瓶颈的喜悦",
  "未知领域的探索",
  "引领全新模式的超前",
];

// ─── 词库 B：主体形状 ─────────────────────────────────────────────────────────
const MAIN_SHAPES = [
  "双螺旋扭转体",
  "悬浮菱形嵌套结构",
  "六边形蜂巢格网",
  "三角锥立体切割面",
  "流动莫比乌斯环",
  "同心圆涟漪扩散形",
  "对称展开的羽翼弧形",
  "阶梯状上升台阶结构",
  "交叉编织的双环形",
  "放射状扇形展开",
  "断口带箭头的缺口圆环",
  "动态速度的三角箭头",
  "立方体等轴测透视",
  "流线型水滴切角形",
  "旋转45°的叉星形",
  "股市交易的蜡烛符号",
  "平行波浪线叠层形",
  "梯形金砖的意向构造",
  "极简单笔画圆弧形",
  "锐角交叉的闪电折线",
  "展开的折纸几何平面",
  "稳定坚实的正方形",
  "半透明交叠三圆盘",
  "对角线分割的正方形负空间",
  "连续S形立体波浪体",
  "网格球体经纬线框",
  "闪烁的多角形形",
  "齿轮咬合的环状结构",
  "无限符号∞的立体扭曲形",
  "二维平面极简感",
];

// ─── 词库 C1：主体颜色 ────────────────────────────────────────────────────────
const BODY_COLORS = [
  "荧光青绿，高饱和电子发光感",
  "熔岩橙红，炽热燃烧渐变",
  "霓虹紫，内发光电波质感",
  "金属钛白，冷感镜面高反光",
  "翡翠绿，通透宝石折射感",
  "赤金色，厚重暖光泽",
  "酸性柠檬黄，高亮刺激感",
  "珊瑚粉橙，温暖活力渐变",
  "冰川蓝，清透冷静单色",
  "玫瑰金，温柔渐变高级感",
  "荧光粉，赛博朋克霓虹感",
  "深靛蓝，沉稳神秘单色",
  "铬银，液态金属流动感",
  "圣诞红绿，复古英伦经典",
  "薄荷绿，清新轻盈渐变",
  "紫罗兰，梦幻深邃渐变",
  "琥珀棕，复古暖调光泽",
  "纯白，极简雪光高纯度",
  "青铜绿，氧化做旧古朴感",
  "蓝紫双色渐变，电磁能量感",
  "极光绿到深蓝渐变，北极光氛围",
  "烟熏紫灰，低调神秘哑光感",
  "荧光橙，极限运动高能量感",
  "硫磺黄绿，实验室化学刺激感",
  "草莓奶昔粉红，甜软梦幻感",
  "钴蓝，航空航天纯粹高冷感",
  "铁锈橙，后工业做旧斑驳感",
  "祖母绿到黑渐变，深沉奢华感",
  "深海珍珠色，内敛光泽漫反射",
  "磁铁哑黑，极致吸附无高光感",
];

// ─── 词库 C2：背景颜色 ────────────────────────────────────────────────────────
const BG_COLORS = [
  "纯黑，极致深邃无底色感",
  "深空海军蓝，沉静宇宙感",
  "哑光炭灰，工业冷静底",
  "深紫罗兰夜色，神秘梦境底",
  "中黄，奶油暖光底",
  "冷灰白，极简北欧风底",
  "深森林墨绿，自然沉稳底",
  "磨砂浅石灰，轻盈科技底",
  "暖米色，复古纸张质感底",
  "深棕黑，皮革厚重底",
  "冰白蓝，极地寒冷清透底",
  "孔雀青蓝，梦幻独特底",
  "深橄榄绿，自然沉稳底",
  "珍珠白，光泽高雅底",
  "深海蓝绿，神秘海洋底",
  "暖象牙白，阳光柔和底",
  "月岩浅灰，冷静科技底",
  "尊贵金，奢华财富底",
  "玫瑰米粉，温柔少女底",
  "深炭蓝灰，现代专业底",
  "茄子深紫，浓烈当代艺术底",
  "枯叶棕黄，秋日温度感底",
  "青瓷浅绿，东方雅致静谧底",
  "岩浆黑红渐变，能量暗底",
  "银河黑紫渐变，深空星云底",
  "丁香浅粉灰，柔和高雅中性底",
  "苔藓灰绿，户外自然复古底",
  "正红，饱满热烈高饱和底",
  "极深午夜蓝黑，低调沉浸底",
  "水泥灰白，极简建筑风冷底",
];

// ─── 词库 D：设计风格 ─────────────────────────────────────────────────────────
const DESIGN_STYLES = [
  "macOS磨砂玻璃半透明质感",
  "金属铸造感，高光冷硬",
  "霓虹发光，暗底内发光效果",
  "油墨扩散，流体有机笔触",
  "等距几何立体像素风",
  "C4D高清三维渲染，超写实",
  "极简线条主义，单色细线",
  "剪纸叠层，阴影感分层",
  "水彩晕染，边缘柔和溢色",
  "玻璃折射，高透明度刻面感",
  "丝网印刷，复古颗粒质感",
  "渐变扁平化，无阴影极简",
  "布纹纤维质感，柔软立体",
  "发光粒子散点，科技动感",
  "哑光低光泽，沉稳厚重感",
  "液态金属，流动高反射",
  "木刻版画，粗犷刀刻纹理",
  "荧光描边，暗色调涂鸦风",
  "未来主义线框，透明骨骼感",
  "超扁平插画，明快色块分区",
  "彩色玻璃镶嵌，教堂花窗美感",
  "激光切割金属，精密工业锐利感",
  "故障艺术，RGB通道错位撕裂感",
  "烫金压纹，高档印刷工艺奢华感",
  "点彩画法，细密色点矩阵构成",
  "数字像素溶解，低分辨率美学感",
  "蜡笔手绘，粗粝童趣涂鸦感",
  "折纸立体构造，精准折叠切面感",
  "磁共振扫描风，科学成像冷峻感",
  "渐变描边叠加，多层轮廓光晕感",
];

function buildPrompt(appName) {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const A  = pick(THEME_CONCEPTS);
  const B  = pick(MAIN_SHAPES);
  const C1 = pick(BODY_COLORS);
  const C2 = pick(BG_COLORS);
  const D  = pick(DESIGN_STYLES);

  return `请生成一个精致的512×512的App logo图标。

应用名称：${appName}

主题概念：${A}
主体形状：${B}
主体颜色：${C1}
背景颜色：${C2}
设计风格：${D}

要求：图形占画布80%面积，无文字，无字母，无水印，无底部衬底，高清渲染品质，主体与背景高对比度`;
}

// ─── AI-free buildPromptNew (logo-rule-new.md) ───────────────────────────────

const CLAUDE_META_PROMPT = `你是一位充满创意的Logo概念设计师。你的任务是为一款App生成一套简洁而独特的Logo设计概念。

App名称：{appName}

请从设计师的视角，自由地、大胆地创作以下4个设计维度。不要使用任何预设模板，不要走平庸路线，要寻找独特有趣的设计角度。4个维度之间应有内在的视觉逻辑和情感一致性。

【维度1：主题概念】
为这个Logo选择一个视觉驱动的抽象主题，这是整个Logo的情感内核。
- 可以来自任意领域：自然科学、哲学、金融交易、ai智能、物理现象、数学结构、全新工具、创意脑洞、天文宇宙、生物进化、音乐节奏、建筑空间、光学折射、量子力学、游戏机制、化学反应、航空航天、心理认知、工业制造、密码加密等
- 要足够具体和有画面感（不要泛泛的"创新""连接"等词）
- 用10-20字中文描述

【维度2：主体形状】
选择一个具体的、可视化的形态作为Logo的主体骨架。
- 要具体到可以让画师直接画出来的程度
- 可以是圆形、方形、长方形、三角、菱形、多边形、多角星形、梯形、钻石形、镂空形、几何体、圆柱、圆锥、有机形态、工程结构、符号变体、拓扑形态等等简洁的二维或三维形态
- 形状要与维度1的主题有内在关联
- 用10-20字中文描述

【维度3：主体颜色】
为Logo主体选择颜色，要附带质感描述。
- 包含：色调 + 视觉质感（发光/金属/渐变/哑光/折射等）
- 与主题概念要有情感上的共鸣
- 用10-20字中文描述

【维度4：背景颜色】
选择背景色，要与主体颜色形成强烈的对比或戏剧性的互补关系。
- 必须是纯色或简单渐变色，严禁出现纹理、花纹、图案、噪点等任何装饰性元素
- 包含：色调 + 氛围感描述
- 用10-20字中文描述

注意：请避免以下常见陈词滥调：纯黑背景+霓虹主体、蓝色科技感、简单几何+渐变配色。请寻找更意外、更有记忆点的组合。

以纯JSON格式输出，不要有任何额外文字或markdown标记：
{
  "theme": "...",
  "shape": "...",
  "body_color": "...",
  "bg_color": "...",
  "internal_logic": "一句话说明这4个维度的内在关联（供调试查看，不进入图像prompt）"
}`;

async function buildPromptNew(appName) {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY 未配置，请在 .env.local 中设置");

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const metaPrompt = CLAUDE_META_PROMPT.replace("{appName}", appName);

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      temperature: 1,
      messages: [{ role: "user", content: metaPrompt }],
    }),
  });

  if (!claudeRes.ok) {
    const errText = await claudeRes.text().catch(() => "");
    throw new Error(`Claude API error ${claudeRes.status}: ${errText.slice(0, 200)}`);
  }

  const claudeData = await claudeRes.json();
  const rawText = claudeData.content[0].text.trim();
  // Strip markdown code fences if model wraps output
  const jsonText = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  const creative = JSON.parse(jsonText);

  const D = pick(DESIGN_STYLES);
  console.log(`[logo-new] theme: ${creative.theme} | shape: ${creative.shape} | style: ${D}`);
  console.log(`[logo-new] logic: ${creative.internal_logic}`);

  return `请生成一个精致的512×512的App logo图标。

应用名称：${appName}

主题概念：${creative.theme}
主体形状：${creative.shape}
主体颜色：${creative.body_color}
背景颜色：${creative.bg_color}
设计风格：${D}

要求：图形占画布80%面积，无文字，无字母，无水印，无底部衬底，高清渲染品质，主体与背景高对比度`;
}

// ─── Logo generation ──────────────────────────────────────────────────────────

async function generateLogo(targetUrl, rule = "classic") {
  if (!DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY 未配置，请在 .env.local 中设置");

  const appName = await resolveAppName(targetUrl);
  const prompt = rule === "new" ? await buildPromptNew(appName) : buildPrompt(appName);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  let response;
  for (let attempt = 0; attempt <= RATE_LIMIT_DELAYS.length; attempt++) {
    response = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DASHSCOPE_API_KEY}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "qwen-image-2.0-pro",
          input: { messages: [{ role: "user", content: [{ text: prompt }] }] },
          parameters: { size: "512*512" },
        }),
      }
    );

    if (response.status === 429 && attempt < RATE_LIMIT_DELAYS.length) {
      const wait = RATE_LIMIT_DELAYS[attempt];
      console.warn(`[logo] 429 rate limit, waiting ${wait / 1000}s before retry ${attempt + 1}...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    break;
  }

  clearTimeout(timer);

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Qwen API error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const imageUrl = data?.output?.choices?.[0]?.message?.content?.[0]?.image;
  if (!imageUrl) {
    throw new Error(`Qwen 未返回图片: ${JSON.stringify(data).slice(0, 200)}`);
  }

  const imgRes = await fetch(imageUrl);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  return {
    appName,
    imageDataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
  };
}

// ─── Nanobanana (Gemini Image) logo generation ───────────────────────────────

async function generateLogoNanobanana(targetUrl, rule = "classic") {
  if (!NANOBANANA_API_KEY) throw new Error("NANOBANANA_API_KEY 未配置，请在 .env.local 中设置");

  const appName = await resolveAppName(targetUrl);
  const prompt = rule === "new" ? await buildPromptNew(appName) : buildPrompt(appName);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    let response;
    for (let attempt = 0; attempt <= RATE_LIMIT_DELAYS.length; attempt++) {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/nano-banana-pro-preview:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": NANOBANANA_API_KEY,
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
          }),
        }
      );

      if (response.status === 429 && attempt < RATE_LIMIT_DELAYS.length) {
        const wait = RATE_LIMIT_DELAYS[attempt];
        console.warn(`[nanobanana] 429 rate limit, waiting ${wait / 1000}s before retry ${attempt + 1}...`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      break;
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`Nanobanana API error ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData?.mimeType?.startsWith("image/"));
    if (!imagePart) {
      throw new Error(`Nanobanana 未返回图片: ${JSON.stringify(data).slice(0, 200)}`);
    }

    const mimeType = imagePart.inlineData.mimeType;
    return {
      appName,
      imageDataUrl: `data:${mimeType};base64,${imagePart.inlineData.data}`,
    };
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Nanobanana 生成超时");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// ─── OpenRouter image generation ─────────────────────────────────────────────

async function generateLogoOpenRouter(targetUrl, modelKey, rule = "classic") {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY 未配置，请在 .env.local 中设置");
  const modelMeta = OPENROUTER_MODELS[modelKey];
  if (!modelMeta) throw new Error(`未知模型: ${modelKey}`);
  const { id: modelId, modalities } = modelMeta;

  const appName = await resolveAppName(targetUrl);
  const prompt = rule === "new" ? await buildPromptNew(appName) : buildPrompt(appName);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    let response;
    for (let attempt = 0; attempt <= RATE_LIMIT_DELAYS.length; attempt++) {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
          image_config: { aspect_ratio: "1:1" },
        }),
      });

      if (response.status === 429 && attempt < RATE_LIMIT_DELAYS.length) {
        const wait = RATE_LIMIT_DELAYS[attempt];
        console.warn(`[openrouter:${modelKey}] 429 rate limit, waiting ${wait / 1000}s before retry ${attempt + 1}...`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      break;
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`OpenRouter API error ${response.status}: ${errText.slice(0, 300)}`);
    }

    const data = await response.json();
    const message = data?.choices?.[0]?.message;

    // Try images[] array (OpenRouter normalised format)
    const fromImages = message?.images?.[0]?.image_url?.url;
    if (fromImages) return { appName, imageDataUrl: fromImages };

    // Try content[] array (OpenAI vision format)
    if (Array.isArray(message?.content)) {
      const imgPart = message.content.find((p) => p.type === "image_url");
      if (imgPart?.image_url?.url) return { appName, imageDataUrl: imgPart.image_url.url };
    }

    throw new Error(`OpenRouter 未返回图片: ${JSON.stringify(data).slice(0, 300)}`);
  } catch (err) {
    if (err?.name === "AbortError") throw new Error(`OpenRouter (${modelKey}) 生成超时`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── URL normalizer ───────────────────────────────────────────────────────────

function normalizeUrl(raw) {
  if (!raw) throw new Error("缺少 url 参数");
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  if (!req.url) { sendJson(res, 400, { error: "Missing URL" }); return; }

  if (req.method === "OPTIONS") {
    setCorsHeaders(res); res.writeHead(204); res.end(); return;
  }

  const requestUrl = new URL(req.url, `http://127.0.0.1:${PORT}`);

  // Health check
  if (req.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(res, 200, { ok: true }); return;
  }

  // Prompt hint (让前端实时显示当前风格)
  if (req.method === "GET" && requestUrl.pathname === "/api/prompt-hint") {
    const rule = requestUrl.searchParams.get("rule") || "classic";
    sendJson(res, 200, { hint: rule === "new" ? PROMPT_STYLE_NEW : PROMPT_STYLE }); return;
  }

  // Serve index.html
  if (req.method === "GET" && (requestUrl.pathname === "/" || requestUrl.pathname === "/index.html")) {
    const htmlPath = path.resolve(__dirname, "..", "index.html");
    if (!fs.existsSync(htmlPath)) { sendJson(res, 404, { error: "index.html not found" }); return; }
    setCorsHeaders(res);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
    fs.createReadStream(htmlPath).pipe(res);
    return;
  }

  // Generate logo (?model=qwen|nanobanana, default: qwen)
  if (req.method === "GET" && requestUrl.pathname === "/api/generate-logo") {
    try {
      const targetUrl = normalizeUrl(requestUrl.searchParams.get("url"));
      const model = requestUrl.searchParams.get("model") || "qwen";
      const rule = requestUrl.searchParams.get("rule") || "classic";
      console.log(`[logo] generating via ${model} (rule: ${rule}) for: ${targetUrl}`);
      const result = (model in OPENROUTER_MODELS)
        ? await generateLogoOpenRouter(targetUrl, model, rule)
        : model === "nanobanana"
          ? await generateLogoNanobanana(targetUrl, rule)
          : await generateLogo(targetUrl, rule);
      console.log(`[logo] done for: ${result.appName}`);
      sendJson(res, 200, result);
    } catch (err) {
      console.error("[logo] error:", err.message);
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[logo-server] ready → http://127.0.0.1:${PORT}`);
});

server.on("error", (err) => {
  console.error("[logo-server] fatal:", err.message);
  process.exit(1);
});
