# Project Tracker

## Status

- [x] Capture the build plan from the source attachment
- [x] Create a Markdown plan tracker
- [x] Add repo operating notes for agents
- [x] Add a changelog file for future progress entries
- [x] Add a top-level README for GitHub readiness
- [x] Add the initial Next.js scaffold
- [x] Add the GitHub scaffold
- [x] Switch the development plan to a standard Postgres container
- [x] Create the app implementation
- [x] Add the campaign landing page
- [x] Add pledge, log, and dashboard routes
- [x] Add the initial Postgres schema and connection layer
- [x] Confirm the production build
- [x] Connect authentication and database layers
- [x] Prepare handoff notes for the next agent
- [x] Complete Phase 2 campaign core
- [x] Add pledge persistence
- [x] Add prayer timer and manual minute logging
- [x] Add live public campaign progress
- [x] Start Phase 3 prayer content
- [x] Add prompt archive
- [x] Add admin prompt manager
- [x] Connect suggested prompt to prayer logging
- [x] Build the prayer request flow
- [x] Add prayer team request view
- [x] Add admin request moderation
- [x] Add testimony submission and approval
- [x] Define Phase 4.5 Planning Center integration
- [x] Develop future ministry-care phases
- [x] Apply the `Pray Like Crazy` dark/yellow visual direction to the public app shell and homepage
- [x] Extend the `Pray Like Crazy` visual system across user, prayer-team, and admin pages
- [x] Phase 4.5 schema: PC person IDs, groups, memberships, routing, field map, sync queue
- [x] Admin Planning Center API credentials + email sync + manual ID override
- [x] Member Planning Center login: email/phone OTP authorization
- [x] Member Planning Center login: household/person candidate selection
- [x] Store verified contact methods separately from Planning Center person identity
- [x] Store household (Family) and small-group (Friends) people lists for members
- [x] Dashboard Family/Friends prayer lists (names only)
- [x] Admin hub navigation
- [x] Four focuses: Future, Family, Finances, Friends
- [x] Log page manual-entry toggle
- [x] Hide unfinished Groups / Prayer Team member UI
- [x] Phase 3 polish: prompt edit, selection, history, seed library
- [x] Phase 4.5 closeout: PCO group-type filter (428832/428831/428830)
- [x] Phase 4.5 closeout: household-expanded login candidates + no prod synthetic fallback
- [x] Phase 4.5 closeout: OTP via Elastic Email/Twilio + rate limits (prod requires delivery)
- [x] Phase 4.5 closeout: full Family/Friends pull on login; bulk sync all users
- [x] Phase 4.5 closeout: custom-field map admin + writeback queue (enable when church IDs ready)
- [x] Phase 7 foundation: admin notification manager (types, frequency, HTML templates, upload, log)
- [x] Phase 7 event hooks + member email opt-in for prayer request updates
- [x] GitHub container workflow: build/test on PRs and publish GHCR image on main/tags
- [x] PRAY page: primary Start Prayer timer CTA with optional guided ACTS section
- [x] UX agent: scripted persona walkthrough reports via `npm run ux:audit`
- [x] Browser UX agent: Playwright mobile/desktop screenshots and click walkthroughs via `npm run ux:browser`
- [x] Auth sessions now roll forward for 30 days from recent signed-in app use
- [x] Homepage focus cards now have image panels for Future, Family, Finances, and Friends
- [x] Fort Wayne skyline incorporated into homepage hero and goal ring
- [ ] Phase 7 scheduled/cron dispatch for daily/weekly types
- [ ] Series content / campaign-week prompts
- [ ] Light reporting (CSV export)


## Notes

- Keep this file short and current.
- Update it when milestones change or implementation starts moving.
- **Live:** fortwayneprays.org via Cloudflare Tunnel → :3000 (`systemctl --user` unit `prayer-pwa`). See `handoff.md`.
