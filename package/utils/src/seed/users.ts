import {
  type SeedAuthUserResult,
  seedAuthUser,
  slugify,
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
  userId: string;
  slug: string;
  email: string;
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
    where: { userId: input.userId },
    update: {
      authUserId: input.userId,
      email: input.email,
      slug: input.slug,
      name: input.name,
      avatar: input.avatar,
      bio: input.bio,
      permission: input.permission as never,
    },
    create: {
      userId: input.userId,
      authUserId: input.userId,
      email: input.email,
      slug: input.slug,
      name: input.name,
      avatar: input.avatar,
      bio: input.bio,
      permission: input.permission as never,
      joinDate: new Date(),
    },
  });
}

export type CrossSeedUserResult = SeedAuthUserResult & {
  slug: string;
};

function resolveSeedUserSlug(input: CrossSeedUserInput): string {
  const slug = input.slug ?? slugify(input.name);
  return slug || input.email.split("@")[0]!;
}

// Delete server users first (FK dependency), then auth users.
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
      where: {
        OR: [
          { userId: { in: userIds } },
          { authUserId: { in: userIds } },
          { email: { in: emails } },
        ],
      },
    });
    await authPrisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
    console.log(`  Deleted ${authUsers.length} existing seed user(s).`);
  }
}

export type AuthSeedResults = Map<string, SeedAuthUserResult>;

export async function seedAllAuthUsers(
  authPrisma: AuthPrismaClient,
  overwrite: boolean,
  serverPrisma?: ServerPrismaClient,
): Promise<AuthSeedResults> {
  if (overwrite && serverPrisma) {
    await deleteExistingUsers(authPrisma, serverPrisma);
  }

  const results: AuthSeedResults = new Map();
  for (const input of SEED_USERS) {
    const authResult = await seedAuthUser(authPrisma, {
      email: input.email,
      name: input.name,
      role: input.role,
      password: input.password,
    });
    results.set(input.email, authResult);
  }
  return results;
}

export interface SeedAllUsersResult {
  rootUserId: string;
  results: Array<{ result: CrossSeedUserResult; serverRole: string }>;
}

export async function seedAllMainUsers(
  serverPrisma: ServerPrismaClient,
  authResults: AuthSeedResults,
): Promise<SeedAllUsersResult> {
  let rootUserId: string | undefined;
  const results: SeedAllUsersResult["results"] = [];

  for (const input of SEED_USERS) {
    const authResult = authResults.get(input.email);
    if (!authResult) {
      throw new Error(`Auth result missing for seed user ${input.email}`);
    }
    const slug = resolveSeedUserSlug(input);

    await seedServerUser(serverPrisma, {
      userId: authResult.userId,
      slug,
      email: authResult.email,
      name: authResult.name,
      bio: input.bio,
      permission: input.permission,
    });

    const result: CrossSeedUserResult = { ...authResult, slug };
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
    where: { userId: authRoot.id },
    select: { userId: true },
  });
  return serverRoot?.userId ?? null;
}
