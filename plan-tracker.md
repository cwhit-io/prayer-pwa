# Prayer Campaign PWA Plan Tracker

## Goal

Build a Progressive Web App for a church prayer campaign where people can pledge prayer minutes, receive prompts, track prayer time, submit prayer requests, and help the church reach **1,000,000 minutes of prayer** in one year.

## Recommended MVP

Build this first before adding extra features.

### 1. Public Landing Page

Purpose: Explain the campaign and invite people to join.

Needs:

- Campaign title
- Kingdom-centered local vision statement
- Current total prayer minutes offered to the King
- Church goal progress ring
- Personal goal progress ring when signed in
- `Make a Prayer Pledge` button
- `Log Prayer Minutes` button
- Prayer prompts button
- Dynamic recent activity
- Dynamic featured prayer from prompts or community prayers
- Install app instructions in a later PWA polish pass

Status: complete for the current campaign pass. The landing page now centers `Your Kingdom come. Fort Wayne as it is in heaven.`, shows live church progress, supports personal pledge progress when signed in, and pulls recent activity plus featured prayer content from Postgres-backed data.

### 2. User Accounts

Simple login options:

- Email magic link
- Google login
- Optional guest mode for quick logging

User profile fields:

- Name
- Email
- Household optional
- Ministry/group optional
- Weekly prayer pledge
- Notification preference

### 3. Prayer Pledge Flow

Users choose:

- Minutes per day or week
- Start date
- Optional prayer focus
- Whether their pledge is private or counted publicly

Example pledge options:

- 5 min/day = 1,825 min/year
- 10 min/day = 3,650 min/year
- 15 min/day = 5,475 min/year
- Custom amount

### 4. Prayer Timer

Core feature:

- `Start Prayer`
- Choose prayer prompt or custom prayer
- Timer counts up or down
- User taps `Finish`
- Minutes are saved automatically

Also allow:

- Manual entry
- Edit/delete entry
- Notes optional

### 5. Prayer Prompts

Admin-managed prompts.

Prompt fields:

- Title
- Scripture
- Prayer focus
- Suggested duration
- Category
- Publish date

Categories:

- Future
- Personal renewal
- Family
- Friends
- Church
- Finances
- Fort Wayne
- Schools
- Missions
- Leaders
- Lost people
- Healing

ACTS guide prompts (admin `/admin/acts`, random on PRAY):

- Adoration (A)
- Confession (C)
- Thanksgiving (T)
- Supplication (S) uses campaign prompts above

### 6. Dashboard

User dashboard:

- Total minutes prayed
- Pledged minutes
- Progress toward pledge
- Recent prayer history
- Current streak, but no guilt-based messaging
- Suggested next prayer prompt

Church dashboard:

- Total minutes logged
- Total pledged minutes
- Percent toward 1,000,000
- Active participants
- Minutes this week
- Top categories
- Milestone progress

### 7. Prayer Requests

Users can submit prayer requests.

Privacy options:

- Private to prayer team
- Share with small group
- Share anonymously with church
- Public testimony only after approval

Fields:

- Request title
- Details
- Category
- Visibility
- Mark as answered
- Optional testimony

### 8. Admin Panel

Admins need to manage:

- Prayer prompts
- Prayer requests
- Public stories/testimonies
- Campaign settings
- Milestones
- Users
- Manual minute adjustments
- Featured updates

## Suggested Tech Stack

Best practical stack:

- **Next.js** for app and website
- **Postgres** database in a local Docker container for development
- **Tailwind CSS** for styling
- **Vercel** for hosting
- **Resend** for email notifications
- **OneSignal** or native Web Push for push notifications
- **PWA manifest + service worker** for installable app behavior

## Database Tables

### users

- id
- name
- email
- role
- group_id
- created_at

### pledges

- id
- user_id
- minutes_per_week
- total_pledged_minutes
- start_date
- end_date
- is_public
- created_at

### prayer_sessions

- id
- user_id
- prompt_id
- minutes
- started_at
- ended_at
- entry_type
- notes
- created_at

### prayer_prompts

- id
- title
- scripture_reference
- scripture_text
- body
- category
- suggested_minutes
- publish_date
- is_active
- created_by

### prayer_requests

