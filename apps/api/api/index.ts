import { Request, Response, NextFunction } from 'express';
import { app } from '../src/app';

/**
 * Vercel serverless entry point — this file's path (apps/api/api/index.ts)
 * is Vercel's zero-config convention for a Node.js Function. vercel.json
 * rewrites every incoming path here so Express's own router (mounted in
 * src/app.ts) decides what to do with req.url, exactly as it would under a
 * long-running server.
 *
 * Deliberately does not import src/index.ts (the demo NotifyClient + /demo/*
 * routes) — see src/app.ts's own comment for why.
 */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('✗ /v1 request failed (serverless):', err.message);
  res.status(502).json({ error: err.message });
});

export default app;
