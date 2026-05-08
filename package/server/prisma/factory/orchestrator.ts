import type { Prisma } from "../generated/client.js";
import { PostKind } from "../generated/client.js";
import { resetDatabasePreserveInfra } from "../seed/database.js";
import { seedInfra } from "../seed/infra/index.js";
import { seedOrganizations, seedPeople } from "./attribution.js";
import {
  seedBooks,
  seedChaptersForBook,
  updateContentStructure,
} from "./books.js";
import { seedEchoKV } from "./echokv.js";
import { seedEngagement } from "./engagement.js";
import { seedGames } from "./games.js";
import { seedMedia } from "./media.js";
import { seedPinboard } from "./pinboard.js";
import { seedPostsForWorks, seedWikiTranslationGroups } from "./posts.js";
import { seedRealms } from "./realms.js";
import { seedScores } from "./scores.js";
import { seedShelves } from "./shelves.js";
import type { SeedCtx } from "./strategy.js";
import { seedTags } from "./tags.js";
import type { SeedPlan } from "./types.js";
import { seedUsers } from "./users.js";
import { chunkedParallel } from "./utils.js";
import { seedZones } from "./zones.js";

function stepTimer(label: string) {
  const start = performance.now();
  return () => {
    const ms = (performance.now() - start).toFixed(0);
    console.log(`[Seed] ${label} done (${ms}ms)`);
  };
}

async function resolveInfraOwnerUserId(ctx: SeedCtx): Promise<string> {
  const root = await ctx.prisma.user.findFirst({
    where: { permission: { equals: { role: ["ROOT"] } } },
    select: { userId: true },
  });
  if (root) return root.userId;

  const admin = await ctx.prisma.user.findFirst({
    where: { permission: { equals: { role: ["ADMIN"] } } },
    select: { userId: true },
  });
  if (admin) return admin.userId;

  const factoryAdmin = await ctx.prisma.user.findUnique({
    where: { slug: "admin" },
    select: { userId: true },
  });
  if (factoryAdmin) return factoryAdmin.userId;

  throw new Error(
    "[Seed] infra owner user not found — seed users before infra",
  );
}

