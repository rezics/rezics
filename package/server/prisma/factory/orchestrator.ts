import { PostKind } from "../generated/client.js";
import {
  seedOrganizations,
  seedPeople,
  seedSubjectAttributions,
  seedSubjectEntities,
} from "./attribution.js";
import { seedBooks, seedChaptersForBook } from "./books.js";
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

export async function runFactorySeed(
  ctx: SeedCtx,
  plan: SeedPlan,
): Promise<void> {
  console.time("seed:total");
  console.log("[Seed] Starting database seeding...");

  let done = stepTimer("Step 1: Users + People + Organizations + Subjects");
  const users = await seedUsers(ctx, plan.users);
  const [people, organizations, subjects] = await Promise.all([
    seedPeople(ctx, plan.personEntities),
    seedOrganizations(ctx, plan.organizationEntities),
    seedSubjectEntities(ctx, plan.organizationEntities),
  ]);
  console.log(
    `[Seed]   ${users.length} users, ${people.length} person entities, ${organizations.length} organization entities, ${subjects.length} subject entities`,
  );
  done();

  done = stepTimer("Step 2: Tags");
  const tags = await seedTags(ctx, plan.tags, users);
  console.log(`[Seed]   ${tags.length} random tags`);
  done();

  done = stepTimer("Step 3: Books + Games + Media");
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
  const subjectAttributionCount = await seedSubjectAttributions(
    ctx.prisma,
    allWorks,
    subjects,
  );
  console.log(
    `[Seed]   ${books.length} books, ${games.length} games, ${mediaItems.length} media, ${subjectAttributionCount} subject attributions`,
  );
  done();

  done = stepTimer("Step 4: Realms");
  const realms = await seedRealms(ctx, plan.realms, users, allWorkIds);
  console.log(`[Seed]   ${realms.length} realms`);
  done();

  done = stepTimer("Step 5: Scores");
  const { scoreEntries } = await seedScores(
    ctx,
    plan.scoresPerWork,
    allWorks,
    users,
    realms,
  );
  console.log(`[Seed]   ${scoreEntries.size} score entries`);
  done();

  done = stepTimer("Step 6: Posts");
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

  done = stepTimer("Step 7: Wiki translation groups");
  const wikiGroup = await seedWikiTranslationGroups(ctx.prisma, users);
  if (wikiGroup) {
    console.log(
      `[Seed]   1 wiki translation group with ${wikiGroup.postIds.length} parallel posts`,
    );
  }
  done();

  done = stepTimer("Step 8: Pinboard");
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

  done = stepTimer("Step 10: Chapters + BookContentStructureNode rows");
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

    await seedChaptersForBook(ctx, book.id, userId, plan.chapter);
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
    subjectEntities: subjects.length,
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
