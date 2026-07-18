# UX Agent

The UX agent has two layers:

- A lightweight text/HTML reviewer for quick checks.
- A Playwright browser reviewer for real clicks, screenshots, and viewport-level feedback.

Neither replaces a real human review, but together they are useful for catching obvious friction after product changes.

## Quick Text Audit

```bash
npm run ux:audit
```

Default target:

```text
http://localhost:3000
```

Run against production:

```bash
npm run ux:audit -- https://fortwayneprays.org
```

Reports are written to:

```text
ux-reports/latest.md
ux-reports/ux-agent-<timestamp>.md
```

## Browser Screenshot Audit

Install Chromium once per machine:

```bash
npm run playwright:install
```

Run the browser agent:

```bash
npm run ux:browser
```

Run against production:

```bash
npm run ux:browser -- https://fortwayneprays.org
```

Browser reports are written to:

```text
ux-reports/browser-latest.md
ux-reports/browser-ux-agent-<timestamp>.md
ux-reports/screenshots/<timestamp>/
```

Generated reports and screenshots are intentionally ignored by Git so agents can run audits freely.

## Current Personas

- First-time visitor
- Ready-to-pray member
- Returning member
- Community-prayer participant

## What It Checks

- HTTP status for key pages
- First headings and page language
- Visible links/buttons/forms
- Whether the PRAY page makes Start Prayer obvious
- Whether guided prayer feels optional
- Basic recommendations per journey
- Mobile and desktop screenshots
- Real clicks on important actions
- Console errors and failed browser requests

## Review Rhythm

- Run `npm run ux:audit` after most user-flow edits.
- Run `npm run ux:browser` after visual, routing, navigation, or CTA changes.
- Open `ux-reports/browser-latest.md`, then inspect the linked screenshots.
- Treat the score as a conversation starter, not a substitute for judgment.
