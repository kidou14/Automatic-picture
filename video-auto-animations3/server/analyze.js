/**
 * analyze.js — Claude API: page analysis → interaction plan JSON
 * Identical to video-auto-animations (V1).
 */
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

  const systemPrompt = `You are an expert product demo director creating a 15-second promotional video. Given a web page screenshot and metadata, design a walkthrough that tells a compelling story in 4-5 steps.

Rules:
- Pick interactions that create clear BEFORE → AFTER visual contrast (state changes, reveals, results appearing)
- Each step should show the product doing something impressive — avoid redundant or low-impact actions
- Prefer: clicking tabs/buttons that reveal new content, filling forms that show live results, navigating to a key feature
- Avoid: scrolling without purpose, clicking links that navigate away, hovering with no state change
- callout_text should be action-oriented and specific (e.g. "Instant results", "One click" — not "Step 1")
- accent_color: pick the most prominent brand color visible in the screenshot (buttons, headers, logo)
- Each step must have a concrete CSS selector (id > specific class > tag) that is likely present
- Return ONLY valid JSON, no markdown code fences, no explanation`;

  const userPrompt = `${contextText}

Design a 4-5 step walkthrough. Think like a product marketer: what sequence of interactions best proves the product's value in under 15 seconds?

Return this exact JSON structure:
{
  "product_name": "short product name (2-4 words)",
  "tagline": "compelling benefit-focused tagline (5-9 words)",
  "accent_color": "#hexcolor — most prominent brand color from the screenshot",
  "steps": [
    {
      "action": "click",
      "selector": "#specific-id or .specific-class",
      "value": null,
      "scroll_y": 0,
      "description": "what changes visually after this click",
      "callout_text": "3-5 words, action-oriented"
    },
    {
      "action": "fill",
      "selector": "#input-id",
      "value": "realistic, specific sample value (not placeholder text)",
      "scroll_y": 0,
      "description": "what this input triggers or shows",
      "callout_text": "Live calculation"
    }
  ]
}

Action types: "click", "fill", "scroll"
For scroll: set scroll_y in CSS pixels (the final scroll position), selector can be null.
Prioritize steps where the after-state looks meaningfully different from the before-state.`;

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

module.exports = { planInteractions };
