# Production Postgres Hosting Analysis

Decision doc for hosting the notify-sdk platform database. Context: node-postgres (`pg`) with plain SQL migrations, ~19 tables, low initial write volume (hundreds of messages/day), Vercel-hosted Next.js admin (`apps/admin`) plus a long-running Express API (`apps/api`) that receives Meta WhatsApp webhooks. Users are in India (azentis.in). Researched September 2026.

## Constraints that drive the decision

1. **Serverless connection exhaustion.** Every Vercel function invocation can open its own `pg.Pool`. Without a provider-side pooler (PgBouncer/Supavisor), a modest traffic burst exhausts Postgres's default ~100 connections. A built-in transaction-mode pooler is effectively mandatory.
2. **Region.** Vercel functions default to `iad1` (US). Both Hobby and Pro plans let you pin the function region — `bom1` (Mumbai) and `sin1` (Singapore) are available. The DB should sit in Mumbai or Singapore, and the Vercel function region must be changed to match, or every query pays a ~250ms US↔India round trip.
3. **Webhooks are latency-sensitive-ish.** Meta retries on non-2xx/slow responses; the Express app should not be on anything that sleeps.

## Option 1: Neon

- **Free plan (2026):** 0.5 GB storage, 100 CU-hours/month compute (doubled from 50 post-Databricks acquisition), autosuspend after 5 min idle on all plans.
- **Cold start:** after autosuspend, the first query pays a compute restart — typically sub-second to a couple of seconds. Acceptable for an ops admin panel; noticeable on the first webhook after a quiet period.
- **Pooling:** built-in PgBouncer in transaction mode via the `-pooler` connection-string suffix, up to 10,000 client connections. Works with `pg` for normal parameterized queries; session features (`SET`, `LISTEN/NOTIFY`, named `PREPARE`) unavailable on the pooled endpoint (use the direct endpoint for migrations).
- **Regions:** Singapore (`aws-ap-southeast-1`) yes; **no Mumbai**. Singapore↔Mumbai adds ~35–70ms per query.
- **Paid:** usage-based since Dec 2025 with no monthly minimum — $0.106/CU-hour (Launch), $0.35/GB-month storage. A small always-lightly-used DB lands in the $5–20/month range.

## Option 2: Supabase

- **Free plan:** 2 active projects, 500 MB database, 5 GB egress. **Projects pause after 7 days of inactivity** and must be manually restored from the dashboard. "Inactivity" means no API/dashboard activity — a production system receiving webhooks daily generally stays active, but a stalled pilot will find its DB paused. This is the free tier's biggest operational trap.
- **Pooling:** Supavisor. Port 6543 = transaction mode (use for Vercel functions), port 5432 = session/direct (use for migrations and the Express app). Named prepared statements historically unsupported in transaction mode (Supavisor 1.0 added support but with caveats); plain parameterized `pg` queries are fine.
- **Regions:** **Mumbai (`ap-south-1`)** and Singapore both available — the only managed option here with Mumbai.
- **Paid:** Pro $25/month per org — removes pausing, 8 GB DB included, daily backups. Clean, predictable step up.
- You'd use it as plain Postgres and ignore Auth/Realtime/Storage — that's fine and common.

## Option 3: Vercel Postgres / Marketplace

Vercel Postgres no longer exists as a product; all stores were migrated to **Neon via the Vercel Marketplace** (Q4 2024–Q1 2025). Installing "Neon for Vercel" gives you a real Neon project (same free limits as above), billed through your Vercel invoice, with env vars auto-injected. So this is Option 1 with unified billing and slightly less direct control of the Neon account. Same region constraint: Singapore, no Mumbai.

## Option 4: Railway / Render

- **Railway:** no permanent free tier ($5 one-time trial credit, then a $1/month credit on the Free plan — not enough for an always-on DB). Postgres realistically $10–15+/month plus service costs. Always-on, good DX, has a Singapore region. Fine, but you're paying from day one.
- **Render:** free Postgres **expires after 30 days** — a trial, not a tier. Paid Postgres from ~$7/month (basic, limited backups at the low end). Singapore region available; no Mumbai.

Neither beats Neon/Supabase on price at this scale.

## Option 5: Self-hosted on a VPS

