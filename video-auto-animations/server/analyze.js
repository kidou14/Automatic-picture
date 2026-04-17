/**
 * analyze.js — Claude API: page analysis → interaction plan JSON
 * Reads initial screenshot + DOM metadata, returns structured interaction steps.
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

  // Extract JSON — Claude sometimes wraps in code fences despite instruction
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Claude did not return valid JSON: ${text.substring(0, 200)}`);

  const plan = JSON.parse(jsonMatch[0]);

  // Validate & sanitize
  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    throw new Error("Claude returned empty steps array");
  }
  plan.steps = plan.steps.slice(0, 5); // cap at 5
  plan.accent_color = plan.accent_color || "#6366f1";
  plan.product_name = plan.product_name || "Product";
  plan.tagline = plan.tagline || "See what it can do";

  return plan;
}

module.exports = { planInteractions };
