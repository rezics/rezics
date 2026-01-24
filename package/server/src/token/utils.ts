import {createHash, timingSafeEqual} from 'crypto';

import {randomBytes} from 'crypto';

export function generateSecureToken(bytes = 32): string {
  return `api_${randomBytes(bytes).toString('base64url')}`;
}

/**
 * Compute SHA3-256 hash of a token
 * Output: hex-encoded string
 */
export function hashToken(token: string | Buffer): string {
  return createHash('sha3-256').update(token).digest('hex');
}

/**
 * Validate a token against a known hash using timingSafeEqual
 * Prevents timing attacks
 */
export function verifyTokenHash(
  token: string | Buffer,
  expectedHash: string,
): boolean {
  const tokenHash = Buffer.from(hashToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  if (tokenHash.length !== expected.length) {
    // Prevent leaking length info in error case
    return false;
  }

  return timingSafeEqual(tokenHash, expected);
}
