import { parseMasterKey, parseSessionSecret, MasterKeyRing } from '@orgname/notify';

// Lazy — resolved on first use, not at module load, so `next build` doesn't
// crash before env vars are configured (e.g. first deploy).
let masterKey: Buffer | null = null;
let sessionSecret: Buffer | null = null;
let masterKeyRing: MasterKeyRing | null = null;

export function getMasterKey(): Buffer {
  if (masterKey) return masterKey;
  const raw = process.env.NOTIFY_MASTER_KEY;
  if (!raw) throw new Error('[admin] NOTIFY_MASTER_KEY is not set.');
  masterKey = parseMasterKey(raw);
  return masterKey;
}

/**
 * Version-aware view of the master key(s) — used wherever a row's stored
 * key_version might not be the current one (i.e. during a rotation window,
 * see scripts/rotate-master-key.ts). NOTIFY_MASTER_KEY_VERSION defaults to 1
 * (matching tenant_wa_credentials.key_version's DB default) so this works
 * unchanged for anyone who's never rotated.
 */
export function getMasterKeyRing(): MasterKeyRing {
  if (masterKeyRing) return masterKeyRing;
  const currentVersion = Number(process.env.NOTIFY_MASTER_KEY_VERSION ?? '1');
  const previousRaw    = process.env.NOTIFY_MASTER_KEY_PREVIOUS;
  masterKeyRing = {
    currentVersion,
    currentKey:  getMasterKey(),
    previousKey: previousRaw ? parseMasterKey(previousRaw) : undefined,
  };
  return masterKeyRing;
}

export function getSessionSecret(): Buffer {
  if (sessionSecret) return sessionSecret;
  const raw = process.env.SESSION_SECRET;
  if (!raw) throw new Error('[admin] SESSION_SECRET is not set.');
  sessionSecret = parseSessionSecret(raw);
  return sessionSecret;
}
