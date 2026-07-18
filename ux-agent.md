# UX Agent

The UX agent is a lightweight scripted reviewer that walks the site like several human personas and writes a Markdown report.

It does not replace a real human review, but it is useful for catching obvious friction after product changes.

## Run

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

Generated reports are intentionally ignored by Git so agents can run audits freely.

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

## Future Upgrade

If we want screenshot-level feedback, add Playwright as a second layer. That would allow visual assertions, real clicks, viewport testing, and screenshots for before/after review.
