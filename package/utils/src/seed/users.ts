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
export const ROOT_SLUG = "root-user";

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
    slug: ROOT_SLUG,
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

export type AuthSeedResults = Map<string, SeedAuthUserResult>;

export async function seedAllAuthUsers(
  authPrisma: AuthPrismaClient,
): Promise<AuthSeedResults> {
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

export interface ResetRootUserResult {
  result: CrossSeedUserResult;
  serverRole: string;
}

export async function resetRootUser(
  authPrisma: AuthPrismaClient,
  serverPrisma: ServerPrismaClient,
): Promise<ResetRootUserResult> {
  const rootInput = SEED_USERS.find((user) => user.email === ROOT_EMAIL);
  if (!rootInput) throw new Error("Root seed user definition is missing.");

  const authResult = await seedAuthUser(authPrisma, {
    email: rootInput.email,
    name: rootInput.name,
    role: rootInput.role,
    password: rootInput.password,
  });

  const [byUserId, byAuthUserId, bySlug] = await Promise.all([
    serverPrisma.user.findUnique({
      where: { userId: authResult.userId },
      select: { userId: true },
    }),
    serverPrisma.user.findUnique({
      where: { authUserId: authResult.userId },
      select: { userId: true },
    }),
    serverPrisma.user.findUnique({
      where: { slug: ROOT_SLUG },
      select: { userId: true },
    }),
  ]);

  const candidates = [byUserId, byAuthUserId, bySlug].filter(
    (user): user is { userId: string } => user !== null,
  );
  const candidateIds = [...new Set(candidates.map((user) => user.userId))];

  if (candidateIds.length > 1) {
    throw new Error(
      `Cannot reset root automatically: found conflicting root-like server users (${candidateIds.join(
        ", ",
      )}). Resolve the duplicate rows manually, then rerun reset-root.`,
    );
  }

  const slug = resolveSeedUserSlug(rootInput);
  const targetUserId = candidateIds[0];
  const data = {
    userId: authResult.userId,
    authUserId: authResult.userId,
    email: authResult.email,
    slug,
    name: authResult.name,
    bio: rootInput.bio,
    permission: rootInput.permission as never,
  };

  if (targetUserId) {
    await serverPrisma.user.update({
      where: { userId: targetUserId },
      data,
    });
  } else {
    await serverPrisma.user.create({
      data: {
        ...data,
        joinDate: new Date(),
      },
    });
  }

  return {
    result: { ...authResult, slug },
    serverRole: getServerRole(rootInput),
  };
}
