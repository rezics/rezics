export const PRISMA_PACKAGES = [
  "server",
  "auth",
  "notify",
  "reaction",
  "ranking",
  "history",
] as const;

export type PrismaPackage = (typeof PRISMA_PACKAGES)[number];

export function isPrismaPackage(value: string): value is PrismaPackage {
  return PRISMA_PACKAGES.includes(value as PrismaPackage);
}
