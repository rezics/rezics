import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import { seedAuthUser } from "@rezics/auth/prisma/seed";
import type { CountSpec, SeedCtx } from "./strategy.js";
import type { CreatedUser } from "./types.js";
import {
  chunkedParallel,
  createUsernameGenerator,
  generateParagraph,
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
  bio: string;
  description: string;
  joinDate: Date;
  avatar: string;
  permission?: { role: string[] };
}

async function deleteExistingFactoryAuthUsers(ctx: SeedCtx): Promise<void> {
  const authUsers = await ctx.authPrisma.user.findMany({
    where: { email: { endsWith: FACTORY_AUTH_EMAIL_DOMAIN } },
    select: { id: true },
  });

  if (authUsers.length === 0) return;

  const userIds = authUsers.map((user) => user.id);
  await Promise.all([
    ctx.authPrisma.session.deleteMany({
      where: { userId: { in: userIds } },
    }),
    ctx.authPrisma.account.deleteMany({
      where: { userId: { in: userIds } },
    }),
    ctx.authPrisma.oAuthRefreshToken.deleteMany({
      where: { userId: { in: userIds } },
    }),
    ctx.authPrisma.oAuthAccessToken.deleteMany({
      where: { userId: { in: userIds } },
    }),
    ctx.authPrisma.oAuthConsent.deleteMany({
      where: { userId: { in: userIds } },
    }),
    ctx.authPrisma.oAuthClient.deleteMany({
      where: { userId: { in: userIds } },
    }),
  ]);
  await ctx.authPrisma.user.deleteMany({
    where: { id: { in: userIds } },
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
    name: "Admin",
    slug: "admin",
    email: "factory-admin@mock.rezics.local",
    bio: generateParagraph(1, 2),
    description: generateParagraph(5, 10),
    joinDate: faker.date.past({ years: 4 }),
    avatar: faker.image.avatar(),
    permission: { role: ["ADMIN"] },
  };

  const userPlans: FactoryUserPlan[] = Array.from({ length: total }, () => {
    const name = nextUsername();
    return {
      name,
      slug: generateSlug(name),
      email: generateEmail(name),
      bio: generateParagraph(1, 2),
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
      const authResult = await seedAuthUser(ctx.authPrisma, {
        email: plan.email,
        name: plan.name,
        role: plan.permission?.role[0]?.toLowerCase() ?? "user",
      });

      await ctx.prisma.user.create({
        data: {
          userId: authResult.userId,
          authUserId: authResult.userId,
          email: plan.email,
          slug: plan.slug,
          name: plan.name,
          avatar: plan.avatar,
          bio: plan.bio,
          description: plan.description,
          joinDate: plan.joinDate,
          ...(plan.permission ? { permission: plan.permission } : {}),
        },
      });

      return {
        userId: authResult.userId,
        name: plan.name,
        slug: plan.slug,
      };
    },
  );

  return created.slice(1);
}
