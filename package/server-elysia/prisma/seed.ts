import 'dotenv/config';
import {
  PrismaClient,
  PostType,
  PostStatus,
  Prisma,
} from './generated/client.js';

import {faker} from '@faker-js/faker';

import {getRandomBookCover} from './seed/data.js';

// ------------------------------
// Configuration
// ------------------------------

const prisma = new PrismaClient();

const DEFAULT_COUNTS = {
  users: envInt('SEED_USERS', 20),
  tags: envInt('SEED_TAGS', 40),
  books: envInt('SEED_BOOKS', 50),
  otherPosts: envInt('SEED_OTHER_POSTS', 150),
  comments: envInt('SEED_COMMENTS', 600),
};

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const v = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(v) ? v : fallback;
}

// ------------------------------
// Utilities
// ------------------------------

function randomInt(minInclusive: number, maxInclusive: number): number {
  return faker.number.int({min: minInclusive, max: maxInclusive});
}

function randomFloat(min: number, max: number): number {
  return faker.number.float({min, max});
}

function randomBoolean(trueProbability = 0.5): boolean {
  return Math.random() < trueProbability;
}

function pickN<T>(items: readonly T[], n: number): T[] {
  return faker.helpers.arrayElements(items, {min: n, max: n});
}

// ------------------------------
// Data Generators
// ------------------------------

function createUsernameGenerator() {
  const seen = new Set<string>();
  return function generateUsername(): string {
    const base = faker.internet.username().toLowerCase();
    if (!seen.has(base)) {
      seen.add(base);
      return base;
    }
    let i = 2;
    while (seen.has(`${base}${i}`)) i++;
    const name = `${base}${i}`;
    seen.add(name);
    return name;
  };
}

