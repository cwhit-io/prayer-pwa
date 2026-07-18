#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEFAULT_BASE_URL = process.env.UX_BASE_URL || "http://localhost:3000";
const OUTPUT_DIR = process.env.UX_REPORT_DIR || "ux-reports";

const journeys = [
  {
    id: "first-time-visitor",
    persona: "A first-time visitor who heard about Fort Wayne Prays and wants to understand the campaign.",
    goal: "Understand the movement, find the primary next step, and know whether the app feels trustworthy.",
    path: ["/", "/log", "/prompts", "/requests"]
  },
  {
    id: "ready-to-pray",
    persona: "A church member who opens the app during a quiet moment and just wants to start praying quickly.",
    goal: "Reach the PRAY timer without feeling forced into a guided devotional.",
    path: ["/log"]
  },
  {
    id: "returning-member",
    persona: "A returning participant checking personal progress and household prayer lists.",
    goal: "Find profile, pledge, recent prayer, and family/friends prayer context.",
    path: ["/auth"]
  },
  {
    id: "community-prayer",
    persona: "A member who wants to pray for community requests and maybe submit their own.",
    goal: "Understand where public requests live and how personal requests are managed.",
    path: ["/requests", "/requests/mine"]
  }
];

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function absoluteUrl(baseUrl, path) {
  return new URL(path, baseUrl).toString();
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMatches(html, pattern, mapper) {
  return [...html.matchAll(pattern)]
    .map(mapper)
    .map((value) => value.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

function analyzeHtml(path, html, status) {
  const text = stripHtml(html);
  const links = unique(
    extractMatches(html, /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (match) =>
      `${stripHtml(match[2]) || match[1]} -> ${match[1]}`
    )
  );
  const buttons = unique(
    extractMatches(html, /<button\b[^>]*>([\s\S]*?)<\/button>/gi, (match) => stripHtml(match[1]))
  );
  const inputs = unique(
    extractMatches(html, /<(input|textarea|select)\b[^>]*(?:name=["']([^"']+)["'])?[^>]*>/gi, (match) =>
      match[2] || match[1]
    )
  );
  const headings = unique(
    extractMatches(html, /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi, (match) => stripHtml(match[1]))
  );

  const observations = [];
  const lower = text.toLowerCase();

  if (status >= 400) {
    observations.push(`Page returned HTTP ${status}; this would feel broken to a user.`);
  }

  if (path === "/log") {
    if (/start prayer/i.test(text)) {
      observations.push("The primary Start Prayer action is visible in page copy.");
    } else {
      observations.push("The PRAY page may not clearly expose a Start Prayer action.");
    }

    if (/optional guide/i.test(text) || /guided prayer is optional/i.test(text)) {
      observations.push("Guided prayer is framed as optional, which reduces pressure.");
    } else {
      observations.push("Guided prayer may still feel required; consider stronger optional language.");
    }
  }

  if (path === "/") {
    if (lower.includes("fort wayne") && lower.includes("kingdom")) {
      observations.push("The homepage connects the campaign to Fort Wayne and Kingdom language.");
    }
    if (!/start prayer|begin praying|pray/i.test(text)) {
      observations.push("The homepage may need a clearer immediate prayer CTA.");
    }
  }

  if (buttons.length === 0 && links.length === 0) {
    observations.push("No obvious actions were detected in server-rendered HTML.");
  }

  if (text.length > 2500) {
    observations.push("The page has a lot of visible copy; a hurried mobile user may scan rather than read.");
  }

  return {
    path,
    status,
    title: headings[0] || "(no heading detected)",
    headings: headings.slice(0, 8),
    primaryActions: buttons.concat(links).slice(0, 12),
    formFields: inputs.slice(0, 12),
    observations,
    textSample: text.slice(0, 650)
  };
}

function scoreJourney(pageReports) {
  let score = 5;

  for (const page of pageReports) {
    if (page.status >= 400) score -= 2;
    if (page.observations.some((item) => item.includes("broken"))) score -= 2;
    if (page.observations.some((item) => item.includes("not clearly"))) score -= 1;
    if (page.observations.some((item) => item.includes("optional"))) score += 0.5;
    if (page.primaryActions.length > 8) score -= 0.25;
  }

  return Math.max(1, Math.min(5, score));
}

function recommend(journey, pageReports) {
  const recommendations = [];

  if (journey.id === "ready-to-pray") {
    const log = pageReports.find((page) => page.path === "/log");
    if (log?.observations.some((item) => item.includes("Start Prayer action is visible"))) {
      recommendations.push("Keep the timer CTA visually dominant; avoid moving guided content above it.");
    } else {
      recommendations.push("Make Start Prayer the largest action and repeat it near the top of the viewport.");
    }
  }

  if (journey.id === "first-time-visitor") {
    recommendations.push("Watch for jargon: a visitor should understand the campaign before learning app mechanics.");
  }

  if (journey.id === "returning-member") {
    recommendations.push("Make sure signed-out profile states explain why email/phone login may show household names.");
  }

  if (journey.id === "community-prayer") {
    recommendations.push("Clarify the distinction between public board requests and private personal requests.");
  }

  return recommendations;
}

async function fetchPage(baseUrl, path) {
  const url = absoluteUrl(baseUrl, path);
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "FortWaynePrays-UX-Agent/1.0"
    }
  });

  const html = await response.text();
  return analyzeHtml(path, html, response.status);
}

function renderReport({ baseUrl, reports }) {
  const lines = [
    "# UX Agent Report",
    "",
    `Base URL: ${baseUrl}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    ""
  ];

  for (const report of reports) {
    lines.push(`- ${report.journey.persona}`);
    lines.push(`  Goal: ${report.journey.goal}`);
    lines.push(`  UX confidence: ${report.score.toFixed(1)} / 5`);
  }

  for (const report of reports) {
    lines.push("", `## ${report.journey.id}`, "");
    lines.push(`Persona: ${report.journey.persona}`);
    lines.push(`Goal: ${report.journey.goal}`);
    lines.push(`UX confidence: ${report.score.toFixed(1)} / 5`);
    lines.push("", "### Page Walkthrough", "");

    for (const page of report.pages) {
      lines.push(`#### ${page.path}`);
      lines.push(`- Status: ${page.status}`);
      lines.push(`- First heading: ${page.title}`);
      lines.push(`- Headings: ${page.headings.join(" | ") || "None detected"}`);
      lines.push(`- Actions noticed: ${page.primaryActions.join(" | ") || "None detected"}`);
      lines.push(`- Form fields noticed: ${page.formFields.join(" | ") || "None detected"}`);
      for (const observation of page.observations) {
        lines.push(`- Observation: ${observation}`);
      }
      lines.push("");
    }

    lines.push("### Recommendations", "");
    for (const item of report.recommendations) {
      lines.push(`- ${item}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const baseUrl = process.argv[2] || DEFAULT_BASE_URL;
  const reports = [];

  for (const journey of journeys) {
    const pages = [];
    for (const path of journey.path) {
      pages.push(await fetchPage(baseUrl, path));
    }

    reports.push({
      journey,
      pages,
      score: scoreJourney(pages),
      recommendations: recommend(journey, pages)
    });
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const reportPath = resolve(OUTPUT_DIR, `ux-agent-${nowStamp()}.md`);
  const latestPath = resolve(OUTPUT_DIR, "latest.md");
  const markdown = renderReport({ baseUrl, reports });

  await writeFile(reportPath, markdown, "utf8");
  await writeFile(latestPath, markdown, "utf8");

  console.log(`UX report written to ${reportPath}`);
  console.log(`Latest report written to ${latestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
