# Prayer PWA

Progressive Web App for **Fort Wayne Prays** (FortWaynePrays.org) — Blackhawk Ministries prayer campaign. Pledge prayer minutes, log prayer time, receive prompts, and track progress toward one million minutes of prayer.

## Project Docs

- [Plan Tracker](./plan-tracker.md)
- [Tracker](./tracker.md)
- [Changelog](./changelog.md)
- [Agent Guide](./agent.md)

## Current Status

Phases 1–4 and **Phase 4.5 (Planning Center)** are complete: OTP household login, Family/Friends lists, bulk sync, and optional custom-field writeback queue. Members never see PCO IDs. Campaign focuses are Future, Family, Finances, and Friends.

**Public site:** [https://fortwayneprays.org](https://fortwayneprays.org) via Cloudflare Tunnel → this host port **3000**. App runs with `systemctl --user start prayer-pwa` (see `deploy/prayer-pwa.service`). Local Postgres via Docker.

## Handoff

- [Handoff Notes](./handoff.md)
