import "dotenv/config";
import type { Prisma } from "#/prisma/client";
import { prisma } from "#/prisma/client";
import { resetDatabase } from "#/prisma/seed/database";
import {
  seedBooks,
  seedChaptersForBook,
  updateChapterIndex,
} from "#/prisma/seed/mock/books";
import {
  seedComments,
  updateStatsWithCommentCounts,
} from "#/prisma/seed/mock/comments";
import { DEFAULT_COUNTS } from "#/prisma/seed/mock/config";
import { seedEchoKV } from "#/prisma/seed/mock/echokv";
import { seedReadLists } from "#/prisma/seed/mock/readlist";
import { seedTags } from "#/prisma/seed/mock/tags";
import { seedOtherUnits } from "#/prisma/seed/mock/units";
import {
  seedPressUsers,
  seedProducerUsers,
  seedUsers,
} from "#/prisma/seed/mock/users";

// ------------------------------
// Main Function
// ------------------------------

/**
 * Main seeding function
 * Orchestrates the entire database seeding process
 */
async function main() {
  console.time("seed");
  console.log("[Seed] Starting database seeding with Faker.js...");
  console.log("[Seed] Counts:", DEFAULT_COUNTS);

  try {
    // Reset database
    await resetDatabase(prisma);

    // Seed users
    const users = await seedUsers(prisma, DEFAULT_COUNTS.users);
    console.log(`[Seed] Created ${users.length} users`);

    const pressUsers = await seedPressUsers(prisma, DEFAULT_COUNTS.pressUsers);
    console.log(`[Seed] Created ${pressUsers.length} press users`);

    const producerUsers = await seedProducerUsers(
      prisma,
      DEFAULT_COUNTS.producerUsers,
    );
    console.log(`[Seed] Created ${producerUsers.length} producer users`);

    // Seed tags
    const tagUnitIds = await seedTags(prisma, DEFAULT_COUNTS.tags, users);
    console.log(`[Seed] Created ${tagUnitIds.length} tags`);

    // Seed books
    const books = await seedBooks(
      prisma,
      DEFAULT_COUNTS.books,
      users,
      pressUsers,
      producerUsers,
      tagUnitIds,
    );
    const bookIds = books.map((b) => b.id);
    console.log(`[Seed] Created ${books.length} books`);

    // Seed other units
    const others = await seedOtherUnits(
      prisma,
      DEFAULT_COUNTS.otherPosts,
      users,
      bookIds,
      tagUnitIds,
    );
    const reviewUnitIds = others.map((o) => o.id);
    console.log(`[Seed] Created ${others.length} other units`);

    // Seed read lists
    const readLists = await seedReadLists(
      prisma,
      DEFAULT_COUNTS.readLists,
      users,
      bookIds,
      reviewUnitIds,
    );
    console.log(`[Seed] Created ${readLists.length} read lists`);

    // Generate chapters per book and update chapter index JSON
    for (const bookId of bookIds) {
      const chapterTree = await seedChaptersForBook(prisma, bookId);
      await updateChapterIndex(
        prisma,
        bookId,
        chapterTree as unknown as Prisma.InputJsonValue,
      );
    }

    // Seed comments
    const allRootUnitIds: string[] = [...bookIds, ...others.map((o) => o.id)];
    const { perRootCount } = await seedComments(
      prisma,
      DEFAULT_COUNTS.comments,
      users,
      allRootUnitIds,
    );
    const totalComments = Array.from(perRootCount.values()).reduce(
      (a, b) => a + b,
      0,
    );
    console.log(`[Seed] Created ${totalComments} comments`);

    // Update stats with comment counts
    await updateStatsWithCommentCounts(prisma, perRootCount);

    // Seed echo KV
    await seedEchoKV(prisma);

    // Print summary
    const summary = {
      users: users.length,
      tags: tagUnitIds.length,
      books: books.length,
      otherUnits: others.length,
      readLists: readLists.length,
      comments: totalComments,
    };

    console.log("[Seed] Seed complete!", summary);
    console.timeEnd("seed");
  } catch (error) {
    console.error("[Error] Seed failed:", error);
    throw error;
  }
}

main()
  .catch((err) => {
    console.error("[Error] Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
