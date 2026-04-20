/**
 * analyze.js — Claude API integration
 * planInteractions: page screenshot + metadata → interaction plan JSON
 * generateScenePrompts: scene list → Seedance cinematic prompts
 */
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Send page data to Claude, receive a structured interaction plan.
 * @returns { product_name, tagline, accent_color, steps[] }
 */
async function planInteractions(url, metadata, screenshotPath) {
  const base64Image = fs.readFileSync(screenshotPath).toString("base64");

  const contextText = `Page URL: ${url}
Page Title: ${metadata.title}
Meta Description: ${metadata.metaDescription || "(none)"}
Main Headings: ${[...metadata.h1, ...metadata.h2].filter(Boolean).join(" | ") || "(none)"}
Visible Buttons: ${metadata.buttons.map((b) => b.text).join(", ") || "(none)"}
Form Inputs: ${
    metadata.inputs
      .map((i) => i.label || i.placeholder || i.id || i.type)
      .filter(Boolean)
      .join(", ") || "(none)"
  }
Nav Links: ${metadata.links.map((l) => l.text).join(", ") || "(none)"}
Body Text Excerpt: ${metadata.bodyText.substring(0, 600)}`;

  const systemPrompt = `You are an expert product demo director. Given a web page screenshot and metadata, you design a concise promotional walkthrough that showcases the product's most impressive features in 4-5 steps.

Rules:
- Focus on the core value proposition and key interactions
- Prefer clicks on tabs, buttons, CTAs over scrolling
- For forms, pick 1-2 key inputs to fill with realistic sample values
- Each step must have a concrete, specific CSS selector that is likely to work
- callout_text must be 3-5 words maximum
- Return ONLY valid JSON, no markdown code fences, no explanation`;

  const userPrompt = `${contextText}

Design a 4-5 step interaction plan that highlights what makes this product special.

Return this exact JSON structure:
{
  "product_name": "short product name (2-4 words)",
  "tagline": "compelling tagline (5-9 words)",
  "accent_color": "#hexcolor matching the brand's primary color",
  "steps": [
    {
      "action": "click",
      "selector": "#specific-id or .specific-class",
      "value": null,
      "scroll_y": 0,
      "description": "what this action demonstrates",
      "callout_text": "3-5 word caption"
    },
    {
      "action": "fill",
      "selector": "#input-id",
      "value": "realistic sample value",
      "scroll_y": 0,
      "description": "what filling this shows",
      "callout_text": "Enter your data"
    }
  ]
}

Action types: "click", "fill", "scroll"
For scroll: set scroll_y in CSS pixels, selector can be null.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: base64Image },
          },
          { type: "text", text: userPrompt },
        ],
      },
    ],
  });

  const text = response.content[0].text.trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Claude did not return valid JSON: ${text.substring(0, 200)}`);

  const plan = JSON.parse(jsonMatch[0]);

  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    throw new Error("Claude returned empty steps array");
  }
  plan.steps = plan.steps.slice(0, 5);
  plan.accent_color = plan.accent_color || "#6366f1";
  plan.product_name = plan.product_name || "Product";
  plan.tagline = plan.tagline || "See what it can do";

  return plan;
}

/**
 * Generate Seedance video prompts for each scene.
 * Uses the initial screenshot + scene descriptions to write cinematic prompts.
 * @param {object} plan - { product_name, tagline, accent_color }
 * @param {Array}  sceneList - [{ type, description, callout_text, screenshotPath }]
 * @param {string} initialScreenshotPath - viewport screenshot for visual context
 * @returns {string[]} array of Seedance prompts, one per scene
 */
async function generateScenePrompts(plan, sceneList, initialScreenshotPath) {
  const base64Image = fs.readFileSync(initialScreenshotPath).toString("base64");

  const scenesText = sceneList
    .map(
      (s, i) =>
        `${i + 1}. [${s.type.toUpperCase()}] ${s.description}${
          s.callout_text ? ` | Key moment: "${s.callout_text}"` : ""
        }`
    )
    .join("\n");

  const systemPrompt = `You are a video director writing prompts for Seedance, an AI video generation model.
Write cinematic 20-35 word prompts for professional product demo video clips.
Style: Apple/Google product reveal — clean, modern, dramatic lighting, smooth camera movement, premium feel.
For scenes showing the app, describe a smartphone in-frame with the interface visible.
For the outro, describe a clean brand card with text reveal.
Return ONLY valid JSON, no markdown fences.`;

  const userPrompt = `Product: ${plan.product_name}
Tagline: "${plan.tagline}"
Brand accent color: ${plan.accent_color}

Scenes to generate (${sceneList.length} total):
${scenesText}

Write one Seedance video prompt per scene. Make each feel like a distinct shot in a premium product ad.

Return exactly:
{
  "scenes": [
    { "prompt": "20-35 word cinematic description..." },
    ...
  ]
}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: base64Image },
          },
          { type: "text", text: userPrompt },
        ],
      },
    ],
  });

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude did not return valid JSON for Seedance prompts");

  const result = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(result.scenes)) throw new Error("Invalid response: missing scenes array");

  // Pad to match scene count if Claude returned fewer
  const fallback = `${plan.product_name} app on smartphone, cinematic product reveal, dramatic lighting, smooth camera motion, premium feel`;
  while (result.scenes.length < sceneList.length) {
    result.scenes.push({ prompt: fallback });
  }

  return result.scenes.slice(0, sceneList.length).map((s) => s.prompt);
}

module.exports = { planInteractions, generateScenePrompts };
