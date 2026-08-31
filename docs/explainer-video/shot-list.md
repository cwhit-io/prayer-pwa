# Shot list

Picture is **16:9**. How-to beats: **phone-width capture** of the live app, letterboxed or placed on a dark night background. Campaign beats: existing art, slow 6-second motion. Do not generate UI.

Record **2 extra seconds** of heads and tails on every live take.

**Capture host:** `https://fortwayneprays.org` (or a local build that matches it). Demo account only.

## Supers (only these words on screen)

Keep type in the existing campaign look: black / paper / yellow. Build titles in code or the editor — do not generate type-heavy frames.

| When | Super |
|---|---|
| Open | Pray Like Crazy |
| After logo | 1 million minutes of prayer |
| Guest beat | No account needed |
| Timer | Screen-off time counts |
| Guided | Adoration · Confession · Thanksgiving · Supplication |
| Pledge | Weekly pace → campaign commitment |
| Pulse | Church totals only |
| People | Four Friends are private |
| Close | fortwayneprays.org |

## Shots

### A — Campaign invite (~0:00–0:25)

| # | Dur | Source | Action | VO |
|---|---|---|---|---|
| A1 | 6s | `public/hero-pray-like-crazy-4k.jpg` | Slow push-in over Fort Wayne sunrise | “Fort Wayne Prays is a church-wide campaign…” |
| A2 | 5s | `public/header-logo@web.png` on night | Logo holds, slight scale | “…one million minutes of prayer.” |
| A3 | 4s | Same hero, tighter | Hold skyline | “Your Kingdom come in Fort Wayne…” |
| A4 | 2.5s each | `homepage-prayer-cards/01-future` … `04-friends` | Four cards, match VO: future, family, finances, friends | Four focuses |
| A5 | 4s | Live homepage Prayer Pulse **or** freeze if the live meter is messy | Gentle hold | Bridges into “start today” |

### B — Anyone can start (~0:25–0:40)

| # | Dur | Source | Action | Notes |
|---|---|---|---|---|
| B1 | 8s | `/` mobile | Scroll hero, tap **Start praying** | Guest session. No login. |
| B2 | 7s | `/log` | Land on **Start praying.** / **Start Timer** | Super: No account needed |

### C — Timer (~0:40–1:15)

| # | Dur | Source | Action | Notes |
|---|---|---|---|---|
| C1 | 6s | `/log` | Tap **Start Timer**; clock runs | |
| C2 | 8s | Same session | Optional: lock screen / dim, then return with time still elapsed | Super: Screen-off time counts |
| C3 | 8s | Same | Pause → **Save prayer time** / **Record prayer time** (guest) | Whole minutes; do not wait for a long pray |
| C4 | 6s | `/add-time` | Date + minutes fields, do not submit real history if it would pollute totals — cancel or use a throwaway guest | Matches “already prayed” line |

### D — Guided prayer (~1:15–1:40)

| # | Dur | Source | Action | Notes |
|---|---|---|---|---|
| D1 | 5s | `/log` | Tap **Start guided prayer** | |
| D2 | 15s | `/guided-prayer` | ACTS steps; timer already running | Super with four words. Do not linger on a live scripture if it is long — crop to the step labels. |

### E — Sign in, pledge, pulse (~1:40–2:10)

| # | Dur | Source | Action | Notes |
|---|---|---|---|---|
| E1 | 8s | `/auth` | Email or phone field, tap send | **Blur the contact and the code.** Cut before digits are readable. |
| E2 | 10s | `/pledge` or Me pledge card | Weekly pace presets, save **or** hold on the card without submitting if the demo already pledged | Super: Weekly pace → campaign commitment |
| E3 | 8s | `/` or Me campaign numbers | Prayer Pulse / committed vs credited | Super: Church totals only. No personal amounts large on screen. |

### F — People (~2:10–2:32)

| # | Dur | Source | Action | Notes |
|---|---|---|---|---|
| F1 | 10s | `/auth` Four Friends **or** `/people` | Four invented first names only | Super: Four Friends are private |
| F2 | 8s | `/people` | Tap a friend; land in timer with that name as focus | Household names: skip or use the demo household |

### G — Requests (~2:32–2:48) — cut first if long

| # | Dur | Source | Action | Notes |
|---|---|---|---|---|
| G1 | 12s | `/requests/mine` | Toggle **Signed-in community** vs **Private request**. Do not submit. Never open the live community board. | Demo copy only if a title is typed: “Peace for our city” |

### H — Close (~2:48–3:05)

| # | Dur | Source | Action | Notes |
|---|---|---|---|---|
| H1 | 6s | `/` | **Start praying** button | |
| H2 | 8s | End card | Logo + **fortwayneprays.org** + Start praying | Hold for class pause |

## Capture checklist

- [ ] Phone-width (390×844 or similar) and a 16:9 desktop safety pass of homepage + timer
- [ ] Guest path first (B, C, D), then demo sign-in (E, F, G)
- [ ] Four Friends: four invented first names
- [ ] OTP, email, phone, and codes unreadable
- [ ] No admin, no Planning Center, no real prayer-request bodies
- [ ] If Pulse looks noisy, freeze A5/E3 from a clean homepage still

## B-roll generation (after script lock)

Animate stills as **6s shots**, one motion each (slow push-in or parallax). Source:

- `public/hero-pray-like-crazy-4k.jpg`
- `public/header-logo@web.png`
- `public/pray-crown-transparent@web.png`
- `public/homepage-prayer-cards/01-future.webp` … `04-friends.webp`

Do not animate a busy full-page screenshot. UI stays live capture.
