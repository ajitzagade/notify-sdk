import express from 'express';
import helmet from 'helmet';
import { v1Router } from './routes/v1';

/**
 * The production-relevant surface only: /v1/* (multi-tenant, API-key
 * authenticated). Deliberately excludes the /demo/* routes and the
 * single-tenant NotifyClient from src/index.ts — those exist as a local
 * reference for the SDK's basic API shape (see CLAUDE.md), not something
 * that should be reachable on a public production URL with fallback dummy
 * credentials.
 *
 * Shared between src/index.ts (local dev — mounts demo routes on top of
 * this) and api/index.ts (Vercel serverless entry — exports this as-is).
 * v1Router owns its own JSON parsing (including the raw-body capture for
 * Meta's HMAC signature verification) and its own error handler, so no
 * global body parser or error handler belongs here — adding one would only
 * apply to routes registered on `app` before it, and Express requires
 * error middleware to be registered after the routes it protects.
 */
export const app = express();
app.use(helmet());
app.use('/v1', v1Router);
