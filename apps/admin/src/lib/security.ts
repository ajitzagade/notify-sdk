import { parseMasterKey, parseSessionSecret } from '@orgname/notify';

// Lazy — resolved on first use, not at module load, so `next build` doesn't
// crash before env vars are configured (e.g. first deploy).
let masterKey: Buffer | null = null;
let sessionSecret: Buffer | null = null;

export function getMasterKey(): Buffer {
  if (masterKey) return masterKey;
  const raw = process.env.NOTIFY_MASTER_KEY;
  if (!raw) throw new Error('[admin] NOTIFY_MASTER_KEY is not set.');
  masterKey = parseMasterKey(raw);
  return masterKey;
}

export function getSessionSecret(): Buffer {
  if (sessionSecret) return sessionSecret;
  const raw = process.env.SESSION_SECRET;
  if (!raw) throw new Error('[admin] SESSION_SECRET is not set.');
  sessionSecret = parseSessionSecret(raw);
  return sessionSecret;
}
