#!/usr/bin/env node
/**
 * Record live Fort Wayne Prays walkthrough clips for the explainer video.
 * Uses a dedicated demo member (no admin, no Planning Center, invented Four Friends).
 * Does not submit a pledge or a prayer request. Guest timer save is 1 whole minute.
 */
import crypto from "node:crypto";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { Client } from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
loadEnvFile(".env.local");

const BASE_URL = (process.env.EXPLAINER_BASE_URL || "https://fortwayneprays.org").replace(/\/$/, "");
const OUT_DIR = resolve(root, "docs/explainer-video/capture");
const RAW_DIR = resolve(OUT_DIR, "raw");
const CLIP_DIR = resolve(OUT_DIR, "clips");
const DEMO_EMAIL = "demo.explainer@unlinked.local";
const DEMO_NAME = "Alex Demo";
const DEMO_FRIENDS = ["Jordan", "Casey", "Avery", "Riley"];
const NIGHT = "0x101010";
const MOBILE = { width: 430, height: 932 };
const DESKTOP = { width: 1920, height: 1080 };

mkdirSync(RAW_DIR, { recursive: true });
mkdirSync(CLIP_DIR, { recursive: true });

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const separator = trimmed.indexOf("=");
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function log(message) {
  console.log(`[explainer] ${message}`);
}

async function hold(page, ms) {
  await page.waitForTimeout(ms);
}

async function ready(page) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await hold(page, 600);
}

async function tap(page, locator) {
  await locator.first().waitFor({ state: "visible", timeout: 12000 });
  await locator.first().scrollIntoViewIfNeeded();
  const box = await locator.first().boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 14 });
    await hold(page, 280);
  }
  await locator.first().click({ timeout: 8000 });
  await ready(page);
}

async function dismissUnsaved(page) {
  const leave = page.getByRole("button", { name: /leave without saving|finish without saving/i });
  if (await leave.isVisible().catch(() => false)) {
    await leave.click();
    await ready(page);
  }
}

async function goto(page, path) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await ready(page);
  await dismissUnsaved(page);
}

function installCursorInit() {
  return () => {
    const style = document.createElement("style");
    style.textContent = `
      #explainer-cursor {
        position: fixed; top: 0; left: 0; width: 22px; height: 22px; margin-left: -11px; margin-top: -11px;
        border: 3px solid #ffd300; background: rgba(255,211,0,0.28); border-radius: 999px;
        pointer-events: none; z-index: 2147483647; transition: transform 80ms linear;
      }
    `;
    const cursor = document.createElement("div");
    cursor.id = "explainer-cursor";
    document.documentElement.appendChild(style);
    document.documentElement.appendChild(cursor);
    window.addEventListener(
      "mousemove",
      (event) => {
        cursor.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
      },
      { passive: true }
    );
  };
}

async function ensureDemoUser() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to create the demo session.");
  }
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 8000
  });
  await client.connect();
  try {
    const userResult = await client.query(
      `insert into app_users (name, email, role, planning_center_sync_status)
       values ($1, $2, 'member', 'unlinked')
       on conflict (email) do update
       set name = excluded.name,
           role = 'member'
       returning id`,
      [DEMO_NAME, DEMO_EMAIL]
    );
    const userId = userResult.rows[0].id;
    for (const [index, name] of DEMO_FRIENDS.entries()) {
      await client.query(
        `insert into prayer_friend_slots (user_id, slot, name, updated_at)
         values ($1, $2, $3, now())
         on conflict (user_id, slot)
         do update set name = excluded.name, updated_at = now()`,
        [userId, index + 1, name]
      );
    }
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12);
    await client.query(
      `insert into auth_sessions (token, user_id, expires_at)
       values ($1, $2, $3)`,
      [token, userId, expiresAt]
    );
    log(`Demo member ready (${DEMO_EMAIL}), session ${token.slice(0, 8)}…`);
    return { userId, token, expiresAt };
  } finally {
    await client.end();
  }
}

function sessionCookies(token, expiresAt) {
  const url = new URL(BASE_URL);
  const secure = url.protocol === "https:";
  return [
    {
      name: "prayer_session",
      value: token,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "Lax",
      expires: Math.floor(expiresAt.getTime() / 1000)
    }
  ];
}

async function recordContext({ browser, name, viewport, cookies, run }) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    userAgent:
      viewport.width < 800
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
        : "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    locale: "en-US",
    timezoneId: "America/Indiana/Indianapolis",
    colorScheme: "dark",
    recordVideo: {
      dir: RAW_DIR,
      size: viewport
    }
  });
  if (cookies?.length) {
    await context.addCookies(cookies);
  }
  const page = await context.newPage();
  await page.addInitScript(installCursorInit());
  try {
    await run(page);
    await hold(page, 1500);
  } finally {
    const video = page.video();
    await page.close();
    await context.close();
    const src = video ? await video.path() : null;
    if (!src) {
      throw new Error(`No video recorded for ${name}`);
    }
    const dest = resolve(RAW_DIR, `${name}.webm`);
    spawnSync("mv", [src, dest], { stdio: "inherit" });
    log(`Wrote ${dest}`);
    return dest;
  }
}

