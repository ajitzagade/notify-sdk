import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';

// E2E smoke suite — see e2e/README.md for prerequisites (Postgres up, admin
// seeded, demo data loaded). Credentials come from apps/admin/.env.local so
// there's exactly one place they live.
dotenv.config({ path: 'apps/admin/.env.local' });

export default defineConfig({
  testDir: './e2e',
  // Generous: `next dev` compiles pages on first hit, which can eat 30s+ on a
  // cold server. Against a warm/production server tests finish in seconds.
  timeout: 90_000,
  retries: 0,
  // Single worker: tests share one dev server and one seeded database.
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3012',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm --filter admin dev',
    url: 'http://localhost:3012/login',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