function generateTitle(minWords = 3, maxWords = 7): string {
  const wordCount = randomInt(minWords, maxWords);
  return faker.lorem
    .words(wordCount)
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function generateParagraph(minSentences = 2, maxSentences = 5): string {
  const sentenceCount = randomInt(minSentences, maxSentences);
  return faker.lorem.sentences(sentenceCount);
}

function generateBookExtra(): Prisma.InputJsonValue {
  return {
    publisher: faker.company.name(),
    year: faker.date.past({years: 45}).getFullYear(),
    language: faker.helpers.arrayElement(['en', 'zh', 'es', 'fr', 'de', 'jp']),
    format: faker.helpers.arrayElement(['paperback', 'hardcover', 'ebook']),
  };
}

function generateChapters(): string {
  const chapterCount = randomInt(5, 20);
  return JSON.stringify(
    Array.from({length: chapterCount}, (_, i) => ({
      index: i + 1,
      title: generateTitle(2, 4),
      pages: randomInt(5, 30),
    })),
  );
}

function buildPostTitleByType(type: PostType): string | null {
  switch (type) {
    case PostType.BOOK:
      return generateTitle(2, 5);
    case PostType.REVIEW:
      return generateTitle(3, 6);
    case PostType.QUOTE:
      return null;
    case PostType.NOTE:
      return generateTitle(2, 6);
    case PostType.READLIST:
      return generateTitle(2, 4);
    case PostType.IMAGE:
    case PostType.VIDEO:
      return generateTitle(2, 5);
    case PostType.COMMENT:
      return null;
    default:
      return generateTitle(2, 6);
  }
}

function buildMetadataByType(
  type: PostType,
  context: {bookIds: string[]},
): Prisma.InputJsonValue {
  switch (type) {
    case PostType.REVIEW:
      return {
        rating: Math.round(randomFloat(1, 5) * 10) / 10,
        title: generateTitle(2, 5),
      };
    case PostType.QUOTE:
      return {
        text: faker.lorem.sentence(),
        fromChapter: randomInt(1, 30),
      };
    case PostType.READLIST: {
      const count = randomInt(3, Math.min(10, context.bookIds.length));
      const selected = pickN(context.bookIds, count);
      return {
        coverUrl: faker.image.url({width: 400, height: 600}),
        books: selected,
      };
    }
    case PostType.IMAGE:
      return {
        url: faker.image.url({width: 800, height: 600}),
      };
    case PostType.VIDEO:
      return {url: faker.internet.url()};
    case PostType.NOTE:
      return {pinned: randomBoolean(0.1)};
    default:
      return {} as Prisma.InputJsonValue;
  }
}

// ------------------------------
// Seeding Functions
// ------------------------------

type CreatedUser = {id: string; name: string};
type CreatedPost = {id: string; type: PostType};

async function resetDatabase() {
  console.log('🗑️ Resetting database...');
  // Order matters due to FKs
  await prisma.commentIndex.deleteMany();
  await prisma.postReactions.deleteMany();
  await prisma.postStats.deleteMany();
  await prisma.book.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();
}

async function seedUsers(total: number): Promise<CreatedUser[]> {
  console.log(`👥 Seeding ${total} users...`);
  const nextUsername = createUsernameGenerator();
  const users: CreatedUser[] = [];

  for (let i = 0; i < total; i++) {
    const username = nextUsername();
    const slug = username.replace(/\s+/g, '_');
    const created = await prisma.user.create({
      data: {
        email: faker.internet.email({firstName: username}),
        passwordHash: faker.internet.password({length: 32}),
        slug,
        name: username,
        avatar: faker.image.avatar(),
        bio: generateParagraph(1, 2),
        joinDate: faker.date.past({years: 4}),
      },
      select: {id: true, name: true},
    });
    users.push(created);
  }

  return users;
}

async function seedTags(
  total: number,
  users: CreatedUser[],
): Promise<string[]> {
  console.log(`🏷️ Seeding ${total} tags...`);
  const TAG_TYPES = ['general', 'genre', 'author', 'system'] as const;
  const tagPostIds: string[] = [];

  for (let i = 0; i < total; i++) {
    const user = faker.helpers.arrayElement(users);
    const name = `${faker.word.adjective()} ${faker.word.noun()}`;
    const type = faker.helpers.arrayElement(TAG_TYPES);

    // Create a post for the tag
    const post = await prisma.post.create({
      data: {
        userId: user.id,
        type: PostType.NOTE,
        status: PostStatus.ACTIVE,
        title: `Tag: ${name}`,
        content: `This is a ${type} tag`,
        metadata: {},
        publishedAt: faker.date.past({years: 1}),
      },
    });

    // Create the tag
    await prisma.tag.create({
      data: {
        postId: post.id,
        name,
        type,
      },
    });

    tagPostIds.push(post.id);
  }

  return tagPostIds;
}

async function seedBooks(
  total: number,
  users: CreatedUser[],
  tagPostIds: string[],
): Promise<CreatedPost[]> {
  console.log(`📚 Seeding ${total} books...`);
  const created: CreatedPost[] = [];

  for (let i = 0; i < total; i++) {
    const author = faker.helpers.arrayElement(users);
    const title = buildPostTitleByType(PostType.BOOK) ?? generateTitle(2, 5);
    const publishedAt = randomBoolean(0.9) ? faker.date.past({years: 3}) : null;

    const post = await prisma.post.create({
      data: {
        userId: author.id,
        type: PostType.BOOK,
        status: randomBoolean(0.85) ? PostStatus.ACTIVE : PostStatus.DRAFT,
        title,
        content: generateParagraph(2, 5),
        metadata: {},
        publishedAt,
        tags: {
          connect: pickN(tagPostIds, randomInt(0, 3)).map(postId => ({postId})),
        },
      },
      select: {id: true, type: true},
    });

    await prisma.book.create({
      data: {
        postId: post.id,
        title,
        authors: {
          connect: pickN(users, randomInt(1, 3)).map(u => ({id: u.id})),
        },
        coverUrl: randomBoolean(0.8)
          ? getRandomBookCover()
          : null,
        isbn: randomBoolean(0.8) ? faker.commerce.isbn() : null,
        chaptersIndex: generateChapters(),
        description: generateParagraph(1, 2),
        extra: generateBookExtra(),
      },
    });

    await prisma.postStats.create({data: {postId: post.id}});
    await prisma.postReactions.create({
      data: {
        postId: post.id,
        likeCount: randomInt(0, 250),
        dislikeCount: randomInt(0, 50),
        loveCount: randomInt(0, 180),
      },
    });

    created.push(post);
  }

  return created;
}

async function seedOtherPosts(
  total: number,
  users: CreatedUser[],
  bookPostIds: string[],
  tagPostIds: string[],
): Promise<CreatedPost[]> {
  console.log(`📝 Seeding ${total} other posts...`);
  const types: PostType[] = [
    PostType.NOTE,
    PostType.REVIEW,
    PostType.QUOTE,
    PostType.READLIST,
    PostType.IMAGE,
    PostType.VIDEO,
    PostType.CHAPTER,
  ];
  const created: CreatedPost[] = [];

  for (let i = 0; i < total; i++) {
    const author = faker.helpers.arrayElement(users);
    const type = faker.helpers.arrayElement(types);
    const title = buildPostTitleByType(type);
    const metadata = buildMetadataByType(type, {bookIds: bookPostIds});
    const publishedAt = randomBoolean(0.8) ? faker.date.past({years: 2}) : null;

    let targetPostId: string | null = null;
    if (
      (type === PostType.REVIEW ||
        type === PostType.QUOTE ||
        type === PostType.CHAPTER) &&
      bookPostIds.length > 0
    ) {
      targetPostId = faker.helpers.arrayElement(bookPostIds);
    }

    const post = await prisma.post.create({
      data: {
        userId: author.id,
        type,
        status: randomBoolean(0.9) ? PostStatus.ACTIVE : PostStatus.DRAFT,
        title,
        content: randomBoolean(0.8) ? generateParagraph(1, 4) : null,
        metadata,
        targetPostId: targetPostId ?? undefined,
        publishedAt,
        tags: {
          connect: pickN(tagPostIds, randomInt(0, 4)).map(postId => ({postId})),
        },
      },
      select: {id: true, type: true},
    });

    await prisma.postStats.create({
      data: {postId: post.id, viewCount: randomInt(0, 10_000)},
    });
    await prisma.postReactions.create({
      data: {
        postId: post.id,
        likeCount: randomInt(0, 300),
        dislikeCount: randomInt(0, 60),
        loveCount: randomInt(0, 220),
      },
    });

    created.push(post);
  }

  return created;
}

async function seedComments(
  total: number,
  users: CreatedUser[],
  allRootPostIds: string[],
): Promise<{perRootCount: Map<string, number>}> {
  console.log(`💬 Seeding ${total} comments...`);
  const perRootComments: Map<string, string[]> = new Map();
  const perRootCount: Map<string, number> = new Map();

  for (let i = 0; i < total; i++) {
    const root = faker.helpers.arrayElement(allRootPostIds);
    const author = faker.helpers.arrayElement(users);
    const existing = perRootComments.get(root) ?? [];
    const hasParent = existing.length > 0 && randomBoolean(0.6);
    const parentCommentId = hasParent
      ? faker.helpers.arrayElement(existing)
      : null;
    const depth = parentCommentId ? randomInt(1, 4) : 0;

    const commentPost = await prisma.post.create({
      data: {
        userId: author.id,
        type: PostType.COMMENT,
        status: PostStatus.ACTIVE,
        title: null,
        content: generateParagraph(2, 5),
        metadata: {},
        targetPostId: null,
        publishedAt: faker.date.past({years: 1}),
      },
      select: {id: true},
    });

    await prisma.commentIndex.create({
      data: {
        postId: commentPost.id,
        rootPostId: root,
        parentCommentId: parentCommentId ?? undefined,
        depth,
      },
    });

    existing.push(commentPost.id);
    perRootComments.set(root, existing);
    perRootCount.set(root, (perRootCount.get(root) ?? 0) + 1);
  }

  return {perRootCount};
}

async function updateStatsWithCommentCounts(perRootCount: Map<string, number>) {
  console.log('📊 Updating post stats with comment counts...');
  const updates: Promise<unknown>[] = [];
  perRootCount.forEach((count, postId) => {
    updates.push(
      prisma.postStats.upsert({
        where: {postId},
        create: {postId, commentCount: count},
        update: {commentCount: count},
      }),
    );
  });
  await Promise.all(updates);
}

// ------------------------------
// Main Function
// ------------------------------

async function main() {
  console.time('seed');
  console.log('🌱 Starting database seeding with Faker.js...');
  console.log('📊 Counts:', DEFAULT_COUNTS);

  try {
    await resetDatabase();

    const users = await seedUsers(DEFAULT_COUNTS.users);
    console.log(`✅ Created ${users.length} users`);

    const tagPostIds = await seedTags(DEFAULT_COUNTS.tags, users);
    console.log(`✅ Created ${tagPostIds.length} tags`);

    const books = await seedBooks(DEFAULT_COUNTS.books, users, tagPostIds);
    const bookIds = books.map(b => b.id);
    console.log(`✅ Created ${books.length} books`);

    const others = await seedOtherPosts(
      DEFAULT_COUNTS.otherPosts,
      users,
      bookIds,
      tagPostIds,
    );
    console.log(`✅ Created ${others.length} other posts`);

    const allRootPostIds = [...bookIds, ...others.map(o => o.id)];
    const {perRootCount} = await seedComments(
      DEFAULT_COUNTS.comments,
      users,
      allRootPostIds,
    );
    const totalComments = Array.from(perRootCount.values()).reduce(
      (a, b) => a + b,
      0,
    );
    console.log(`✅ Created ${totalComments} comments`);

    await updateStatsWithCommentCounts(perRootCount);

    const summary = {
      users: users.length,
      tags: tagPostIds.length,
      books: books.length,
      otherPosts: others.length,
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
