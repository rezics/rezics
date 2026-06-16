import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generateSecureToken(bytes = 32): string {
  return `api_${randomBytes(bytes).toString("base64url")}`;
}

/**
 * Compute SHA3-256 hash of a token
 * Output: hex-encoded string
 * 计算 token 的 SHA3-256 哈希
 * 输出：十六进制编码的字符串
 */
export function hashToken(token: string | Buffer): string {
  return createHash("sha3-256").update(token).digest("hex");
}

/**
 * Validate a token against a known hash using timingSafeEqual
 * Prevents timing attacks
 * 使用 timingSafeEqual 将 token 与已知哈希进行比对校验
 * 防止时序攻击
 */
export function verifyTokenHash(
  token: string | Buffer,
  expectedHash: string,
): boolean {
  const tokenHash = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (tokenHash.length !== expected.length) {
    // Prevent leaking length info in error case
    // 防止在出错情况下泄露长度信息
    return false;
  }

  return timingSafeEqual(tokenHash, expected);
}
