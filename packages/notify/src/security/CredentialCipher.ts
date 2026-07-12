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
