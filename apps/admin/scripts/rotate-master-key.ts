/**
 * Re-encrypts every tenant's WhatsApp credentials from the previous master
 * key to the current one. Run this AFTER bumping NOTIFY_MASTER_KEY_VERSION
 * and setting NOTIFY_MASTER_KEY to the new key (with NOTIFY_MASTER_KEY_PREVIOUS
 * still set to the old one, so old rows can still be decrypted during the
 * rotation window).
 *
 * Rotation steps:
 *   1. Generate a new key:            openssl rand -base64 32
 *   2. In .env.local: move the current NOTIFY_MASTER_KEY value to
 *      NOTIFY_MASTER_KEY_PREVIOUS, set NOTIFY_MASTER_KEY to the new value,
 *      and increment NOTIFY_MASTER_KEY_VERSION (e.g. 1 -> 2).
 *   3. Restart the admin app (picks up the new ring) and run this script.
 *   4. Once it reports 0 rows remaining at the old version, remove
 *      NOTIFY_MASTER_KEY_PREVIOUS from .env.local and restart apps/api too.
 *
 * Usage: pnpm rotate:master-key   (reads apps/admin/.env.local)
 */
import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { Pool } from 'pg';
import { reEncryptToCurrentVersion, MasterKeyRing, parseMasterKey } from '@orgname/notify';

async function main(): Promise<void> {
  const dbUrl           = process.env.DATABASE_URL;
  const currentRaw      = process.env.NOTIFY_MASTER_KEY;
  const previousRaw     = process.env.NOTIFY_MASTER_KEY_PREVIOUS;
  const currentVersion  = Number(process.env.NOTIFY_MASTER_KEY_VERSION ?? '1');

  if (!dbUrl) throw new Error('DATABASE_URL must be set in .env.local');
  if (!currentRaw) throw new Error('NOTIFY_MASTER_KEY must be set in .env.local');
  if (!previousRaw) {
    throw new Error(
      'NOTIFY_MASTER_KEY_PREVIOUS must be set in .env.local (the key being rotated OUT) — ' +
      'nothing to migrate from without it.'
    );
  }

  const ring: MasterKeyRing = {
    currentVersion,
    currentKey:  parseMasterKey(currentRaw),
    previousKey: parseMasterKey(previousRaw),
  };

  const pool = new Pool({ connectionString: dbUrl });

  const { rows } = await pool.query(
    `SELECT tenant_id, key_version,
            access_token_ciphertext, access_token_iv, access_token_tag,
            app_secret_ciphertext, app_secret_iv, app_secret_tag
       FROM tenant_wa_credentials
      WHERE key_version < $1`,
    [currentVersion]
  );

  console.log(`[rotate-master-key] ${rows.length} row(s) at an older key version to migrate.`);

  for (const row of rows) {
    const tenantId      = row.tenant_id as string;
    const storedVersion = row.key_version as number;

    const { enc: newAccessToken } = reEncryptToCurrentVersion(
      { ciphertext: row.access_token_ciphertext, iv: row.access_token_iv, tag: row.access_token_tag },
      tenantId,
      storedVersion,
      ring
    );

    const newAppSecret = row.app_secret_ciphertext
      ? reEncryptToCurrentVersion(
          { ciphertext: row.app_secret_ciphertext, iv: row.app_secret_iv, tag: row.app_secret_tag },
          tenantId,
          storedVersion,
          ring
        ).enc
      : null;

    await pool.query(
      `UPDATE tenant_wa_credentials SET
         access_token_ciphertext = $1, access_token_iv = $2, access_token_tag = $3,
         app_secret_ciphertext   = $4, app_secret_iv    = $5, app_secret_tag    = $6,
         key_version = $7, updated_at = NOW()
       WHERE tenant_id = $8`,
      [
        newAccessToken.ciphertext, newAccessToken.iv, newAccessToken.tag,
        newAppSecret?.ciphertext ?? null, newAppSecret?.iv ?? null, newAppSecret?.tag ?? null,
        currentVersion,
        tenantId,
      ]
    );

    console.log(`[rotate-master-key] Migrated tenant ${tenantId} (v${storedVersion} -> v${currentVersion})`);
  }

  const { rows: remaining } = await pool.query(
    `SELECT COUNT(*) FROM tenant_wa_credentials WHERE key_version < $1`,
    [currentVersion]
  );
  console.log(`[rotate-master-key] Done. ${remaining[0].count} row(s) remain at an older version.`);

  await pool.end();
}

main().catch((err) => {
  console.error('[rotate-master-key] Failed:', err);
  process.exit(1);
});
