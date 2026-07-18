# Handoff Notes

## Current State

- **Phases 1–4 complete.** **Phase 4.5 Planning Center closed out** for production readiness.
- Members sign in with **email/phone OTP** (Elastic Email / Twilio), choose household person, identity = **Planning Center Person ID**.
- Admins: API credentials, per-user sync, manual ID override, **bulk sync**, custom-field map + writeback queue.
- Family = PCO households. Friends = groups with group type ids **428832 / 428831 / 428830** via `GET /groups/v2/people/{id}/groups`.
- Dashboard/profile (`/auth`): 4 friends, household, church family (scrollable), pledge, recent prayer.
- PRAY (`/log`): timer + ACTS, soft cap, guest minutes allowed.
- **Public site:** [https://fortwayneprays.org](https://fortwayneprays.org) (Fort Wayne Prays · © Blackhawk Ministries).
- **Production:** Next.js on port **3000**, not `next dev`. Cloudflare Tunnel already ingresses `fortwayneprays.org` → `http://10.10.96.138:3000` (same host).

## Production / domain

| Item | Value |
|------|--------|
| Domain | `fortwayneprays.org` (apex; `www` not configured) |
| App URL env | `NEXT_PUBLIC_APP_URL=https://fortwayneprays.org` in `.env.local` |
| Process | `systemctl --user status/start/restart prayer-pwa` |
| Unit file | `deploy/prayer-pwa.service` (user unit under `~/.config/systemd/user/`) |
| After code changes | `cd ~/prayer-pwa && npm run build && systemctl --user restart prayer-pwa` |
| Postgres | Docker Compose service `prayer-pwa-postgres-1` |
| Tunnel | system `cloudflared.service` (token-based); do not reinvent tunnel — only keep app listening on **3000** |

Footer branding: Fort Wayne Prays · fortwayneprays.org · © Blackhawk Ministries · 7400 E State Blvd, Fort Wayne, IN 46815 (`src/app/components/site-footer.tsx`).

## Admin Paths (nav groups by job)

- `/admin` — Overview
- `/admin/campaign` — Campaign
- **Content:** `/admin/content` hub · `/admin/prompts` · `/admin/acts` · `/admin/categories` (CSV import/export on prompts/ACTS)
- **Community:** `/admin/community` hub · `/admin/requests` · `/admin/moderation` (keyword CSV)
- **People:** `/admin/planning-center`
- **Messages:** `/admin/notifications`

## Member Planning Center login

1. Open `/auth` signed out → email or phone.
2. App rate-limits codes (5/hour per contact; global hourly cap).
3. Looks up PCO by email/phone, **expands household members** for person picker.
4. Sends OTP via configured email/SMS. **Production requires successful delivery** (no debug code).
5. **If not found in Planning Center:** still OTP → enter name → **unlinked** account (`planning_center_sync_status = unlinked`); admin can link later.
6. If PCO match: after verify + person choice → create/reuse user by PCO person id, pull Family + Friends lists.
7. Returning users with a verified contact method auto-sign-in after OTP (no name form).

## How to sync a user (admin)

1. Sign in as `role = admin`.
2. `/admin/planning-center` → credentials.
3. **Sync user** (email lookup) or **Sync all users** (bulk).
4. Manual ID override if needed; **Refresh lists** for already-linked people.

## Custom field writeback

1. Prayer sessions enqueue `last_prayed_for` + `prayer_progress` jobs.
2. Jobs stay pending/skipped until field map has a **PCO field definition ID** and **Enabled**.
3. **Process pending jobs** on the Planning Center admin page to attempt writes.

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