export async function runFactorySeed(
  ctx: SeedCtx,
  plan: SeedPlan,
): Promise<void> {
  console.time("seed:total");
  console.log("[Seed] Starting database seeding...");

  let done = stepTimer("Step 1: Reset");
  await resetDatabasePreserveInfra(ctx.prisma);
  done();

  done = stepTimer("Step 2: Users + People + Organizations");
  const users = await seedUsers(ctx, plan.users);
  const [people, organizations] = await Promise.all([
    seedPeople(ctx, plan.personEntities),
    seedOrganizations(ctx, plan.organizationEntities),
  ]);
  console.log(
    `[Seed]   ${users.length} users, ${people.length} person entities, ${organizations.length} organization entities`,
  );
  done();

  done = stepTimer("Step 3: Infra");
  const infraOwnerUserId = await resolveInfraOwnerUserId(ctx);
  const { defaultRealmId } = await seedInfra(ctx.prisma, infraOwnerUserId);
  void defaultRealmId;
  done();

  done = stepTimer("Step 4: Tags");
  const tags = await seedTags(ctx, plan.tags, users);
  console.log(`[Seed]   ${tags.length} random tags`);
  done();

  done = stepTimer("Step 5: Books + Games + Media");
  const [books, games, mediaItems] = await Promise.all([
    seedBooks(ctx, plan.books, users, people, organizations, tags),
    seedGames(ctx, plan.games, users, people, organizations, tags),
    seedMedia(ctx, plan.media, users, people, organizations, tags),
  ]);
  const allWorkIds = [
    ...books.map((b) => b.id),
    ...games.map((g) => g.id),
    ...mediaItems.map((m) => m.id),
  ];
  const allWorks = [...books, ...games, ...mediaItems];
  console.log(
    `[Seed]   ${books.length} books, ${games.length} games, ${mediaItems.length} media`,
  );
  done();

  done = stepTimer("Step 6: Realms");
  const realms = await seedRealms(ctx, plan.realms, users, allWorkIds);
  console.log(`[Seed]   ${realms.length} realms`);
  done();

  done = stepTimer("Step 7: Scores");
  const { scoreEntries } = await seedScores(
    ctx,
    plan.scoresPerWork,
    allWorks,
    users,
    realms,
  );
  console.log(`[Seed]   ${scoreEntries.size} score entries`);
  done();

  done = stepTimer("Step 8: Posts");
  const posts = await seedPostsForWorks(
    ctx,
    plan.postsPerWork,
    plan.treeShape,
    allWorks,
    users,
    scoreEntries,
  );
  console.log(`[Seed]   ${posts.length} posts`);
  done();

  done = stepTimer("Step 8b: Wiki translation groups");
  const wikiGroup = await seedWikiTranslationGroups(ctx.prisma, users);
  if (wikiGroup) {
    console.log(
      `[Seed]   1 wiki translation group with ${wikiGroup.postIds.length} parallel posts`,
    );
  }
  done();

  done = stepTimer("Step 8c: Pinboard");
  await seedPinboard(ctx, realms, posts);
  done();

  done = stepTimer("Step 9: Shelves");
  const reviewPosts = posts.filter((p) => p.kind === PostKind.REVIEW);
  const shelves = await seedShelves(
    ctx,
    { shelves: plan.shelves, shelfItemCount: plan.shelfItemCount },
    users,
    allWorks,
    reviewPosts,
  );
  console.log(
    `[Seed]   ${shelves.length} shelves (${reviewPosts.length} review posts available)`,
  );
  done();

  done = stepTimer("Step 10: Chapters + BookContentStructure");
  const bookUnitMap = new Map<string, string>();
  for (const book of books) {
    const unit = await ctx.prisma.unit.findUnique({
      where: { id: book.id },
      select: { userId: true },
    });
    if (unit?.userId) bookUnitMap.set(book.id, unit.userId);
  }

  await chunkedParallel(books, 5, async (book) => {
    const userId = bookUnitMap.get(book.id);
    if (!userId) return;

    const chapterTree = await seedChaptersForBook(
      ctx,
      book.id,
      userId,
      plan.chapter,
    );
    await updateContentStructure(
      ctx.prisma,
      book.id,
      chapterTree as unknown as Prisma.InputJsonValue,
    );
  });
  done();

  done = stepTimer("Step 11: Engagement");
  const allEngagementUnits: typeof allWorks = [
    ...allWorks,
    ...posts.map((p) => ({ id: p.id, type: p.type })),
  ];
  await seedEngagement(
    ctx,
    {
      followsPerUser: plan.followsPerUser,
      favoriteItemsPerUser: plan.favoriteItemsPerUser,
    },
    users,
    allEngagementUnits,
  );
  done();

  done = stepTimer("Step 12: Zones");
  const zones = await seedZones(
    ctx,
    plan.zones,
    allWorkIds,
    tags.map((t) => t.id),
  );
  console.log(`[Seed]   ${zones.length} zones`);
  done();

  done = stepTimer("Step 13: EchoKV");
  await seedEchoKV(ctx.prisma);
  done();

  console.log("[Seed] Complete!", {
    users: users.length,
    personEntities: people.length,
    organizationEntities: organizations.length,
    tags: tags.length,
    books: books.length,
    games: games.length,
    media: mediaItems.length,
    posts: posts.length,
    reviewPosts: reviewPosts.length,
    shelves: shelves.length,
    realms: realms.length,
    zones: zones.length,
    totalUnits:
      allWorks.length +
      posts.length +
      shelves.length +
      realms.length +
      tags.length +
      zones.length,
  });
  console.timeEnd("seed:total");
}
