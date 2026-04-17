import "dotenv/config";
import type { Prisma } from "#/prisma/client";
import { prisma } from "#/prisma/client";
import { PostKind } from "#/prisma/generated/client.js";
import { resetDatabase } from "#/prisma/seed/database";
import { seedOrganizations, seedPeople } from "#/prisma/seed/mocks/attribution";
import {
  seedBooks,
  seedChaptersForBook,
  updateChapterIndex,
} from "#/prisma/seed/mocks/books";
import { DEFAULT_COUNTS } from "#/prisma/seed/mocks/config";
import { seedEchoKV } from "#/prisma/seed/mocks/echokv";
import { seedEngagement } from "#/prisma/seed/mocks/engagement";
import { seedGames } from "#/prisma/seed/mocks/games";
import { seedMedia } from "#/prisma/seed/mocks/media";
import {
  seedPostsForWorks,
  seedWikiTranslationGroups,
} from "#/prisma/seed/mocks/posts";
import { seedRealms } from "#/prisma/seed/mocks/realms";
import { seedScores } from "#/prisma/seed/mocks/scores";
import { seedShelves } from "#/prisma/seed/mocks/shelves";
import { seedTags } from "#/prisma/seed/mocks/tags";
import { seedUsers } from "#/prisma/seed/mocks/users";
import { chunkedParallel } from "#/prisma/seed/mocks/utils";
import { seedZones } from "#/prisma/seed/mocks/zones";

function stepTimer(label: string) {
  const start = performance.now();
  return () => {
    const ms = (performance.now() - start).toFixed(0);
    console.log(`[Seed] ${label} done (${ms}ms)`);
  };
}

async function main() {
  console.time("seed:total");
  console.log("[Seed] Starting database seeding...");
  console.log("[Seed] Counts:", DEFAULT_COUNTS);

  // ── STEP 1: Reset ─────────────────────────────────
  let done = stepTimer("Step 1: Reset");
  await resetDatabase(prisma);
  done();

  // ── STEP 2: Users + Entities (parallel) ───────────
  done = stepTimer("Step 2: Users + People + Organizations");
  const users = await seedUsers(prisma, DEFAULT_COUNTS.users);
  const [people, organizations] = await Promise.all([
    seedPeople(prisma, DEFAULT_COUNTS.personEntities),
    seedOrganizations(prisma, DEFAULT_COUNTS.organizationEntities),
  ]);
  console.log(
    `[Seed]   ${users.length} users, ${people.length} person entities, ${organizations.length} organization entities`,
  );
  done();

  // ── STEP 3: Tags ──────────────────────────────────
  done = stepTimer("Step 3: Tags");
  const tags = await seedTags(prisma, DEFAULT_COUNTS.tags, users);
  console.log(`[Seed]   ${tags.length} random tags`);
  done();

  // ── STEP 4: Works (parallel) ──────────────────────
  done = stepTimer("Step 4: Books + Games + Media");
  const [books, games, mediaItems] = await Promise.all([
    seedBooks(prisma, DEFAULT_COUNTS.books, users, people, organizations, tags),
    seedGames(prisma, DEFAULT_COUNTS.games, users, people, organizations, tags),
    seedMedia(prisma, DEFAULT_COUNTS.media, users, people, organizations, tags),
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

  // ── STEP 5: Realms (needed by scores) ─────────────
  done = stepTimer("Step 5: Realms");
  const realms = await seedRealms(prisma, DEFAULT_COUNTS.realms, users, allWorkIds);
  console.log(`[Seed]   ${realms.length} realms`);
  done();

  // ── STEP 6: Scores (needs realms + works) ─────────
  done = stepTimer("Step 6: Scores");
  const { scoreEntries } = await seedScores(prisma, allWorks, users, realms, 5);
  console.log(`[Seed]   ${scoreEntries.size} score entries`);
  done();

  // ── STEP 7: Posts (power-law per work) ────────────
  done = stepTimer("Step 7: Posts");
  const posts = await seedPostsForWorks(prisma, allWorks, users, scoreEntries);
  console.log(`[Seed]   ${posts.length} posts`);
  done();

  // ── STEP 7b: Wiki translation groups ──────────────
  done = stepTimer("Step 7b: Wiki translation groups");
  const wikiGroup = await seedWikiTranslationGroups(prisma, users);
  if (wikiGroup) {
    console.log(
      `[Seed]   1 wiki translation group with ${wikiGroup.postIds.length} parallel posts`,
    );
  }
  done();

  // ── STEP 8: Shelves (needs review posts) ──────────
  done = stepTimer("Step 8: Shelves");
  const reviewPosts = posts.filter((p) => p.kind === PostKind.REVIEW);
  const shelves = await seedShelves(
    prisma,
    DEFAULT_COUNTS.shelves,
    users,
    allWorkIds,
    reviewPosts,
  );
  console.log(`[Seed]   ${shelves.length} shelves (${reviewPosts.length} review posts available)`);
  done();

  // ── STEP 9: Chapters (power-law per book) ─────────
  done = stepTimer("Step 9: Chapters + BookIndex");
  const bookUnitMap = new Map<string, string>();
  for (const book of books) {
    const unit = await prisma.unit.findUnique({
      where: { id: book.id },
      select: { userId: true },
    });
    if (unit?.userId) bookUnitMap.set(book.id, unit.userId);
  }

  await chunkedParallel(books, 5, async (book) => {
    const userId = bookUnitMap.get(book.id);
    if (!userId) return;

    const chapterTree = await seedChaptersForBook(prisma, book.id, userId);
    await updateChapterIndex(
      prisma,
      book.id,
      chapterTree as unknown as Prisma.InputJsonValue,
    );
  });
  done();

  // ── STEP 10: Engagement ────────────────────────────
  done = stepTimer("Step 10: Engagement");
  const allUnitIds = [
    ...allWorkIds,
    ...posts.map((p) => p.id),
    ...shelves.map((s) => s.id),
    ...realms.map((r) => r.id),
    ...tags.map((t) => t.id),
  ];
  await seedEngagement(prisma, users, allUnitIds, {
    followsPerUser: DEFAULT_COUNTS.followsPerUser,
    bookmarksPerUser: DEFAULT_COUNTS.bookmarksPerUser,
  });
  done();

  // ── STEP 11: Zones (needs works + tags) ───────────
  done = stepTimer("Step 11: Zones");
  const zones = await seedZones(
    prisma,
    DEFAULT_COUNTS.zones,
    allWorkIds,
    tags.map((t) => t.id),
  );
  console.log(`[Seed]   ${zones.length} zones`);
  done();

  // ── STEP 12: EchoKV ────────────────────────────────
  done = stepTimer("Step 12: EchoKV");
  await seedEchoKV(prisma);
  done();

  // ── Summary ───────────────────────────────────────
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
    totalUnits: allUnitIds.length + zones.length,
  });
  console.timeEnd("seed:total");
}

main()
  .catch((err) => {
    console.error("[Error] Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
