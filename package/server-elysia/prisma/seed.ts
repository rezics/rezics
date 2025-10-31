import 'dotenv/config';
import {PrismaClient} from './generated/client';
import type {Prisma} from './generated/client';
import {DEFAULT_COUNTS} from './seed/config';
import {resetDatabase} from './seed/database';
import {seedPressUsers, seedProducerUsers, seedUsers} from './seed/users';
import {seedTags} from './seed/tags';
import {seedBooks, updateChapterIndex, seedChaptersForBook} from './seed/books';
import {seedOtherUnits} from './seed/units';
import {seedComments, updateStatsWithCommentCounts} from './seed/comments';

// ------------------------------
// Prisma Client
// ------------------------------

const prisma = new PrismaClient();

// ------------------------------
// Main Function
// ------------------------------

/**
 * Main seeding function
 * Orchestrates the entire database seeding process
 */
async function main() {
  console.time('seed');
  console.log('🌱 Starting database seeding with Faker.js...');
  console.log('📊 Counts:', DEFAULT_COUNTS);

  try {
    // Reset database
    await resetDatabase(prisma);

    // Seed users
    const users = await seedUsers(prisma, DEFAULT_COUNTS.users);
    console.log(`✅ Created ${users.length} users`);

    const pressUsers = await seedPressUsers(prisma, DEFAULT_COUNTS.pressUsers);
    console.log(`✅ Created ${pressUsers.length} press users`);

    const producerUsers = await seedProducerUsers(
      prisma,
      DEFAULT_COUNTS.producerUsers,
    );
    console.log(`✅ Created ${producerUsers.length} producer users`);

    // Seed tags
    const tagUnitIds = await seedTags(prisma, DEFAULT_COUNTS.tags, users);
    console.log(`✅ Created ${tagUnitIds.length} tags`);

    // Seed books
    const books = await seedBooks(
      prisma,
      DEFAULT_COUNTS.books,
      users,
      pressUsers,
      producerUsers,
      tagUnitIds,
    );
    const bookIds = books.map(b => b.id);
    console.log(`✅ Created ${books.length} books`);

    // Seed other units
    const others = await seedOtherUnits(
      prisma,
      DEFAULT_COUNTS.otherPosts,
      users,
      bookIds,
      tagUnitIds,
    );
    console.log(`✅ Created ${others.length} other units`);

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
    const allRootUnitIds: string[] = [...bookIds, ...others.map(o => o.id)];
    const {perRootCount} = await seedComments(
      prisma,
      DEFAULT_COUNTS.comments,
      users,
      allRootUnitIds,
    );
    const totalComments = Array.from(perRootCount.values()).reduce(
      (a, b) => a + b,
      0,
    );
    console.log(`✅ Created ${totalComments} comments`);

    // Update stats with comment counts
    await updateStatsWithCommentCounts(prisma, perRootCount);

    // Print summary
    const summary = {
      users: users.length,
      tags: tagUnitIds.length,
      books: books.length,
      otherUnits: others.length,
      comments: totalComments,
    };

    console.log('🎉 Seed complete!', summary);
    console.timeEnd('seed');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

main()
  .catch(err => {
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
