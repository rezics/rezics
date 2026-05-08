import type { PrismaClient } from "../generated/client";

export async function resetAuthDatabase(prisma: PrismaClient): Promise<void> {
  console.log("[Reset] Resetting auth database...");

  await Promise.all([
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.verification.deleteMany(),
    prisma.oAuthRefreshToken.deleteMany(),
    prisma.oAuthAccessToken.deleteMany(),
    prisma.oAuthConsent.deleteMany(),
  ]);

  await prisma.oAuthClient.deleteMany();
  await prisma.user.deleteMany();

  console.log("[Reset] Auth database reset complete.");
}
