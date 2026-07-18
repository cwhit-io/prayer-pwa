# Agent Guide

This repository uses a simple documentation-first workflow so future agents can pick up work without losing context.

## Required Behavior

- Read `plan-tracker.md` before making product or implementation changes.
- Update `tracker.md` when work starts, finishes, or changes direction.
- Append meaningful progress notes to `changelog.md` for any completed or user-visible change.
- Keep entries short, specific, and dated when possible.
- Do not leave implementation work without a tracker update.
- If the stack changes, update both `plan-tracker.md` and `README.md` so the repo stays honest.
- Run `npm run ux:audit` after meaningful user-flow changes when practical, then scan `ux-reports/latest.md` for obvious friction.
- **Always rebuild and deploy after user-visible changes** so they can be seen on fortwayneprays.org without asking: `npm run build` then `systemctl --user restart prayer-pwa`. Smoke-check local `:3000` and the public domain when practical.

## Suggested Update Pattern

When you make a meaningful change:

1. Add a line to `changelog.md` describing what changed.
2. Mark the corresponding item in `tracker.md`.
3. If the scope changed, update `plan-tracker.md` to reflect the new direction.

## Documentation Style

- Prefer concise bullets over long prose.
- Use clear language that another agent can scan quickly.
- Keep the tracker honest. If work is incomplete, say so.

## Current Expectation

This repo has completed Phases 1–4 and **Phase 4.5 Planning Center** (OTP login, unlinked fallback registration, Family/Friends lists, bulk sync, writeback queue). Notifications admin + event hooks are in place; weekly cron dispatch still open.

**Production domain:** [https://fortwayneprays.org](https://fortwayneprays.org)  
Cloudflare Tunnel → host **port 3000**. Run with `systemctl --user restart prayer-pwa` after `npm run build`. Details in `handoff.md` § Production / domain.

Read `handoff.md`, `plan-tracker.md`, `tracker.md`, and `changelog.md` before continuing.
