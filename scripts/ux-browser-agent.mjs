#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const DEFAULT_BASE_URL = process.env.UX_BASE_URL || "http://localhost:3000";
const OUTPUT_DIR = process.env.UX_REPORT_DIR || "ux-reports";
const WAIT_UNTIL = "networkidle";

const viewports = [
  {
    id: "mobile",
    label: "Mobile",
    size: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
  },
  {
    id: "desktop",
    label: "Desktop",
    size: { width: 1440, height: 1100 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
  }
];

const journeys = [
  {
    id: "first-impression",
    persona: "A first-time visitor deciding whether Fort Wayne Prays feels credible and clear.",
    goal: "Understand the campaign, notice the main action, and feel invited rather than confused.",
    steps: [
      { label: "Homepage", path: "/" },
      { label: "Prompts", path: "/prompts" },
      { label: "Community Requests", path: "/requests" }
    ]
  },
  {
    id: "start-praying",
    persona: "A church member with two free minutes who wants to start praying immediately.",
    goal: "Find and use the prayer timer without feeling forced into a guided flow.",
    steps: [
      { label: "Pray Page", path: "/log" },
      { label: "Tap Start Prayer", action: "clickText", text: "Start Prayer" },
      { label: "Open Optional Guide", action: "clickText", text: "Open guide", optional: true }
    ]
  },
  {
    id: "identity-linking",
    persona: "A returning participant trying to sign in and link themselves to the right household member.",
    goal: "See whether login language explains email/phone authorization and household member selection.",
    steps: [{ label: "Login", path: "/auth" }]
  },
  {
    id: "personal-dashboard",
    persona: "A committed participant checking progress and looking for what to pray next.",
    goal: "Understand church progress, personal progress, recent activity, and prayer prompts.",
    steps: [{ label: "Dashboard", path: "/dashboard" }]
  }
];

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function absoluteUrl(baseUrl, path) {
  return new URL(path, baseUrl).toString();
}

function safeName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanText(value) {
  return value.replace(/\s+/g, " ").trim();
}

async function collectVisibleText(locator, limit = 12) {
  const values = [];
  const count = Math.min(await locator.count(), limit);

  for (let index = 0; index < count; index += 1) {
    const text = cleanText((await locator.nth(index).innerText().catch(() => "")) || "");
    if (text) values.push(text);
  }

  return [...new Set(values)];
}

async function collectVisibleFields(page, limit = 12) {
  const fields = page.locator("input:visible, textarea:visible, select:visible");
  const values = [];
  const count = Math.min(await fields.count(), limit);

  for (let index = 0; index < count; index += 1) {
    const field = fields.nth(index);
    const label = cleanText((await field.getAttribute("aria-label").catch(() => "")) || "");
    const placeholder = cleanText((await field.getAttribute("placeholder").catch(() => "")) || "");
    const name = cleanText((await field.getAttribute("name").catch(() => "")) || "");
    const type = cleanText((await field.getAttribute("type").catch(() => "")) || "");
    values.push(label || placeholder || name || type || "unnamed field");
  }

  return [...new Set(values)];
}

async function clickByText(page, text, optional = false) {
  const target = page.getByText(text, { exact: false }).first();

  try {
    await target.waitFor({ state: "visible", timeout: 3500 });
    await target.click({ timeout: 3500 });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    return { ok: true, note: `Clicked "${text}".` };
  } catch (error) {
    return {
      ok: optional,
      note: optional
        ? `Optional action "${text}" was not available.`
        : `Could not click "${text}": ${error.message}`
    };
  }
}

function inspectExperience({ journey, step, pageData, failures, consoleErrors, actionResult }) {
  const notes = [];
  const lower = pageData.bodyText.toLowerCase();

  if (pageData.status && pageData.status >= 400) {
    notes.push(`HTTP ${pageData.status} would feel broken.`);
  }

  if (failures.length > 0) {
    notes.push(`${failures.length} request failure(s) were detected while loading this view.`);
  }

  if (consoleErrors.length > 0) {
    notes.push(`${consoleErrors.length} console error(s) were detected while using this view.`);
  }

  if (pageData.buttons.length === 0 && pageData.links.length === 0) {
    notes.push("No visible actions were detected; a user may not know what to do next.");
  }

  if (journey.id === "first-impression" && step.path === "/") {
    if (lower.includes("fort wayne") && lower.includes("kingdom")) {
      notes.push("The local Kingdom language is present on the first impression.");
    } else {
      notes.push("The first impression may not strongly connect prayer to Fort Wayne and Kingdom language.");
    }
  }

  if (journey.id === "start-praying") {
    if (lower.includes("start prayer")) {
      notes.push("Start Prayer is visible to a rushed participant.");
    }
    if (lower.includes("open guide") || lower.includes("optional")) {
      notes.push("The guided prayer support appears optional rather than mandatory.");
    }
  }

  if (journey.id === "identity-linking") {
    if (lower.includes("email") || lower.includes("phone")) {
      notes.push("Login mentions email or phone, which matches the Planning Center authorization model.");
    }
    if (lower.includes("household")) {
      notes.push("Household language is visible, helping explain shared-contact login.");
    }
  }

  if (actionResult?.note) {
    notes.push(actionResult.note);
  }

  return notes;
}

function scoreStep({ status, failures, consoleErrors, notes }) {
  let score = 5;

  if (status >= 400) score -= 2;
  if (failures.length > 0) score -= 0.5;
  if (consoleErrors.length > 0) score -= 0.5;
  if (notes.some((note) => note.startsWith("Could not click"))) score -= 1.5;
  if (notes.some((note) => note.includes("not strongly") || note.includes("may not"))) score -= 0.75;
  if (notes.some((note) => note.includes("visible") || note.includes("optional"))) score += 0.25;

  return Math.max(1, Math.min(5, score));
}

async function captureStep({ page, baseUrl, journey, step, viewport, screenshotDir }) {
  const requestFailures = [];
  const consoleErrors = [];

  const requestListener = (request) => {
    const url = request.url();
    const failure = request.failure()?.errorText || "request failed";

    if (url.includes("_rsc=")) return;
    requestFailures.push(`${request.method()} ${url} (${failure})`);
  };
  const consoleListener = (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  };

  page.on("requestfailed", requestListener);
  page.on("console", consoleListener);

  let actionResult = null;
  let response = null;

  if (step.path) {
    response = await page.goto(absoluteUrl(baseUrl, step.path), {
      waitUntil: WAIT_UNTIL,
      timeout: 30000
    });
  }

  if (step.action === "clickText") {
    actionResult = await clickByText(page, step.text, step.optional);
  }

  await page.waitForTimeout(500);

  const screenshotName = `${viewport.id}-${journey.id}-${safeName(step.label)}.png`;
  const screenshotPath = resolve(screenshotDir, screenshotName);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const bodyText = cleanText((await page.locator("body").innerText().catch(() => "")) || "");
  const pageData = {
    status: response?.status() || 200,
    url: page.url(),
    title: await page.title().catch(() => ""),
    heading: cleanText((await page.locator("h1").first().innerText().catch(() => "")) || ""),
    bodyText,
    buttons: await collectVisibleText(page.locator("button:visible")),
    links: await collectVisibleText(page.locator("a:visible")),
    inputs: await collectVisibleFields(page)
  };

  page.off("requestfailed", requestListener);
  page.off("console", consoleListener);

  const notes = inspectExperience({
    journey,
    step,
    pageData,
    failures: requestFailures,
    consoleErrors,
    actionResult
  });

  return {
    ...pageData,
    stepLabel: step.label,
    viewport: viewport.id,
    screenshotPath,
    requestFailures,
    consoleErrors,
    notes,
    score: scoreStep({
      status: pageData.status,
      failures: requestFailures,
      consoleErrors,
      notes
    })
  };
}

function renderReport({ baseUrl, generatedAt, screenshotDir, results }) {
  const lines = [
    "# Browser UX Agent Report",
    "",
    `Base URL: ${baseUrl}`,
    `Generated: ${generatedAt}`,
    `Screenshots: ${screenshotDir}`,
    "",
    "## Executive Read",
    ""
  ];

  for (const result of results) {
    const average =
      result.steps.reduce((sum, step) => sum + step.score, 0) / Math.max(1, result.steps.length);
    lines.push(`- ${result.viewport.label} / ${result.journey.id}: ${average.toFixed(1)} / 5`);
  }

  for (const result of results) {
    lines.push("", `## ${result.viewport.label}: ${result.journey.id}`, "");
    lines.push(`Persona: ${result.journey.persona}`);
    lines.push(`Goal: ${result.journey.goal}`);

    for (const step of result.steps) {
      lines.push("", `### ${step.stepLabel}`, "");
      lines.push(`- URL: ${step.url}`);
      lines.push(`- HTTP status: ${step.status}`);
      lines.push(`- H1: ${step.heading || "None detected"}`);
      lines.push(`- Screenshot: ${step.screenshotPath}`);
      lines.push(`- Buttons noticed: ${step.buttons.join(" | ") || "None detected"}`);
      lines.push(`- Links noticed: ${step.links.join(" | ") || "None detected"}`);
      lines.push(`- Inputs noticed: ${step.inputs.join(" | ") || "None detected"}`);
      lines.push(`- UX confidence: ${step.score.toFixed(1)} / 5`);

      for (const note of step.notes) {
        lines.push(`- Note: ${note}`);
      }

      for (const failure of step.requestFailures.slice(0, 5)) {
        lines.push(`- Request failure: ${failure}`);
      }

      for (const error of step.consoleErrors.slice(0, 5)) {
        lines.push(`- Console error: ${error}`);
      }
    }
  }

  lines.push(
    "",
    "## How To Use This",
    "",
    "- Open the screenshots and read the notes as a first-pass human-experience review.",
    "- Compare screenshots before and after visual changes.",
    "- Treat low scores as prompts for human discussion, not automated truth."
  );

  return `${lines.join("\n")}\n`;
}

async function runJourney({ browser, baseUrl, viewport, journey, screenshotDir }) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: viewport.size,
    userAgent: viewport.userAgent
  });
  const page = await context.newPage();
  const steps = [];

  try {
    for (const step of journey.steps) {
      steps.push(await captureStep({ page, baseUrl, journey, step, viewport, screenshotDir }));
    }
  } finally {
    await context.close();
  }

  return { viewport, journey, steps };
}

async function main() {
  const baseUrl = process.argv[2] || DEFAULT_BASE_URL;
  const generatedAt = new Date().toISOString();
  const stamp = nowStamp();
  const screenshotDir = resolve(OUTPUT_DIR, "screenshots", stamp);
  const reportPath = resolve(OUTPUT_DIR, `browser-ux-agent-${stamp}.md`);
  const latestPath = resolve(OUTPUT_DIR, "browser-latest.md");
  const results = [];

  await mkdir(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      for (const journey of journeys) {
        results.push(await runJourney({ browser, baseUrl, viewport, journey, screenshotDir }));
      }
    }
  } finally {
    await browser.close();
  }

  const markdown = renderReport({ baseUrl, generatedAt, screenshotDir, results });
  await writeFile(reportPath, markdown, "utf8");
  await writeFile(latestPath, markdown, "utf8");

  console.log(`Browser UX report written to ${reportPath}`);
  console.log(`Latest browser UX report written to ${latestPath}`);
  console.log(`Screenshots written to ${screenshotDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
