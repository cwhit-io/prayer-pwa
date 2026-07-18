#!/usr/bin/env node

import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { Client } from "pg";

loadEnvFile(".env.local");

const DEFAULT_BASE_URL = process.env.UX_BASE_URL || "http://localhost:3000";
const OUTPUT_DIR = process.env.UX_REPORT_DIR || "ux-reports";
const WAIT_UNTIL = "domcontentloaded";
const LOGIN_CONTACT = process.env.UX_LOGIN_CONTACT || "ux-agent@blackhawkministries.org";
const LOGIN_NAME = process.env.UX_LOGIN_NAME || "UX Audit Agent";
const LOGIN_CODE = process.env.UX_LOGIN_CODE || "";
const DISABLE_DB_LOGIN = process.env.UX_DISABLE_DB_LOGIN === "1";
const SESSION_COOKIE_NAME = "prayer_session";

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
    id: "login",
    persona: "A returning participant signing in through a shared household contact method.",
    goal: "Authorize by email or phone, then land on a recognizable personal profile.",
    requiresFreshSession: true,
    steps: [
      { label: "Login Start", path: "/auth" },
      { label: "Request Code", action: "loginContact" },
      { label: "Verify Code", action: "verifyDebugCode" },
      { label: "Choose Or Create Profile", action: "finishAccount", optional: true }
    ]
  },
  {
    id: "start-praying",
    persona: "A signed-in church member with two free minutes who wants to start praying immediately.",
    goal: "Find and use the prayer timer without feeling forced into a guided flow.",
    steps: [
      { label: "Pray Page", path: "/log" },
      { label: "Tap Start Prayer", action: "clickText", text: "Start Prayer" },
      { label: "Open Optional Guide", action: "clickText", text: "Open guide", optional: true }
    ]
  },
  {
    id: "identity-linking",
    persona: "A signed-in participant checking whether their profile feels personal and understandable.",
    goal: "See name, profile context, pledge, prayer people, and account actions.",
    steps: [{ label: "Login", path: "/auth" }]
  },
  {
    id: "personal-dashboard",
    persona: "A signed-in committed participant checking progress and looking for what to pray next.",
    goal: "Understand church progress, personal progress, recent activity, and prayer prompts.",
    steps: [{ label: "Dashboard", path: "/dashboard" }]
  },
  {
    id: "signed-in-explore",
    persona: "A signed-in participant exploring the campaign features after logging in.",
    goal: "Navigate prompts, requests, prayer logging, and admin surfaces without getting lost.",
    steps: [
      { label: "Prompts", path: "/prompts" },
      { label: "Community Requests", path: "/requests" },
      { label: "My Requests", path: "/requests/mine" },
      { label: "Prayer Timer", path: "/log" },
      { label: "Admin", path: "/admin", optional: true }
    ]
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

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  const contents = readFileSync(path, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const separator = trimmed.indexOf("=");
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function isLocalUrl(baseUrl) {
  const { hostname } = new URL(baseUrl);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function roleForAuditEmail(email) {
  return email.toLowerCase().endsWith("@blackhawkministries.org") ? "admin" : "member";
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

async function clickButtonByText(page, text, optional = false) {
  const target = page.getByRole("button", { name: new RegExp(text, "i") }).first();

  try {
    await target.waitFor({ state: "visible", timeout: 3500 });
    await target.click({ timeout: 3500 });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    return { ok: true, note: `Clicked button matching "${text}".` };
  } catch (error) {
    return {
      ok: optional,
      note: optional
        ? `Optional button "${text}" was not available.`
        : `Could not click button "${text}": ${error.message}`
    };
  }
}

async function requestLoginCode(page) {
  try {
    const contactField = page.locator('input[name="contact"]').first();
    await contactField.waitFor({ state: "visible", timeout: 5000 });
    await contactField.fill(LOGIN_CONTACT);
    await clickButtonByText(page, "send code");
    await page.waitForURL(/\/auth\?challenge=/, { timeout: 10000 }).catch(() => {});

    return {
      ok: true,
      note: `Requested a login code for ${LOGIN_CONTACT}.`
    };
  } catch (error) {
    return {
      ok: false,
      note: `Could not request login code: ${error.message}`
    };
  }
}

async function verifyLoginCode(page) {
  try {
    const bodyText = cleanText((await page.locator("body").innerText().catch(() => "")) || "");
    const debugMatch = bodyText.match(/Local test code:\s*(\d{6})/i);
    const code = LOGIN_CODE || debugMatch?.[1] || "";

    if (!code) {
      return {
        ok: false,
        note:
          "No local test code was visible. Set UX_LOGIN_CODE for production-like environments where the code is delivered externally."
      };
    }

    const codeField = page.locator('input[name="code"]').first();
    await codeField.waitFor({ state: "visible", timeout: 5000 });
    await codeField.fill(code);
    await clickButtonByText(page, "verify code");
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

    return {
      ok: true,
      note: LOGIN_CODE ? "Verified login with UX_LOGIN_CODE." : "Verified login with the visible local test code."
    };
  } catch (error) {
    return {
      ok: false,
      note: `Could not verify login code: ${error.message}`
    };
  }
}

async function finishAccount(page) {
  try {
    if (/welcome,/i.test(await page.locator("body").innerText().catch(() => ""))) {
      return { ok: true, note: "Already signed in after code verification." };
    }

    const firstPersonRadio = page.locator('input[name="person_id"]').first();
    if (await firstPersonRadio.isVisible().catch(() => false)) {
      await firstPersonRadio.check();
      await clickButtonByText(page, "continue as selected person");
      return { ok: true, note: "Selected the first household/person candidate." };
    }

    const nameField = page.locator('input[name="name"]').first();
    if (await nameField.isVisible().catch(() => false)) {
      await nameField.fill(LOGIN_NAME);
      await clickButtonByText(page, "create account");
      return { ok: true, note: `Created or reused the audit profile "${LOGIN_NAME}".` };
    }

    return {
      ok: true,
      note: "No profile selection or account creation step was needed."
    };
  } catch (error) {
    return {
      ok: false,
      note: `Could not finish account setup: ${error.message}`
    };
  }
}

async function isSignedIn(page) {
  const text = cleanText((await page.locator("body").innerText().catch(() => "")) || "");
  return /welcome,/i.test(text) || /sign out/i.test(text);
}

async function createLocalAuditSession({ context, baseUrl }) {
  if (DISABLE_DB_LOGIN || !isLocalUrl(baseUrl)) {
    return {
      ok: false,
      note: "Direct audit login is disabled outside localhost unless UX_DISABLE_DB_LOGIN is unset and the target is local."
    };
  }

  if (!process.env.DATABASE_URL) {
    return {
      ok: false,
      note: "Direct audit login could not run because DATABASE_URL is not set."
    };
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
  const role = roleForAuditEmail(LOGIN_CONTACT);
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    const userResult = await client.query(
      `insert into app_users (name, email, role)
       values ($1, $2, $3)
       on conflict (email) do update
       set name = excluded.name,
           role = case when excluded.role = 'admin' then 'admin' else app_users.role end
       returning id`,
      [LOGIN_NAME, LOGIN_CONTACT.toLowerCase(), role]
    );
    const userId = userResult.rows[0]?.id;

    if (!userId) {
      return { ok: false, note: "Direct audit login could not create or find an audit user." };
    }

    await client.query(
      `insert into auth_sessions (token, user_id, expires_at)
       values ($1, $2, $3)
       on conflict (token) do update
       set user_id = excluded.user_id,
           expires_at = excluded.expires_at`,
      [token, userId, expiresAt]
    );

    await context.addCookies([
      {
        name: SESSION_COOKIE_NAME,
        value: token,
        url: new URL("/", baseUrl).toString(),
        httpOnly: true,
        sameSite: "Lax",
        expires: Math.floor(expiresAt.getTime() / 1000)
      }
    ]);

    return {
      ok: true,
      note: `Created a local ${role} audit session for ${LOGIN_CONTACT}.`
    };
  } catch (error) {
    return {
      ok: false,
      note: `Direct audit login failed: ${error.message}`
    };
  } finally {
    await client.end().catch(() => {});
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
    if (lower.includes("welcome,")) {
      notes.push("The signed-in profile greets the participant by name.");
    }
    if (lower.includes("pledge")) {
      notes.push("The signed-in profile exposes pledge/progress context.");
    }
    if (lower.includes("household")) {
      notes.push("Household language is visible, helping explain Planning Center-linked prayer people.");
    }
  }

  if (journey.id === "login") {
    if (lower.includes("email") || lower.includes("phone")) {
      notes.push("Login mentions email or phone, which matches the shared-contact authorization model.");
    }
    if (lower.includes("local test code")) {
      notes.push("A local test code is visible, so the browser agent can complete sign-in without inbox access.");
    }
    if (lower.includes("code sent") && !lower.includes("local test code")) {
      notes.push("The code was sent externally, so the agent needs UX_LOGIN_CODE or local DB session fallback.");
    }
    if (lower.includes("welcome,")) {
      notes.push("The login journey reached a signed-in profile.");
    }
  }

  if (journey.id === "signed-in-explore") {
    if (lower.includes("sign in to view")) {
      notes.push("This signed-in journey still encountered a sign-in gate.");
    }
    if (step.path === "/admin" && lower.includes("admin")) {
      notes.push("The audit identity can reach the admin surface.");
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
  if (notes.some((note) => note.startsWith("Could not request") || note.startsWith("Could not verify"))) score -= 2;
  if (notes.some((note) => note.includes("sent externally"))) score -= 1;
  if (notes.some((note) => note.startsWith("No local test code"))) score -= 1.5;
  if (notes.some((note) => note.includes("still encountered a sign-in gate"))) score -= 1.5;
  if (notes.some((note) => note.includes("not strongly") || note.includes("may not"))) score -= 0.75;
  if (notes.some((note) => note.includes("visible") || note.includes("optional"))) score += 0.25;

  return Math.max(1, Math.min(5, score));
}

async function captureStep({ context, page, baseUrl, journey, step, viewport, screenshotDir }) {
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

  console.log(`[${viewport.id}] ${journey.id}: ${step.label}`);

  if (step.path) {
    response = await page.goto(absoluteUrl(baseUrl, step.path), {
      waitUntil: WAIT_UNTIL,
      timeout: 30000
    });
  }

  if (step.action === "clickText") {
    actionResult = await clickByText(page, step.text, step.optional);
  }

  if (step.action === "loginContact") {
    actionResult = await requestLoginCode(page);
  }

  if (step.action === "verifyDebugCode") {
    actionResult = await verifyLoginCode(page);
  }

  if (step.action === "finishAccount") {
    actionResult = await finishAccount(page);
  }

  if (step.action === "localAuditSession") {
    actionResult = await createLocalAuditSession({ context, baseUrl });
    await page.goto(absoluteUrl(baseUrl, "/auth"), {
      waitUntil: WAIT_UNTIL,
      timeout: 30000
    });
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

async function runJourney({ context, page, baseUrl, viewport, journey, screenshotDir }) {
  const steps = [];

  for (const step of journey.steps) {
    steps.push(await captureStep({ context, page, baseUrl, journey, step, viewport, screenshotDir }));
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
      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: viewport.size,
        userAgent: viewport.userAgent
      });
      const page = await context.newPage();

      for (const journey of journeys) {
        if (journey.requiresFreshSession) {
          await context.clearCookies();
        }
        results.push(await runJourney({ context, page, baseUrl, viewport, journey, screenshotDir }));

        if (journey.id === "login" && !(await isSignedIn(page))) {
          results.push(
            await runJourney({
              context,
              page,
              baseUrl,
              viewport,
              screenshotDir,
              journey: {
                id: "local-audit-session",
                persona: "A browser UX agent that needs a safe local signed-in session for deeper walkthroughs.",
                goal: "Create a localhost-only audit session when email/SMS code delivery prevents automated login.",
                steps: [{ label: "Create Local Audit Session", action: "localAuditSession" }]
              }
            })
          );
        }
      }

      await context.close();
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
