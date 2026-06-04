import {
  type SeedAuthUserResult,
  seedAuthUser,
  slugify,
} from "@rezics/auth/seed";
import { DEFAULT_PUBLICATION_LICENSE_SLUG } from "@rezics/contract";
import { bootstrapSystemShelves } from "@rezics/server/db/seed-factory/system-shelves";
import type { SlugScopesMap } from "@rezics/server/db/seed/infra/seed-slug-scopes";
import type {
  AuthPrismaClient,
  ServerPrismaClient,
} from "../lib/prisma-factory";

export const ROOT_EMAIL = "root@rezics.com";
export const ROOT_SLUG = "root-user";
export const REZICS_INFRA_SLUG = "rezics";
export const REZICS_WIKI_INFRA_SLUG = "rezics-wiki";

export interface CrossSeedUserInput {
  email: string;
  name: string;
  role?: string;
  slug?: string;
  password?: string;
  bio?: string;
  permission?: unknown;
  settings?: unknown;
}

export const SEED_USERS: CrossSeedUserInput[] = [
  {
    email: ROOT_EMAIL,
    name: "Root User",
    role: "owner",
    slug: ROOT_SLUG,
    permission: { role: ["ROOT"] },
    settings: {
      publishing: { defaultLicenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG },
    },
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

export interface InfraUserSeedInput {
  slug: string;
  name: string;
  bio: string;
}

export const INFRA_USERS: InfraUserSeedInput[] = [
  {
    slug: REZICS_INFRA_SLUG,
    name: "Rezics",
    bio: "Official platform account for Rezics-owned content.",
  },
  {
    slug: REZICS_WIKI_INFRA_SLUG,
    name: "Rezics Wiki",
    bio: "Community catalog custodian account for wiki-owned content.",
  },
];

export function getServerRole(input: CrossSeedUserInput): string {
  return (input.permission as { role: string[] }).role[0]!;
}

interface SeedServerUserInput {
  unitId: string;
  slug: string;
  email: string;
  name: string;
  avatar?: string;
  bio?: string;
  permission?: unknown;
  settings?: unknown;
}

/**
 * Idempotently upsert the matching USER Unit (carrying the user-scope slug)
 * and the User extension row.
 */
async function seedServerUser(
  prisma: ServerPrismaClient,
  userScope: string,
  input: SeedServerUserInput,
): Promise<void> {
  await prisma.unit.upsert({
    where: { id: input.unitId },
    update: { slug: input.slug, slugScope: userScope },
    create: {
      id: input.unitId,
      type: "USER",
      slug: input.slug,
      slugScope: userScope,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      isLanguageNeutral: true,
    },
  });

  await prisma.user.upsert({
    where: { unitId: input.unitId },
    update: {
      authUserId: input.unitId,
      email: input.email,
      name: input.name,
      avatar: input.avatar,
      bio: input.bio,
      permission: input.permission as never,
      settings: input.settings as never,
    },
    create: {
      unitId: input.unitId,
      authUserId: input.unitId,
      email: input.email,
      name: input.name,
      avatar: input.avatar,
      bio: input.bio,
      permission: input.permission as never,
      settings: input.settings as never,
      joinDate: new Date(),
    },
  });

  await bootstrapSystemShelves(input.unitId, input.slug, prisma);
}

async function resolveOrCreateInfraUserUnit(
  prisma: ServerPrismaClient,
  userScope: string,
  input: InfraUserSeedInput,
): Promise<string> {
  const existingUnit = await prisma.unit.findUnique({
    where: { slugScope_slug: { slugScope: userScope, slug: input.slug } },
    select: { id: true, type: true },
  });

  if (existingUnit) {
    if (existingUnit.type !== "USER") {
      throw new Error(
        `Cannot seed infra user "${input.slug}": slug is already used by ${existingUnit.type}.`,
      );
    }
    return existingUnit.id;
  }

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT uuidv7() as id`;
    const id = rows[0]?.id;
    if (!id) {
      throw new Error(
        `[Seed] uuidv7() returned no row when creating infra user "${input.slug}"`,
      );
    }

    await tx.unit.create({
      data: {
        id,
        type: "USER",
        slug: input.slug,
        slugScope: userScope,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        isLanguageNeutral: true,
      },
    });

    return id;
  });
}

export async function seedInfraUsers(
  prisma: ServerPrismaClient,
  slugScopes: SlugScopesMap,
): Promise<Record<(typeof INFRA_USERS)[number]["slug"], string>> {
  const results: Record<string, string> = {};

  for (const input of INFRA_USERS) {
    const unitId = await resolveOrCreateInfraUserUnit(
      prisma,
      slugScopes.user,
      input,
    );

    await prisma.unit.update({
      where: { id: unitId },
      data: {
        slug: input.slug,
        slugScope: slugScopes.user,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        isLanguageNeutral: true,
      },
    });

    await prisma.user.upsert({
      where: { unitId },
      update: {
        authUserId: null,
        email: null,
        name: input.name,
        bio: input.bio,
        permission: null as never,
        settings: null as never,
      },
      create: {
        unitId,
        authUserId: null,
        email: null,
        name: input.name,
        bio: input.bio,
        permission: null as never,
        settings: null as never,
        joinDate: new Date(),
      },
    });

    results[input.slug] = unitId;
  }

  return results;
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
    const authResult = await seedAuthUser(
      {
        email: input.email,
        name: input.name,
        role: input.role,
        password: input.password,
      },
      authPrisma.db,
    );
    results.set(input.email, authResult);
  }
  return results;
}

export interface SeedAllUsersResult {
  rootUserId: string;
  infraUserIds: Record<string, string>;
  results: Array<{ result: CrossSeedUserResult; serverRole: string }>;
}

export async function seedAllMainUsers(
  serverPrisma: ServerPrismaClient,
  authResults: AuthSeedResults,
  slugScopes: SlugScopesMap,
): Promise<SeedAllUsersResult> {
  let rootUserId: string | undefined;
  const results: SeedAllUsersResult["results"] = [];

  for (const input of SEED_USERS) {
    const authResult = authResults.get(input.email);
    if (!authResult) {
      throw new Error(`Auth result missing for seed user ${input.email}`);
    }
    const slug = resolveSeedUserSlug(input);

    await seedServerUser(serverPrisma, slugScopes.user, {
      unitId: authResult.userId,
      slug,
      email: authResult.email,
      name: authResult.name,
      bio: input.bio,
      permission: input.permission,
      settings: input.settings,
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

  const infraUserIds = await seedInfraUsers(serverPrisma, slugScopes);

  return { rootUserId, infraUserIds, results };
}

export interface ResetRootUserResult {
  result: CrossSeedUserResult;
  serverRole: string;
}

export async function resetRootUser(
  authPrisma: AuthPrismaClient,
  serverPrisma: ServerPrismaClient,
  slugScopes: SlugScopesMap,
): Promise<ResetRootUserResult> {
  const rootInput = SEED_USERS.find((user) => user.email === ROOT_EMAIL);
  if (!rootInput) throw new Error("Root seed user definition is missing.");

  const authResult = await seedAuthUser(
    {
      email: rootInput.email,
      name: rootInput.name,
      role: rootInput.role,
      password: rootInput.password,
    },
    authPrisma.db,
  );

  const userScope = slugScopes.user;
  const slug = resolveSeedUserSlug(rootInput);

  const [byUnitId, byAuthUserId, byUnitSlug] = await Promise.all([
    serverPrisma.user.findUnique({
      where: { unitId: authResult.userId },
      select: { unitId: true },
    }),
    serverPrisma.user.findUnique({
      where: { authUserId: authResult.userId },
      select: { unitId: true },
    }),
    serverPrisma.unit.findUnique({
      where: { slugScope_slug: { slugScope: userScope, slug } },
      select: { id: true, type: true },
    }),
  ]);

  const candidateIds = [
    ...new Set(
      [
        byUnitId?.unitId,
        byAuthUserId?.unitId,
        byUnitSlug?.type === "USER" ? byUnitSlug.id : undefined,
      ].filter((id): id is string => typeof id === "string"),
    ),
  ];

  if (candidateIds.length > 1) {
    throw new Error(
      `Cannot reset root automatically: found conflicting root-like server users (${candidateIds.join(
        ", ",
      )}). Resolve the duplicate rows manually, then rerun reset-root.`,
    );
  }

  const targetUnitId = candidateIds[0] ?? authResult.userId;

  await serverPrisma.unit.upsert({
    where: { id: targetUnitId },
    update: { slug, slugScope: userScope },
    create: {
      id: targetUnitId,
      type: "USER",
      slug,
      slugScope: userScope,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      isLanguageNeutral: true,
    },
  });

  const data = {
    authUserId: authResult.userId,
    email: authResult.email,
    name: authResult.name,
    bio: rootInput.bio,
    permission: rootInput.permission as never,
    settings: rootInput.settings as never,
  };

  await serverPrisma.user.upsert({
    where: { unitId: targetUnitId },
    update: data,
    create: {
      ...data,
      unitId: targetUnitId,
      joinDate: new Date(),
    },
  });

  return {
    result: { ...authResult, slug },
    serverRole: getServerRole(rootInput),
  };
}
