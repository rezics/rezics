import "dotenv/config";
import type { Prisma } from "#/prisma/client";
import { prisma } from "#/prisma/client";
import { resetDatabase } from "#/prisma/seed/database";
import { seedOrganizations, seedPeople } from "#/prisma/seed/mock/attribution";
import {
  seedBooks,
  seedChaptersForBook,
  updateChapterIndex,
} from "#/prisma/seed/mock/books";
import { DEFAULT_COUNTS } from "#/prisma/seed/mock/config";
import { seedEchoKV } from "#/prisma/seed/mock/echokv";
import { seedEngagement } from "#/prisma/seed/mock/engagement";
import { seedGames } from "#/prisma/seed/mock/games";
import { seedMedia } from "#/prisma/seed/mock/media";
import { seedPostsForWorks } from "#/prisma/seed/mock/posts";
import { seedRealms } from "#/prisma/seed/mock/realms";
import { seedScores } from "#/prisma/seed/mock/scores";
import { seedShelves } from "#/prisma/seed/mock/shelves";
import { seedTags } from "#/prisma/seed/mock/tags";
import { seedUsers } from "#/prisma/seed/mock/users";
import { chunkedParallel } from "#/prisma/seed/mock/utils";

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

  // ── STEP 2: Foundation (parallel) ─────────────────
  done = stepTimer("Step 2: Users + People + Organizations");
  const [users, people, organizations] = await Promise.all([
    seedUsers(prisma, DEFAULT_COUNTS.users),
    seedPeople(prisma, DEFAULT_COUNTS.people),
    seedOrganizations(prisma, DEFAULT_COUNTS.organizations),
  ]);
  console.log(
    `[Seed]   ${users.length} users, ${people.length} people, ${organizations.length} organizations`,
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
  console.log(
    `[Seed]   ${books.length} books, ${games.length} games, ${mediaItems.length} media`,
  );
  done();

  // ── STEP 5: Shelves + Realms (parallel) ───────────
  done = stepTimer("Step 5: Shelves + Realms");
  const allWorks = [...books, ...games, ...mediaItems];
  const [shelves, realms] = await Promise.all([
    seedShelves(prisma, DEFAULT_COUNTS.shelves, users, allWorkIds, []),
    seedRealms(prisma, DEFAULT_COUNTS.realms, users, allWorkIds),
  ]);
  console.log(`[Seed]   ${shelves.length} shelves, ${realms.length} realms`);
  done();

  // ── STEP 5a: Scores (needs realms + works) ──────
  done = stepTimer("Step 5a: Scores");
  const { scoreEntries } = await seedScores(
    prisma,
    allWorks,
    users,
    realms,
    DEFAULT_COUNTS.reviewsPerWork,
  );
  console.log(`[Seed]   ${scoreEntries.size} score entries`);
  done();

  // ── STEP 5b: Posts (needs scores for review/remark linking)
  done = stepTimer("Step 5b: Posts");
  const posts = await seedPostsForWorks(prisma, allWorks, users, {
    reviews: DEFAULT_COUNTS.reviewsPerWork,
    comments: DEFAULT_COUNTS.commentsPerWork,
    quotes: DEFAULT_COUNTS.quotesPerWork,
    remarks: DEFAULT_COUNTS.remarksPerWork,
  }, scoreEntries);
  console.log(`[Seed]   ${posts.length} posts`);
  done();

  // ── STEP 5c: Chapters (needs books from step 4) ──
  done = stepTimer("Step 5c: Chapters + BookIndex");
  const bookUnitMap = new Map<string, string>();
  for (const book of books) {
    // We need the userId for each book to assign chapters
    const unit = await prisma.unit.findUnique({
      where: { id: book.id },
      select: { userId: true },
    });
    if (unit?.userId) bookUnitMap.set(book.id, unit.userId);
  }

  await chunkedParallel(books, 5, async (book) => {
    const userId = bookUnitMap.get(book.id);
    if (!userId) return;

    const chapterTree = await seedChaptersForBook(prisma, book.id, userId, {
      topLevelCount: 2,
      minChildren: 3,
      maxChildren: DEFAULT_COUNTS.chaptersPerBook,
    });
    await updateChapterIndex(
      prisma,
      book.id,
      chapterTree as unknown as Prisma.InputJsonValue,
    );
  });
  done();

  // ── STEP 6: Engagement ────────────────────────────
  done = stepTimer("Step 6: Engagement");
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

  // ── STEP 7: Platform ──────────────────────────────
  done = stepTimer("Step 7: EchoKV");
  await seedEchoKV(prisma);
  done();

  // ── Summary ───────────────────────────────────────
  console.log("[Seed] Complete!", {
    users: users.length,
    people: people.length,
    organizations: organizations.length,
    tags: tags.length,
    books: books.length,
    games: games.length,
    media: mediaItems.length,
    posts: posts.length,
    shelves: shelves.length,
    realms: realms.length,
    totalUnits: allUnitIds.length,
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
