import {
  type SeedAuthUserResult,
  seedAuthUser,
  slugify,
} from "@rezics/backend/auth/seed";
import { DEFAULT_PUBLICATION_LICENSE_SLUG } from "@rezics/contract";
import { Unit, User, UserPreference } from "@rezics/server/db/schema";
import type { SlugScopesMap } from "@rezics/server/db/seed/infra/seed-slug-scopes";
import {
  bootstrapSystemShelves,
  createDrizzleSystemShelfClient,
} from "@rezics/server/shelf/system-shelves";
import { and, eq, sql } from "drizzle-orm";
import type { AuthDbClient } from "../lib/db-factory";
import type { ServerSeedDb } from "./infra";

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
  summary?: string;
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
  summary: string;
}

export const INFRA_USERS: InfraUserSeedInput[] = [
  {
    slug: REZICS_INFRA_SLUG,
    name: "Rezics",
    summary: "Official platform account for Rezics-owned content.",
  },
  {
    slug: REZICS_WIKI_INFRA_SLUG,
    name: "Rezics Wiki",
    summary: "Community catalog custodian account for wiki-owned content.",
  },
];

function defaultLicenseSlugFromSettings(
  settings: unknown,
): string | null | undefined {
  const value = (
    settings as { publishing?: { defaultLicenseSlug?: unknown } } | null
  )?.publishing?.defaultLicenseSlug;
  return typeof value === "string" || value === null ? value : undefined;
}

export function getServerRole(input: CrossSeedUserInput): string {
  return (input.permission as { role: string[] }).role[0]!;
}

interface SeedServerUserInput {
  unitId: string;
  slug: string;
  email: string;
  name: string;
  avatar?: string;
  summary?: string;
  permission?: unknown;
  settings?: unknown;
}

type ServerUserSeedDb = ServerSeedDb & {
  insert: any;
  update: any;
};

/**
 * Idempotently upsert the matching USER Unit (carrying the user-scope slug)
 * and the User extension row.
 */
async function seedServerUser(
  db: ServerUserSeedDb,
  userScope: string,
  input: SeedServerUserInput,
): Promise<void> {
  await db.transaction(async (tx) => {
    const now = new Date();
    await tx
      .insert(Unit)
      .values({
        id: input.unitId,
        type: "USER",
        slug: input.slug,
        slugScope: userScope,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        isLanguageNeutral: true,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: Unit.id,
        set: { slug: input.slug, slugScope: userScope, updatedAt: now },
      });

    const userData = {
      authUserId: input.unitId,
      email: input.email,
      name: input.name,
      avatar: input.avatar ?? null,
      summary: input.summary ?? null,
      permission: input.permission,
      updatedAt: now,
    };

    await tx
      .insert(User)
      .values({
        ...userData,
        unitId: input.unitId,
        joinDate: now,
      })
      .onConflictDoUpdate({
        target: User.unitId,
        set: userData,
      });

    const defaultLicenseSlug = defaultLicenseSlugFromSettings(input.settings);
    if (defaultLicenseSlug !== undefined) {
      await tx
        .insert(UserPreference)
        .values({
          userId: input.unitId,
          defaultLicenseSlug,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: UserPreference.userId,
          set: { defaultLicenseSlug, updatedAt: now },
        });
    }

    await bootstrapSystemShelves(
      input.unitId,
      input.slug,
      createDrizzleSystemShelfClient(tx),
    );
  });
}

async function resolveOrCreateInfraUserUnit(
  db: ServerUserSeedDb,
  userScope: string,
  input: InfraUserSeedInput,
): Promise<string> {
  const [existingUnit] = await db
    .select({ id: Unit.id, type: Unit.type })
    .from(Unit)
    .where(and(eq(Unit.slugScope, userScope), eq(Unit.slug, input.slug)))
    .limit(1);

  if (existingUnit) {
    if (existingUnit.type !== "USER") {
      throw new Error(
        `Cannot seed infra user "${input.slug}": slug is already used by ${existingUnit.type}.`,
      );
    }
    return existingUnit.id;
  }

  return db.transaction(async (tx) => {
    const result = await tx.execute(sql`SELECT uuidv7() as id`);
    const id = (result.rows as Array<{ id?: string }>)[0]?.id;
    if (!id) {
      throw new Error(
        `[Seed] uuidv7() returned no row when creating infra user "${input.slug}"`,
      );
    }

    await tx.insert(Unit).values({
      id,
      type: "USER",
      slug: input.slug,
      slugScope: userScope,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      isLanguageNeutral: true,
      updatedAt: new Date(),
    });

    return id;
  });
}