function toMp4(webmPath, mp4Path, { letterbox = false, viewport } = {}) {
  const args = ["-y", "-i", webmPath];
  if (letterbox && viewport) {
    args.push(
      "-vf",
      `scale=-2:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:${NIGHT},fps=30,format=yuv420p`
    );
  } else {
    args.push("-vf", "fps=30,format=yuv420p");
  }
  args.push("-c:v", "libopenh264", "-b:v", "5M", "-an", mp4Path);
  const result = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed for ${mp4Path}: ${result.stderr?.slice(-400)}`);
  }
  log(`Encoded ${mp4Path}`);
}

async function guestJourney(page) {
  log("Guest: homepage");
  await goto(page, "/");
  await page.locator('img[alt="Pray Like Crazy"]').first().waitFor({ timeout: 15000 });
  await hold(page, 2500);
  await page.mouse.wheel(0, 700);
  await hold(page, 2200);
  await page.mouse.wheel(0, 900);
  await hold(page, 2000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await hold(page, 1200);

  const start = page.getByRole("link", { name: /start praying/i }).first();
  await tap(page, start);
  await page.getByRole("heading", { name: /start praying/i }).waitFor({ timeout: 15000 });
  await hold(page, 2200);

  log("Guest: timer");
  await tap(page, page.getByRole("button", { name: /start timer/i }));
  await hold(page, 5000);
  await tap(page, page.getByRole("button", { name: /^pause$/i }));
  await hold(page, 1800);
  const save = page.getByRole("button", { name: /record prayer time|save prayer time/i });
  await tap(page, save);
  await hold(page, 2500);

  log("Guest: add completed time");
  await goto(page, "/add-time");
  const minutes = page.locator('input[name="minutes"]');
  await minutes.waitFor({ state: "visible" });
  await tap(page, minutes);
  await minutes.fill("15");
  await hold(page, 2500);

  log("Guest: guided prayer");
  await goto(page, "/log");
  await dismissUnsaved(page);
  await tap(page, page.getByRole("link", { name: /start guided prayer/i }));
  await hold(page, 2200);
  for (const name of ["Confession", "Thanksgiving", "Supplication"]) {
    const tab = page.getByRole("button", { name });
    if (await tab.isVisible().catch(() => false)) {
      await tap(page, tab);
      await hold(page, 1600);
    }
  }
  const finish = page.getByRole("button", { name: /finish prayer/i });
  if (await finish.isVisible().catch(() => false)) {
    await tap(page, finish);
    await hold(page, 800);
  }
  await dismissUnsaved(page);
  await hold(page, 1000);

  log("Guest: sign-in form (do not send a code)");
  await goto(page, "/auth");
  const contact = page.locator('input[name="contact"]');
  await contact.waitFor({ state: "visible" });
  await tap(page, contact);
  await contact.pressSequentially("you@example.com", { delay: 70 });
  await contact.evaluate((el) => {
    el.style.filter = "blur(7px)";
  });
  await hold(page, 2800);
}

async function signedInJourney(page) {
  log("Signed-in: Me / pledge");
  await goto(page, "/auth");
  await hold(page, 1800);
  const pledge = page.getByRole("heading", { name: /make a prayer pledge/i });
  if (await pledge.isVisible().catch(() => false)) {
    await pledge.scrollIntoViewIfNeeded();
    await hold(page, 1500);
    const ten = page.getByRole("button", { name: /10 min\/day/i });
    if (await ten.isVisible().catch(() => false)) {
      await tap(page, ten);
      await hold(page, 1200);
    }
    const fifteen = page.getByRole("button", { name: /15 min\/day/i });
    if (await fifteen.isVisible().catch(() => false)) {
      await tap(page, fifteen);
      await hold(page, 1800);
    }
    await page.mouse.wheel(0, 280);
    await hold(page, 1500);
  } else {
    const update = page.getByRole("button", { name: /update campaign pledge/i });
    if (await update.isVisible().catch(() => false)) {
      await tap(page, update);
      await hold(page, 2000);
      const cancel = page.getByRole("button", { name: /^cancel$/i });
      if (await cancel.isVisible().catch(() => false)) await tap(page, cancel);
    }
  }

  log("Signed-in: Four Friends");
  const friendsHeading = page.getByRole("heading", { name: /my four friends/i });
  if (await friendsHeading.isVisible().catch(() => false)) {
    await friendsHeading.scrollIntoViewIfNeeded();
    await hold(page, 2200);
  } else {
    await goto(page, "/auth#friends");
    await hold(page, 2000);
  }

  log("Signed-in: people");
  await goto(page, "/people");
  await hold(page, 1800);
  const prayJordan = page.getByRole("link", { name: /pray for jordan/i });
  if (await prayJordan.isVisible().catch(() => false)) {
    await tap(page, prayJordan);
    await hold(page, 1800);
    const start = page.getByRole("button", { name: /start timer/i });
    if (await start.isVisible().catch(() => false)) {
      await tap(page, start);
      await hold(page, 2500);
      const pause = page.getByRole("button", { name: /^pause$/i });
      if (await pause.isVisible().catch(() => false)) await tap(page, pause);
    }
    await hold(page, 1500);
    const finish = page.getByRole("button", { name: /finish prayer/i });
    if (await finish.isVisible().catch(() => false)) await tap(page, finish);
    await dismissUnsaved(page);
  }

  log("Signed-in: requests (do not submit)");
  await goto(page, "/requests/mine");
  await hold(page, 1800);
  const community = page.getByText("Signed-in community", { exact: false }).first();
  if (await community.isVisible().catch(() => false)) {
    await tap(page, community);
    await hold(page, 1400);
  }
  const privateReq = page.getByText("Private request", { exact: false }).first();
  if (await privateReq.isVisible().catch(() => false)) {
    await tap(page, privateReq);
    await hold(page, 1400);
  }
  const title = page.locator('input[name="title"]');
  if (await title.isVisible().catch(() => false)) {
    await tap(page, title);
    await title.fill("Peace for our city");
    await hold(page, 2200);
  }

  log("Signed-in: homepage close");
  await goto(page, "/");
  await hold(page, 2500);
  await page.mouse.wheel(0, 650);
  await hold(page, 2200);
}

async function desktopHomepage(page) {
  log("Desktop: homepage pulse");
  await goto(page, "/");
  await page.locator('img[alt="Pray Like Crazy"]').first().waitFor({ timeout: 15000 });
  await hold(page, 2800);
  await page.mouse.wheel(0, 780);
  await hold(page, 2500);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await hold(page, 1800);
}

function concatMp4(inputs, output) {
  const listPath = resolve(OUT_DIR, "concat.txt");
  writeFileSync(listPath, inputs.map((file) => `file '${file}'`).join("\n"));
  const result = spawnSync(
    "ffmpeg",
    ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", output],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(`concat failed: ${result.stderr?.slice(-400)}`);
  }
  log(`Master ${output}`);
}

async function main() {
  const demo = await ensureDemoUser();
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"]
  });

  const notes = [];
  try {
    const guestWebm = await recordContext({
      browser,
      name: "01-guest-mobile",
      viewport: MOBILE,
      run: guestJourney
    });
    const signedWebm = await recordContext({
      browser,
      name: "02-signedin-mobile",
      viewport: MOBILE,
      cookies: sessionCookies(demo.token, demo.expiresAt),
      run: signedInJourney
    });
    const desktopWebm = await recordContext({
      browser,
      name: "03-homepage-desktop",
      viewport: DESKTOP,
      run: desktopHomepage
    });

    const guestMp4 = resolve(CLIP_DIR, "01-guest-mobile-16x9.mp4");
    const signedMp4 = resolve(CLIP_DIR, "02-signedin-mobile-16x9.mp4");
    const desktopMp4 = resolve(CLIP_DIR, "03-homepage-desktop.mp4");
    toMp4(guestWebm, guestMp4, { letterbox: true, viewport: MOBILE });
    toMp4(signedWebm, signedMp4, { letterbox: true, viewport: MOBILE });
    toMp4(desktopWebm, desktopMp4);

    const master = resolve(OUT_DIR, "walkthrough-16x9.mp4");
    concatMp4([desktopMp4, guestMp4, signedMp4], master);

    notes.push(
      `# Capture notes`,
      ``,
      `- Base URL: ${BASE_URL}`,
      `- Demo member: ${DEMO_NAME} <${DEMO_EMAIL}> (role=member, unlinked)`,
      `- Four Friends: ${DEMO_FRIENDS.join(", ")}`,
      `- Guest timer: saved (rounds up to 1 campaign minute)`,
      `- Pledge form shown; not submitted`,
      `- Prayer request titled "Peace for our city"; not submitted`,
      `- Login code not sent; contact field blurred after typing you@example.com`,
      `- Master: \`${master}\``,
      ``
    );
    writeFileSync(resolve(OUT_DIR, "NOTES.md"), notes.join("\n"));
    log("Done.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
