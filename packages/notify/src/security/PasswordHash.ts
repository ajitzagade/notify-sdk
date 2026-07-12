import crypto from 'crypto';

/**
 * Password hashing via Node's built-in scrypt — deliberately avoids bcrypt/argon2
 * (native-binding dependencies that would require a pnpm build-script approval,
 * same friction as msgpackr-extract) in favor of a zero-dependency primitive.
 */

const KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 }; // ~scrypt default, tuned for interactive login

export interface HashedPassword {
  hash: string; // hex
  salt: string; // hex
}

export function hashPassword(password: string): Promise<HashedPassword> {
  const salt = crypto.randomBytes(16);
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, SCRYPT_PARAMS, (err, derivedKey) => {
      if (err) return reject(err);
      resolve({ hash: derivedKey.toString('hex'), salt: salt.toString('hex') });
    });
  });
}

export function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, Buffer.from(salt, 'hex'), KEY_LENGTH, SCRYPT_PARAMS, (err, derivedKey) => {
      if (err) return reject(err);
      const stored = Buffer.from(hash, 'hex');
      resolve(stored.length === derivedKey.length && crypto.timingSafeEqual(stored, derivedKey));
    });
  });
}
