import { parseMasterKey, MasterKeyRing } from '@orgname/notify';

let masterKey: Buffer | null = null;
let masterKeyRing: MasterKeyRing | null = null;

export function getMasterKey(): Buffer {
  if (masterKey) return masterKey;
  const raw = process.env.NOTIFY_MASTER_KEY;
  if (!raw) throw new Error('[api] NOTIFY_MASTER_KEY is not set — required for /v1/* multi-tenant routes.');
  masterKey = parseMasterKey(raw);
  return masterKey;
}

/** Version-aware view of the master key(s) — see apps/admin/src/lib/security.ts for the rotation flow this supports. */
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
