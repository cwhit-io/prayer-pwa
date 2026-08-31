# Pray Like Crazy campaign emails (Elastic Email)

Three HTML templates for a launch series. Dark Pray Like Crazy styling, table-based for inbox clients.

| File | Use | Suggested subject |
|---|---|---|
| [01-introduction.html](./01-introduction.html) | Email 1 — what it is, why join, get set up | One million minutes of prayer for Fort Wayne |
| [02-inspiration.html](./02-inspiration.html) | Email 2 — reminder + Dave (or similar) video | Why Pray Like Crazy matters |
| [03-reminder.html](./03-reminder.html) | Email 3 — reminder + call to action | Fort Wayne is praying. Start today. |

## In Elastic Email

1. Campaigns → create email → paste the HTML (source / HTML view).
2. Video links:

| URL in the HTML | Video |
|---|---|
| `https://vimeo.com/1221846318` | Sunday setup — *Prayer App Explainer* (all three emails) |
| `https://fortwayneprays.org/watch/why-pray-like-crazy` | Dave (or other) encouragement — **email 2 only**; replace when that clip is live |

3. App button already goes to **https://fortwayneprays.org**.
4. Footer uses Elastic merge tags `{unsubscribe}` and `{accountaddress}`.

Videos in email work best as a **thumbnail that links out** (Gmail and Outlook often block autoplay). After you have a YouTube/Vimeo link, you can also swap the poster image `src` if you upload a still.

## Merge tags

| Tag | Source |
|---|---|
| `{firstname}` | Elastic contact |
| `{unsubscribe}` | Elastic unsubscribe |
| `{accountaddress}` | Elastic physical address (CAN-SPAM) |
