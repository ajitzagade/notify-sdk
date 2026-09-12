# Infrastructure cost scenarios: best case vs. worst case

**Status: planning reference.** Companion to [`production-db-analysis.md`](./production-db-analysis.md)
(database-specific research this doc's database row is built on).

## Why this exists

Deploying AZentis Notify raises an obvious question — what does running it actually cost, and
where does that cost grow as the platform scales? This doc answers both **without compromising
on performance**: every "best case" figure below still assumes production-grade infrastructure
(no free tiers that throttle, sleep, or breach commercial terms), just at low traffic volume.
Cutting a corner to save money on any of the rows flagged below has a direct, user-visible cost —
usually a dropped webhook, a slow page under load, or a Meta compliance problem — so this is
written to make those tradeoffs explicit rather than discovered later.

## Stage 0 — pilot (4–5 clients, validate first)

The best/worst case tables below assume "no compromise on performance" — which is the right
frame once the platform is actually carrying real client volume. It's the wrong frame for
validating with the first 4–5 clients: most of those upgrades solve problems this scale doesn't
have yet. Here's the honest floor:

| Component | Pilot cost | Why this is fine at this scale |
|---|---|---|
| Database | **$0** — Supabase Free, Mumbai | Free tier only pauses after 7 days of *zero* activity. 4–5 live clients generate daily webhook traffic, so this never triggers — no performance compromise, genuinely production-fine here. |
| Redis | **$0** — not needed yet | `InlineQueueAdapter` handles this volume synchronously with no noticeable delay. Redis solves a blocking problem you don't have at 5 clients. |
| File storage | **$0** — free tier | Logos and light media for 5 tenants is nowhere near any free-tier ceiling. |
| Monitoring | **$0** — free tier, or skip | Nice to have, not urgent at a scale you can personally watch. |
| `apps/api` hosting | **$6–7/mo** — small VPS or Render Starter | **Worth paying even at pilot scale.** A free tier that sleeps doesn't just run slower — it silently drops customer replies and STOP requests, damaging trust with the exact clients you're trying to prove the product to. Cheapest insurance in this list. |
| Vercel hosting | **$0 or $20/mo** — your call | Hobby's *technical* limits (bandwidth, execution) won't be touched by 5 clients — this isn't a capacity tradeoff. Hobby's terms restrict it to personal, non-commercial use, which this isn't, regardless of client count. A policy risk, not a performance one — Pro removes it for $20/mo. |

**Pilot total: $6–7/mo (accepting the Hobby ToS gray area) to $27/mo (Vercel Pro, fully clean).**

**Upgrade triggers, not calendar dates:**

| Trigger | Upgrade |
|---|---|
| Consistent daily traffic across many tenants, or the platform sits unchecked for a week+ | Supabase Pro ($25) — removes the pause risk entirely |
| Sending starts feeling slow, or bulk campaign sends are added | Add Redis (~$10) |
| Ready to formalize the business / stop relying on Vercel's Hobby terms | Vercel Pro ($20) |
| Model proven, actively selling rather than piloting | Treat the "Best case" tier below as your new floor, not your ceiling |

## Stage 1 & 2 — best case vs. worst case at scale

Once past the pilot: production-grade quality with no free tiers that throttle, sleep, or breach
commercial terms — from a lean deployment to a fully scaled one.

## The numbers

| Component | Best case | Worst case | What drives the increase |
|---|---|---|---|
| **Vercel hosting** (`apps/admin`) | $20/mo (Pro plan) | $100–300+/mo | Function invocations, execution time, and bandwidth scale with tenant count and traffic. The free Hobby tier is off the table — its terms forbid commercial use, and its fair-use throttling is the opposite of "no compromise." |
| **Database** (Postgres) | $25/mo (e.g. Supabase Pro — no pausing, daily backups) | $100–600+/mo | More tenants → more concurrent connections and query volume → a bigger compute tier, not just more storage. |
| **`apps/api` hosting** (Meta webhook receiver — must be always-on) | $6–7/mo (small VPS or a paid always-on tier) | $50–150+/mo | Webhook volume scales directly with message volume. **This can never sleep or cold-start** — a missed webhook is a lost delivery receipt or a lost customer reply, not just a slow response. |
| **Redis** (for true async sending at scale, `BullQueueAdapter`) | $0 — not needed yet; `InlineQueueAdapter` is fine at low volume | $10–50/mo | Needed once send volume is high enough that synchronous sending would slow down the request path. |
| **File storage** (logos, media attachments) | $0 (covered by free tier) | $10–50/mo | Grows with tenant count and message-attachment volume. |
| **Error monitoring** | $0 (free tier) | ~$26/mo (team plan) | Worth adding before scale, not after an incident. |
| **Domain / DNS** | Already owned | Already owned | Fixed, not a variable. |
| **WhatsApp conversation costs (Meta)** | ~$0–20/mo at pilot volume | **Hundreds to several thousand $/mo** | **Not infrastructure** — Meta bills per conversation, priced by country and message category. Scales directly with tenant count and message volume. At real scale this is the dominant line item, full stop. |

**Rough monthly total:**
- **Best case:** ~$55–70/mo — genuinely production-grade, not a compromise, just low traffic.
- **Worst case (infrastructure only):** ~$1,076+/mo as tenant count and message volume grow, and this
  climbs further with heavier Vercel/database usage.
- **The line item that can eclipse everything else:** Meta's WhatsApp conversation charges. A
  platform serving even a modest number of active client businesses sending daily reminders can
  rack up more in conversation fees than in all hosting combined — and that bill lands on each
  client's WABA, not on a hosting choice this team controls.

## Where to watch, in priority order

1. **Meta conversation volume.** Track this per tenant from day one — the Sending Health widget
   (`apps/admin/src/lib/sendingHealth.ts`) already surfaces the daily unique-recipient count, so
   nobody should be surprised by a Meta invoice.
2. **Database connections.** The moment concurrent tenants hit Vercel serverless functions at
   once, connection pooling (see `production-db-analysis.md`) stops being optional — without it,
   performance degrades exactly at the point it can least afford to.
3. **`apps/api` uptime.** This is the one line where a "cheap" choice directly causes lost
   messages, not just a slower page. Treat it as the least negotiable item in the best-case
   column — a free tier that sleeps has no place here even at the earliest stage.

## Visual version

A rendered comparison (stat tiles, bar chart, and the same table with risk callouts highlighted)
is at `docs/infra-cost-scenarios-visual.html` — open it directly in a browser.