- id
- user_id
- title
- body
- category
- visibility
- status
- is_anonymous
- created_at
- answered_at

### testimonies

- id
- user_id
- prayer_request_id
- title
- story
- approved
- featured
- created_at

### groups

- id
- name
- type
- leader_user_id

### milestones

- id
- minutes_goal
- title
- message
- reached_at

## Build Phases for the AI Developer

### Phase 1: Foundation

Have the AI build:

- Next.js project
- Tailwind setup
- Postgres container connection
- Auth system
- Basic database schema
- PWA manifest
- Mobile-first layout

Deliverable:

- Users can sign up, log in, and see a basic dashboard.

### Phase 2: Campaign Core

Build:

- Public campaign page
- Prayer pledge form
- Prayer session timer
- Manual minute logging
- Total minutes calculation
- Church-wide progress ring
- Personal pledge progress

Deliverable:

- The church can begin collecting pledges and logged minutes.

Status: complete. Pledges and prayer sessions persist to Postgres, the public campaign page reads live totals, the homepage highlights church and personal goals, and the dashboard reflects logged activity.

### Phase 3: Prayer Content

Build:

- Admin prompt manager
- Daily prayer prompt display
- Categories
- Prompt archive
- Suggested prayer flow

Deliverable:

- Users can open the app and immediately know what to pray for.

Status: complete. Prompt archive, admin create/edit/publish, suggested + selectable prompts on the logging page, prompt-linked dashboard history, starter library seed, and homepage featured-prompt fallback are implemented.

### Phase 4: Prayer Requests

Build:

- Submit request form
- Privacy controls
- Admin moderation
- Prayer team view
- Mark as answered
- Testimony submission

Deliverable:

- The app supports real ministry, not just tracking.

Status: complete. Users can submit prayer requests with privacy controls, prayer team/admin users can review and update request status, answered requests can receive testimonies, and admins can approve testimonies.

### Phase 4.25: Campaign Narrative and Visual System

Build:

- Dark/yellow `Pray Like Crazy` visual direction across app surfaces
- Campaign language around `Your Kingdom come` and Fort Wayne
- Four prayer circles: Me, My Family, My Friends, My City
- Reusable SVG icon system instead of small placeholder glyphs
- Dynamic homepage recent activity
- Dynamic featured prayer from community prayers or prayer prompts
- Navigation language that uses `Prompts`, not `Ideas`

Deliverable:

- The app feels like a citywide Kingdom movement rather than a generic prayer tracker.

Status: complete. The public shell, homepage, user pages, prayer-team pages, and admin pages now use the dark/yellow campaign style. The homepage removes weekly schedule/date framing, keeps the four prayer-circle cards for the year-long campaign, and uses live content for activity and featured prayer.

### Phase 4.5: Planning Center Integration

Build:

- Link app users to Planning Center Person IDs
- Authorize by shared email/phone OTP without using those contact methods as identity keys
- Present household/person candidates after code verification so users can choose which person they are
- Store Planning Center household, small group, campus, and ministry team references locally
- Show Planning Center name/profile information on first login after linking
- Auto-create household prayer lists when household data is available
- Route prayer requests to a user's small group, household, pastor, ministry team, or prayer team
- Support verified anonymous requests where leaders can follow up privately
- Prepare sync jobs for Planning Center custom fields such as prayer progress, last prayed for, follow-up needed, care visit scheduled, and pastoral care notes

Deliverable:

- The app understands the church's real people, households, and groups instead of treating every user as an isolated account.

Status: **complete for Phase 4.5 closeout.** Admin person linking, member OTP (Elastic Email/Twilio with rate limits; production requires delivery), household-expanded person selection, Planning Center person-ID identity, contact-method verification, Family/Friends lists (group types 428832/428831/428830), bulk sync, field map admin, and writeback queue (jobs enqueue on prayer sessions; process when field definition IDs are enabled) are live. Actual custom-field writes stay off until the church supplies PCO field definition IDs — infrastructure is ready, not church-data-dependent.

Recommended safeguards:

- Do not require Planning Center linking for all users immediately.
- Keep app login usable without Planning Center.
- Add admin/user linking and re-linking flows.
- Keep email and phone as authorization channels only; use Planning Center Person ID as the durable app identity.
- Store external IDs and sync status locally so Planning Center outages do not block prayer logging.
- Define exactly which custom fields the church wants to write before enabling writeback.