- **Cost:** Hetzner CX22 (2 vCPU/4 GB/40 GB NVMe) ~$4.59/month; DigitalOcean Bangalore droplet ~$6/month (DO has a Bangalore region; Hetzner has Singapore but nothing in India).
- **Honest operational cost:** you own `pg_dump`/WAL backups and their off-site copies, restore testing, minor/major version upgrades, disk monitoring, security patching, and pgbouncer setup for the Vercel side. No auto-failover — if the box dies, you're restoring from last night's backup. That's hours per month of attention and real data-loss risk for a business messaging platform where `notify_log`/consent state matters.
- **Where it shines:** hosting the **Express API** (and later co-locating the DB once someone owns ops). One DO Bangalore droplet running `apps/api` + Postgres + pgbouncer is the cheapest all-India setup — but only take the DB part on deliberately.

## Architecture notes

- **Pooler compatibility:** the codebase uses plain parameterized queries via `pg` — no named prepared statements, no `LISTEN/NOTIFY` — so transaction-mode pooling works on both Neon and Supabase. Run migrations over the direct (session) connection string. Keep `pg.Pool` max low (~5) per function instance.
- **Express API hosting:** Render free sleeps after 15 min (30–50s wake — Meta webhooks will time out and retry; bad). Fly.io has no free tier anymore (~$5/month minimum). Render Starter $7/month (always-on, Singapore) or a $5–6 VPS are the sane choices. **Co-location matters more for the API than for the admin app** — it does the webhook signature check + several DB writes per inbound message, so keep it in the same region as the DB (Mumbai droplet + Supabase Mumbai, or Singapore Render + DB in Singapore).

## Recommendation

| Option | Free tier | India region | Pooler | Paid path | Verdict |
|---|---|---|---|---|---|
| Neon | 0.5 GB, 100 CU-h, autosuspend | Singapore only | PgBouncer (txn) | usage-based, ~$5–20/mo | Best free tier |
| Supabase | 500 MB, pauses after 7d idle | **Mumbai** + Singapore | Supavisor (txn) | Pro $25/mo | **Best overall fit** |
| Vercel Marketplace (Neon) | = Neon | Singapore only | = Neon | = Neon, on Vercel invoice | Convenience wrapper |
| Railway / Render PG | None real / 30-day trial | Singapore | Render: yes | $7–15/mo | No advantage here |
| VPS (Hetzner/DO) | — | DO Bangalore | DIY pgbouncer | $5–6/mo + your time | For the Express app, not the DB |

- **(a) Start now, zero cost: Supabase Free, Mumbai region** + Vercel functions pinned to `bom1`; connect via port 6543 (transaction pooler), migrate via 5432. Daily webhook traffic keeps it from pausing; the pause risk only bites pre-launch. Host `apps/api` on Render free *only* during development; move it off before going live with Meta webhooks.
- **(b) Growth path: Supabase Pro ($25/month)** — kills the pause behavior, adds daily backups, 8 GB — plus a ~$6 DO Bangalore droplet (or Render Starter $7) for `apps/api`. Total ~$31–32/month, everything in/near Mumbai. If Mumbai latency turns out not to matter, Neon (directly or via Vercel Marketplace) in Singapore is the cheaper usage-based alternative.

## Sources

- https://neon.com/pricing — Neon plans/limits
- https://neon.com/docs/introduction/regions — Neon regions (Singapore, no Mumbai)
- https://neon.com/docs/connect/connection-pooling — PgBouncer transaction mode, 10k connections
- https://supabase.com/docs/guides/platform/regions — Supabase Mumbai (`ap-south-1`), Singapore
- https://supabase.com/docs/guides/database/connecting-to-postgres — Supavisor ports 6543/5432
- https://supabase.com/docs/guides/troubleshooting/disabling-prepared-statements-qL8lEL — prepared-statement caveat
- https://uibakery.io/blog/supabase-pricing — Supabase free-tier pause, Pro $25
- https://neon.com/docs/guides/vercel-postgres-transition-guide — Vercel Postgres → Neon Marketplace
- https://vercel.com/marketplace/neon — Neon on Vercel Marketplace billing
- https://www.srvrlss.io/provider/railway/ — Railway free-tier status
- https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026 — Render free tier, spin-down
- https://www.saaspricepulse.com/tools/flyio — Fly.io free-tier removal
- https://vpsfor.dev/posts/hetzner-cx22-pricing-2026/ — Hetzner CX22 pricing
