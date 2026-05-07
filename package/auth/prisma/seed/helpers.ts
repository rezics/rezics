import { randomBytes } from "node:crypto";
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/**
 * 生成 24 位安全随机密码
 */
export function generatePassword(): string {
  return randomBytes(18).toString("base64").replace(/[+/=]/g, "").slice(0, 24);
}
