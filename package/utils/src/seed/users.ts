import {
  type SeedAuthUserResult,
  seedAuthUser,
} from "@rezics/auth/prisma/seed";
import type {
  AuthPrismaClient,
  ServerPrismaClient,
} from "../lib/prisma-factory";

export const ROOT_EMAIL = "root@rezics.com";

export interface CrossSeedUserInput {
  email: string;
  name: string;
  role?: string;
  slug?: string;
  password?: string;
  bio?: string;
  permission?: unknown;
}

export const SEED_USERS: CrossSeedUserInput[] = [
  {
    email: ROOT_EMAIL,
    name: "Root User",
    role: "owner",
    permission: { role: ["ROOT"] },
  },
  {
    email: "admin@rezics.com",
    name: "Admin User",
    role: "admin",
    permission: { role: ["ADMIN"] },
  },
  {
    email: "user@rezics.com",
    name: "Regular User",
    role: "user",
    permission: { role: ["USER"] },
  },
  {
    email: "blocked@rezics.com",
    name: "Blocked User",
    role: "user",
    permission: { role: ["BLOCKED"] },
  },
];

export function getServerRole(input: CrossSeedUserInput): string {
  return (input.permission as { role: string[] }).role[0]!;
}

interface SeedServerUserInput {
  unitId: string;
  slug: string;
  name: string;
  avatar?: string;
  bio?: string;
  permission?: unknown;
}

async function seedServerUser(
  prisma: ServerPrismaClient,
  input: SeedServerUserInput,
): Promise<void> {
  await prisma.user.upsert({
    where: { unitId: input.unitId },
    update: {
      permission: input.permission as never,
    },
    create: {
      unitId: input.unitId,
      slug: input.slug,
      name: input.name,
      avatar: input.avatar,
      bio: input.bio,
      permission: input.permission as never,
      joinDate: new Date(),
    },
  });
}

export async function crossSeedUser(
  authPrisma: AuthPrismaClient,
  serverPrisma: ServerPrismaClient,
  input: CrossSeedUserInput,
): Promise<SeedAuthUserResult> {
  const authResult = await seedAuthUser(authPrisma, {
    email: input.email,
    name: input.name,
    role: input.role,
    slug: input.slug,
    password: input.password,
  });

  await seedServerUser(serverPrisma, {
    unitId: authResult.userId,
    slug: authResult.slug,
    name: authResult.name,
    bio: input.bio,
    permission: input.permission,
  });

  return authResult;
}

// Delete server users first (FK dependency), then auth profiles, then auth users.
async function deleteExistingUsers(
  authPrisma: AuthPrismaClient,
  serverPrisma: ServerPrismaClient,
) {
  const emails = SEED_USERS.map((u) => u.email);

  const authUsers = await authPrisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });

  if (authUsers.length > 0) {
    const userIds = authUsers.map((u) => u.id);
    await serverPrisma.user.deleteMany({
      where: { unitId: { in: userIds } },
    });
    await authPrisma.userProfile.deleteMany({
      where: { userId: { in: userIds } },
    });
    await authPrisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
    console.log(`  Deleted ${authUsers.length} existing seed user(s).`);
  }
}

export interface SeedAllUsersResult {
  rootUserId: string;
  results: Array<{ result: SeedAuthUserResult; serverRole: string }>;
}

export async function seedAllUsers(
  authPrisma: AuthPrismaClient,
  serverPrisma: ServerPrismaClient,
  overwrite: boolean,
): Promise<SeedAllUsersResult> {
  if (overwrite) {
    await deleteExistingUsers(authPrisma, serverPrisma);
  }

  let rootUserId: string | undefined;
  const results: SeedAllUsersResult["results"] = [];

  for (const input of SEED_USERS) {
    const result = await crossSeedUser(authPrisma, serverPrisma, input);
    const serverRole = getServerRole(input);
    results.push({ result, serverRole });
    if (input.email === ROOT_EMAIL) {
      rootUserId = result.userId;
    }
  }

  if (!rootUserId) {
    throw new Error("Root user not found after seeding.");
  }

  return { rootUserId, results };
}

export async function resolveRootUserId(
  authPrisma: AuthPrismaClient,
  serverPrisma: ServerPrismaClient,
): Promise<string | null> {
  const authRoot = await authPrisma.user.findUnique({
    where: { email: ROOT_EMAIL },
    select: { id: true },
  });
  if (!authRoot) return null;

  const serverRoot = await serverPrisma.user.findUnique({
    where: { unitId: authRoot.id },
    select: { unitId: true },
  });
  return serverRoot?.unitId ?? null;
}