### Phase 5: Household and Group Prayer Care

Build:

- Household prayer lists
- Small group prayer request feeds
- Group leader view with requests, urgent needs, answered prayers, and follow-up flags
- "I prayed for you" actions
- Prayer timelines showing request, updates, prayer interactions, answered status, and follow-up
- Request updates such as surgery scheduled, test results, or follow-up completed

Deliverable:

- Small group leaders and families can pray for the right people without manual setup.

### Phase 6: Pastoral Care and Leader Tools

Build:

- Pastoral care dashboard
- Filters by small group, campus, ministry team, household, age/stage, and request status
- Care flags such as urgent, follow-up needed, hospital visit, counseling referral, and care visit scheduled
- Leader notes and follow-up reminders
- Export or sync selected care information to Planning Center notes/custom fields
- Prayer heatmaps for leaders showing categories, urgent needs, engagement, and follow-up load

Deliverable:

- Pastors and ministry leaders can see where care is needed and coordinate follow-up.

### Phase 7: Notifications

Build:

- Email reminders
- Optional push notifications
- Daily/weekly prayer nudges
- Admin announcement tool
- New request notifications for small groups, households, pastors, and prayer teams
- "I prayed for you" notifications
- Follow-up reminders for leaders
- Urgent prayer request alerts

Deliverable:

- Users are gently reminded to pray and leaders are alerted when care needs attention.

Status: **admin foundation complete.** Provider credentials, managed notification types (enable, frequency, audience, channels), email HTML templates (paste or file upload), SMS copy, test send, and send log live at `/admin/notifications`. Login codes use managed templates. Remaining: cron/scheduler for frequency-based sends, event hooks (prayed-for / new request), push notifications.

### Phase 8: Reporting

Build:

- Admin dashboard
- Export CSV
- Group totals
- Weekly activity
- Milestone tracking
- Public stats widget
- Planning Center sync reports
- Prayer/care activity by group, campus, household, and ministry team
- Answered prayer and testimony reports
- Pastoral care follow-up reports

Deliverable:

- Staff can report progress during services and emails.

### Phase 9: Future Ministry Enhancements

Build:

- Prayer challenges such as 7-day prayer, pray for your neighbors, pray for your campus, or pray for your small group
- Prayer circles for lightweight friend/family/ministry prayer groups outside formal Planning Center groups
- Event-linked prayer prompts for camps, mission trips, retreats, classes, and ministry events
- Scripture pairing by request category
- Gratitude journal and answered prayer history
- Prayer + service integration for requests that require practical help
- Prayer map or location-aware reporting if leadership wants that visibility

Deliverable:

- The app grows from a campaign tracker into a broader church care and spiritual formation system.

## Prompt to Give the AI Builder

```text
Build a mobile-first Progressive Web App for a church campaign called “Pray Like Crazy: One Million Minutes of Prayer.”

Use Next.js, Tailwind CSS, lightweight app auth, and a standard Postgres database running in a Docker container for local development.

The app should allow users to:
1. Create an account.
2. Make a prayer-minutes pledge.
3. Log prayer minutes using a timer or manual entry.
4. View their personal progress.
5. Receive prayer prompts.
6. Submit prayer requests with privacy options.
7. Mark prayers as answered.
8. See the church-wide progress toward 1,000,000 minutes.

Admins should be able to:
1. Manage prayer prompts.
2. Moderate prayer requests.
3. View total campaign stats.
4. Manage milestones.
5. Feature testimonies.
6. Export reports.

Design should follow the Blackhawk `Pray Like Crazy` dark/yellow campaign direction: bold, gritty, local, and Kingdom-centered. Avoid guilt-based streaks. Encourage prayer with grace, celebration, and the language `Your Kingdom come. Fort Wayne as it is in heaven.`

Start by creating the database schema, authentication, app layout, dashboard, pledge form, prayer timer, and public campaign progress page.
```

## Important Design Principle

The app should not feel like a productivity tracker.

It should feel like:

> "Here is a simple place to pray, be guided, and join our church family in seeking God together."

Track the minutes, but keep the focus on prayer.
