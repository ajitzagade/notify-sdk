import { parseMasterKey } from '@orgname/notify';

let masterKey: Buffer | null = null;

export function getMasterKey(): Buffer {
  if (masterKey) return masterKey;
  const raw = process.env.NOTIFY_MASTER_KEY;
  if (!raw) throw new Error('[api] NOTIFY_MASTER_KEY is not set — required for /v1/* multi-tenant routes.');
  masterKey = parseMasterKey(raw);
  return masterKey;
}
