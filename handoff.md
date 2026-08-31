# Handoff Notes

## Current State

- **Phases 1–4 complete.** **Phase 4.5 Planning Center closed out** for production readiness.
- Members sign in with **email/phone OTP** (Elastic Email / Twilio), choose household person, identity = **Planning Center Person ID**.
- Admins: API credentials, per-user sync, manual ID override, **bulk sync**, custom-field map + writeback queue.
- Family = PCO households. Friends = groups with group type ids **428832 / 428831 / 428830** via `GET /groups/v2/people/{id}/groups`.
- Dashboard/profile (`/auth`): 4 friends, household, church family (scrollable), pledge, recent prayer.
- PRAY (`/log`): timer + ACTS, soft cap, guest minutes allowed.
- **Public site:** [https://fortwayneprays.org](https://fortwayneprays.org) (canonical) and [https://prayfw.org](https://prayfw.org) (alias) · Fort Wayne Prays · © Blackhawk Ministries.
- **Production:** Next.js on port **3000**, not `next dev`. Cloudflare Tunnel ingresses public hostnames → `http://10.10.96.138:3000` (same host).

## Production / domain

| Item | Value |
|------|--------|
| Canonical domain | `fortwayneprays.org` (apex; `www` not configured) |
| Alias domain | `prayfw.org` (allowed in `next.config.mjs` for server actions / CSRF; wire in Cloudflare Tunnel when ready) |
| App URL env | `NEXT_PUBLIC_APP_URL=https://fortwayneprays.org` in `.env.local` (canonical; both hosts serve the same app) |
| Process | `prayer-pwa.service` is the :3000 reverse proxy; app slots are `prayer-pwa-app@3001` / `@3002` |
| Unit files | `deploy/prayer-pwa.service`, `deploy/prayer-pwa-app@.service` (copied to `~/.config/systemd/user/` by release) |
| After code changes | `cd ~/prayer-pwa && npm run release` (build into `.next-build`, migrate, start idle slot, flip proxy, drain old slot) |
| Live files | Never build into `.next` while a slot is serving; each slot runs from `releases/<port>/` |
| Postgres | Docker Compose service `prayer-pwa-postgres-1` |
| Tunnel | system `cloudflared.service` (token-based); do not reinvent tunnel — keep **proxy** listening on **3000** |
| Container image | GitHub Actions workflow `.github/workflows/container.yml` builds on PRs and publishes `ghcr.io/cwhit-io/prayer-pwa` on `main`/tags |

Footer branding: Fort Wayne Prays · fortwayneprays.org · © Blackhawk Ministries · 7400 E State Blvd, Fort Wayne, IN 46815 (`src/app/components/site-footer.tsx`).

## Admin Paths (nav groups by job)

- `/admin` — Overview
- `/admin/campaign` — Campaign
- **Content:** `/admin/content` hub · `/admin/prompts` · `/admin/acts` · `/admin/categories` (CSV import/export on prompts/ACTS)
- **Community:** `/admin/community` hub · `/admin/requests` · `/admin/moderation` (keyword CSV)
- **People:** `/admin/planning-center`
- **Messages:** `/admin/notifications`

## Demo video account

**Disabled.** `DEMO_ACCOUNT_ENABLED = false` in `src/lib/demo-account.ts`. Phone `260-276-7404` is a normal login (Twilio OTP). Re-enable that flag and set `is_demo` on the Alex user if filming needs the `000000` bypass again.

## Member Planning Center login

1. Open `/auth` signed out → email or phone.
2. App rate-limits codes (5/hour per contact; global hourly cap).
3. Looks up PCO by email/phone, **expands household members** for person picker.
4. Sends OTP via configured email/SMS. **Production requires successful delivery** (no debug code).
5. **If not found in Planning Center:** still OTP → enter name → **unlinked** account (`planning_center_sync_status = unlinked`); admin can link later.
6. If PCO match: after verify + person choice → create/reuse user by PCO person id, pull Family + Friends lists.
7. Returning users with a verified contact method auto-sign-in after OTP (no name form).
8. **After any successful sign-in:** if the user has no row in `pledges`, redirect to `/pledge?required=1` (pledge form first). Users who already pledged go to `/auth`. Profile also surfaces the pledge form at the top until one is saved.

## How to sync a user (admin)

1. Sign in as `role = admin`.
2. `/admin/planning-center` → credentials.
3. **Add user from Planning Center** — search name/email/phone/person ID → **Add to campaign**.
4. **Record prayer or pledge** for any member (top forms or per-user quick actions). Admin sessions count toward campaign + PCO totals when linked.
5. **Sync user** (email lookup) or **Sync all users** (bulk) for existing accounts.
6. Manual ID override if needed; **Refresh lists** for already-linked people.

## Custom field writeback

Church Center person tab **263994** (Pray Like Crazy):

| App field key | Label | PCO FieldDefinition ID |
|---|---|---|
| `total_minutes_pledged` | Total Minutes Pledged | `1091023` |
| `total_minutes_prayed` | Total Minutes Prayed | `1091024` |

1. **Pledge save** → write `total_minutes_pledged` to PCO immediately (latest pledge total).
2. **Prayer session save** → write `total_minutes_prayed` immediately (sum of the member’s sessions).
3. Admin **Push campaign totals now** / **Process pending jobs** for backfill/retries.
4. Guests and unlinked accounts are skipped. Only these two field-map rows remain (legacy care fields removed).

## Notifications admin

- `/admin/notifications` — type list, enable/disable, providers, send log
- `/admin/notifications/[key]` — frequency, day/hour, audience, channels, email HTML (paste/upload), SMS, test send
- Tables auto-created on first visit: `notification_definitions`, `notification_settings`, `notification_templates`, `notification_send_log`
- Login codes use managed `login_code` template via `dispatchManagedNotification`
- **Event hooks** (`src/lib/notification-events.ts`):
  - `onRequestPrayed` → `request_prayed_for` (only if member opted in on `/auth`)
  - `onBoardRequestPublished` / create → `new_board_request` to admin + prayer_team emails
- **Member opt-in:** `/auth` → “Email me when someone prays for my requests” (`user_notification_preferences`)
- **Not yet:** cron/scheduler for daily/weekly sends

## Next recommended work

1. Wire scheduled dispatch (cron) for weekly/daily notification types.
2. Series content prompts for campaign weeks.
3. Phase 5 light: “I prayed for [name]” from profile lists.
4. Phase 8 light: CSV export for staff.

## Risks

- PCO credentials in `app_settings`; protect DB access.
- Groups permissions may block some membership pulls.
- Writeback only works after church provides real field definition IDs.
- No migration runner; apply `db/schema.sql` for new tables when needed.
