import { randomBytes } from "node:crypto";
import type { PrismaClient } from "../generated/client";

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

export async function ensureUniqueSlug(
  prisma: PrismaClient,
  email: string,
  desiredSlug: string,
) {
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { profile: { select: { slug: true } } },
  });

  if (existingUser?.profile?.slug) {
    return existingUser.profile.slug;
  }

  let slug = desiredSlug;
  let suffix = 1;

  while (true) {
    const conflict = await prisma.userProfile.findUnique({
      where: { slug },
      select: { userId: true },
    });

    if (!conflict) return slug;

    suffix += 1;
    slug = `${desiredSlug}-${suffix}`;
  }
}
