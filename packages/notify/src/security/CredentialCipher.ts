import crypto from 'crypto';

/**
 * Per-tenant credential encryption (AES-256-GCM).
 *
 * Rather than storing one key per tenant, each tenant's encryption key is
 * derived on the fly from a single root key via HKDF, keyed on the tenant id.
 * This gives real per-tenant key separation (compromising one tenant's stored
 * ciphertext doesn't help decrypt another's) without a KMS or a second secrets
 * store — only one root key (`NOTIFY_MASTER_KEY`) needs to be managed.
 */

export interface EncryptedSecret {
  ciphertext: string; // base64
  iv: string;          // hex
  tag: string;          // hex
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended for GCM

export function parseMasterKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `[CredentialCipher] NOTIFY_MASTER_KEY must decode to 32 bytes, got ${key.length}. ` +
      `Generate one with: openssl rand -base64 32`
    );
  }
  return key;
}

function deriveTenantKey(masterKey: Buffer, tenantId: string, keyVersion: number): Buffer {
  const info = Buffer.from(`notify-sdk:tenant-credentials:v${keyVersion}:${tenantId}`);
  const derived = crypto.hkdfSync('sha256', masterKey, Buffer.alloc(0), info, 32);
  return Buffer.from(derived);
}

export function encryptSecret(
  plaintext: string,
  tenantId: string,
  masterKey: Buffer,
  keyVersion = 1
): EncryptedSecret {
  const key = deriveTenantKey(masterKey, tenantId, keyVersion);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('base64'),
    iv:         iv.toString('hex'),
    tag:        tag.toString('hex'),
  };
}

export function decryptSecret(
  enc: EncryptedSecret,
  tenantId: string,
  masterKey: Buffer,
  keyVersion = 1
): string {
  const key = deriveTenantKey(masterKey, tenantId, keyVersion);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(enc.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(enc.tag, 'hex'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(enc.ciphertext, 'base64')),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}

/**
 * Root-key rotation. Rows encrypted under a previous NOTIFY_MASTER_KEY store
 * their key_version; this ring resolves the correct root key bytes for a
 * given version so old rows keep decrypting during a rotation window (before
 * they've been re-encrypted to the current version).
 */
export interface MasterKeyRing {
  currentVersion: number;
  currentKey: Buffer;
  /** Only needed while rows still exist at currentVersion - 1; drop after re-encrypting everything. */
  previousKey?: Buffer;
}

export function resolveKeyForVersion(ring: MasterKeyRing, keyVersion: number): Buffer {
  if (keyVersion === ring.currentVersion) return ring.currentKey;
  if (keyVersion === ring.currentVersion - 1 && ring.previousKey) return ring.previousKey;
  throw new Error(
    `[CredentialCipher] No master key available for version ${keyVersion} ` +
    `(current: ${ring.currentVersion}). Set NOTIFY_MASTER_KEY_PREVIOUS during a rotation window.`
  );
}

/** Decrypts under the row's stored version, re-encrypts under the ring's current version. */
export function reEncryptToCurrentVersion(
  enc: EncryptedSecret,
  tenantId: string,
  storedVersion: number,
  ring: MasterKeyRing
): { enc: EncryptedSecret; keyVersion: number } {
  const oldKey    = resolveKeyForVersion(ring, storedVersion);
  const plaintext = decryptSecret(enc, tenantId, oldKey, storedVersion);
  return {
    enc:        encryptSecret(plaintext, tenantId, ring.currentKey, ring.currentVersion),
    keyVersion: ring.currentVersion,
  };
}