export async function seedInfraUsers(
  db: ServerUserSeedDb,
  slugScopes: SlugScopesMap,
): Promise<Record<(typeof INFRA_USERS)[number]["slug"], string>> {
  const results: Record<string, string> = {};

  for (const input of INFRA_USERS) {
    const unitId = await resolveOrCreateInfraUserUnit(
      db,
      slugScopes.user,
      input,
    );
    const now = new Date();

    await db
      .update(Unit)
      .set({
        slug: input.slug,
        slugScope: slugScopes.user,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        isLanguageNeutral: true,
        updatedAt: now,
      })
      .where(eq(Unit.id, unitId));

    const userData = {
      authUserId: null,
      email: null,
      name: input.name,
      summary: input.summary,
      permission: null,
      updatedAt: now,
    };
    await db
      .insert(User)
      .values({
        ...userData,
        unitId,
        joinDate: now,
      })
      .onConflictDoUpdate({
        target: User.unitId,
        set: userData,
      });

    results[input.slug] = unitId;
  }

  return results;
}

export async function seedAllMainUsers(
  serverDb: ServerUserSeedDb,
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

    await seedServerUser(serverDb, slugScopes.user, {
      unitId: authResult.userId,
      slug,
      email: authResult.email,
      name: authResult.name,
      summary: input.summary,
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

  const infraUserIds = await seedInfraUsers(serverDb, slugScopes);

  return { rootUserId, infraUserIds, results };
}

async function findUserByUnitId(db: ServerUserSeedDb, unitId: string) {
  return (
    (
      await db
        .select({ unitId: User.unitId })
        .from(User)
        .where(eq(User.unitId, unitId))
        .limit(1)
    )[0] ?? null
  );
}

async function findUserByAuthUserId(db: ServerUserSeedDb, authUserId: string) {
  return (
    (
      await db
        .select({ unitId: User.unitId })
        .from(User)
        .where(eq(User.authUserId, authUserId))
        .limit(1)
    )[0] ?? null
  );
}

async function findUserUnitBySlug(
  db: ServerUserSeedDb,
  userScope: string,
  slug: string,
) {
  return (
    (
      await db
        .select({ id: Unit.id, type: Unit.type })
        .from(Unit)
        .where(and(eq(Unit.slugScope, userScope), eq(Unit.slug, slug)))
        .limit(1)
    )[0] ?? null
  );
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
  authDb: AuthDbClient,
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
      authDb.db,
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

export interface ResetRootUserResult {
  result: CrossSeedUserResult;
  serverRole: string;
}

export async function resetRootUser(
  authDb: AuthDbClient,
  serverDb: ServerUserSeedDb,
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
    authDb.db,
  );

  const userScope = slugScopes.user;
  const slug = resolveSeedUserSlug(rootInput);

  const [byUnitId, byAuthUserId, byUnitSlug] = await Promise.all([
    findUserByUnitId(serverDb, authResult.userId),
    findUserByAuthUserId(serverDb, authResult.userId),
    findUserUnitBySlug(serverDb, userScope, slug),
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
  const now = new Date();

  await serverDb
    .insert(Unit)
    .values({
      id: targetUnitId,
      type: "USER",
      slug,
      slugScope: userScope,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      isLanguageNeutral: true,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: Unit.id,
      set: { slug, slugScope: userScope, updatedAt: now },
    });

  const data = {
    authUserId: authResult.userId,
    email: authResult.email,
    name: authResult.name,
    summary: rootInput.summary ?? null,
    permission: rootInput.permission,
    updatedAt: now,
  };

  await serverDb
    .insert(User)
    .values({
      ...data,
      unitId: targetUnitId,
      joinDate: now,
    })
    .onConflictDoUpdate({
      target: User.unitId,
      set: data,
    });

  const defaultLicenseSlug = defaultLicenseSlugFromSettings(rootInput.settings);
  if (defaultLicenseSlug !== undefined) {
    await serverDb
      .insert(UserPreference)
      .values({
        userId: targetUnitId,
        defaultLicenseSlug,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: UserPreference.userId,
        set: { defaultLicenseSlug, updatedAt: now },
      });
  }

  return {
    result: { ...authResult, slug },
    serverRole: getServerRole(rootInput),
  };
}
