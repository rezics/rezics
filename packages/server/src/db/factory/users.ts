import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import {
  accounts,
  oauthAccessTokens,
  oauthClients,
  oauthConsents,
  oauthRefreshTokens,
  sessions,
  users,
} from "../../../../backend/src/auth/db/schema";
import { seedAuthUser } from "../../../../backend/src/auth/seed/seed-auth-user";
import {
  DEFAULT_PUBLICATION_LICENSE_SLUG,
  DEFAULT_REALM,
  markdownContentDoc,
} from "@rezics/contract";
import { and, eq, inArray, like } from "drizzle-orm";
import { ensureRegistrationDefaultSubscriptions } from "../../user/service/registration-defaults";
import { Unit, User, UserPreference } from "../schema";
import type { CountSpec, SeedCtx } from "./strategy.js";
import {
  bootstrapSystemShelves,
  createDrizzleSystemShelfClient,
} from "./system-shelves.js";
import type { CreatedUser } from "./types.js";
import {
  chunkedParallel,
  createUsernameGenerator,
  generateParagraph,
  withUpdatedAt,
} from "./utils.js";

const AUTH_CHUNK_SIZE = 8;
const FACTORY_AUTH_EMAIL_DOMAIN = "@mock.rezics.local";

function generateSlug(name: string): string {
  return `${name.replace(/\s+/g, "_")}_${randomUUID()}`;
}

function generateEmail(name: string): string {
  const local = name.replace(/\s+/g, ".").toLowerCase();
  return `${local}.${randomUUID().slice(0, 8)}@mock.rezics.local`;
}

interface FactoryUserPlan {
  name: string;
  slug: string;
  email: string;
  summary: string;
  description: string;
  joinDate: Date;
  avatar: string;
  permission?: { role: string[] };
  settings?: {
    publishing?: {
      defaultLicenseSlug?: string | null;
    };
  };
}

async function deleteExistingFactoryAuthUsers(ctx: SeedCtx): Promise<void> {
  const authUsers = await ctx.authDb.db
    .select({ id: users.id })
    .from(users)
    .where(like(users.email, `%${FACTORY_AUTH_EMAIL_DOMAIN}`));

  if (authUsers.length === 0) return;

  const userIds = authUsers.map((user) => user.id);
  await ctx.authDb.db.transaction(async (tx) => {
    await tx.delete(sessions).where(inArray(sessions.userId, userIds));
    await tx.delete(accounts).where(inArray(accounts.userId, userIds));
    await tx
      .delete(oauthRefreshTokens)
      .where(inArray(oauthRefreshTokens.userId, userIds));
    await tx
      .delete(oauthAccessTokens)
      .where(inArray(oauthAccessTokens.userId, userIds));
    await tx
      .delete(oauthConsents)
      .where(inArray(oauthConsents.userId, userIds));
    await tx.delete(oauthClients).where(inArray(oauthClients.userId, userIds));
    await tx.delete(users).where(inArray(users.id, userIds));
  });

  console.log(`[Seed] Deleted ${authUsers.length} stale factory auth user(s).`);
}

export async function seedUsers(
  ctx: SeedCtx,
  spec: CountSpec,
): Promise<CreatedUser[]> {
  const total = ctx.draw(spec);
  console.log(`[Seed] Seeding ${total} users (cross-DB)...`);
  await deleteExistingFactoryAuthUsers(ctx);
  const nextUsername = createUsernameGenerator();

  const adminPlan: FactoryUserPlan = {
    name: "Factory Admin",
    slug: "factory-admin",
    email: `factory-admin${randomUUID().slice(0, 8)}@mock.rezics.local`,
    summary: generateParagraph(1, 2),
    description: generateParagraph(5, 10),
    joinDate: faker.date.past({ years: 4 }),
    avatar: faker.image.avatar(),
    permission: { role: ["ADMIN"] },
    settings: {
      publishing: { defaultLicenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG },
    },
  };

  const userPlans: FactoryUserPlan[] = Array.from({ length: total }, () => {
    const name = nextUsername();
    return {
      name,
      slug: generateSlug(name),
      email: generateEmail(name),
      summary: generateParagraph(1, 2),
      description: generateParagraph(5, 10),
      joinDate: faker.date.past({ years: 4 }),
      avatar: faker.image.avatar(),
    };
  });

  const allPlans = [adminPlan, ...userPlans];

  const created = await chunkedParallel(
    allPlans,
    AUTH_CHUNK_SIZE,
    async (plan) => {
      const authResult = await seedAuthUser(
        {
          email: plan.email,
          name: plan.name,
          role: plan.permission?.role[0]?.toLowerCase() ?? "user",
        },
        ctx.authDb.db,
      );

      await ctx.db
        .insert(Unit)
        .values(
          withUpdatedAt({
            id: authResult.userId,
            type: "USER",
            slug: plan.slug,
            slugScope: ctx.slugScopes.user,
            status: "PUBLISHED",
            visibility: "PUBLIC",
            isLanguageNeutral: true,
          }),
        )
        .onConflictDoUpdate({
          target: Unit.id,
          set: {
            slug: plan.slug,
            slugScope: ctx.slugScopes.user,
            updatedAt: new Date(),
          },
        });
      await ctx.db.insert(User).values(
        withUpdatedAt({
          unitId: authResult.userId,
          authUserId: authResult.userId,
          email: plan.email,
          name: plan.name,
          avatar: plan.avatar,
          summary: plan.summary,
          description: markdownContentDoc(plan.description),
          joinDate: plan.joinDate,
          ...(plan.permission ? { permission: plan.permission } : {}),
        }),
      );

      if (plan.settings?.publishing?.defaultLicenseSlug !== undefined) {
        await ctx.db
          .insert(UserPreference)
          .values({
            userId: authResult.userId,
            defaultLicenseSlug: plan.settings.publishing.defaultLicenseSlug,
          })
          .onConflictDoUpdate({
            target: UserPreference.userId,
            set: {
              defaultLicenseSlug: plan.settings.publishing.defaultLicenseSlug,
              updatedAt: new Date(),
            },
          });
      }

      await bootstrapSystemShelves(
        authResult.userId,
        plan.slug,
        createDrizzleSystemShelfClient(ctx.db),
      );

      return {
        userId: authResult.userId,
        name: plan.name,
        slug: plan.slug,
      };
    },
  );

  await ensureFactoryDefaultSubscriptions(ctx, created);

  for (const user of created) {
    await ctx.sync.user(user.userId);
  }

  return created.slice(1);
}

async function ensureFactoryDefaultSubscriptions(
  ctx: SeedCtx,
  users: CreatedUser[],
): Promise<void> {
  const [defaultRealm] = await ctx.db
    .select({ id: Unit.id, type: Unit.type })
    .from(Unit)
    .where(
      and(
        eq(Unit.slugScope, ctx.slugScopes.realm),
        eq(Unit.slug, DEFAULT_REALM.slug),
      ),
    )
    .limit(1);

  if (!defaultRealm) return;
  if (defaultRealm.type !== "REALM") {
    throw new Error(
      `[Seed] Default realm slug "${DEFAULT_REALM.slug}" resolved to non-REALM unit (type=${defaultRealm.type}).`,
    );
  }

  // Factory users are created after baseline infra in normal local seeds. When
  // that infra is unavailable, skip defaults rather than fabricating targets.
  for (const user of users) {
    await ensureRegistrationDefaultSubscriptions(ctx.db, user.userId, {
      defaultRealmUnitId: defaultRealm.id,
      zoneSlugScopeId: ctx.slugScopes.zone,
    });
  }
}
