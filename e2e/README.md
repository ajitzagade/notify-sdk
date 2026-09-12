# E2E smoke suite (Playwright)

Browser-level tests against the real admin app — the layer the unit suites
(`packages/notify`, `apps/admin`) can't cover: auth redirects, page rendering,
the tenant workspace tabs, the starter template gallery.

## Prerequisites (once)

```bash
docker compose up -d                 # Postgres on :5434
# apply migrations (see root CLAUDE.md)
pnpm --filter admin seed:admin       # admin login (uses ADMIN_SEED_* from apps/admin/.env.local)
PGPASSWORD=notify psql -h localhost -p 5434 -U notify -d notify_sdk -f apps/admin/scripts/seed-demo-data.sql
pnpm exec playwright install chromium   # one-time browser download (free)
```

## Run

```bash
pnpm exec playwright test            # starts the admin dev server itself if not already running
pnpm exec playwright test --ui       # interactive mode for debugging
```

Notes:
- Credentials are read from `apps/admin/.env.local` (`ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`).
- Tests assume the **AZentis** demo tenant exists (from `seed-demo-data.sql`).
- Nothing here calls Meta's real API — flows that would (template submission,
  Embedded Signup) are asserted up to the last safe step only.
