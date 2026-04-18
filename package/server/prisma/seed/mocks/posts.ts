import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import type { PrismaClient } from "#/prisma/generated/client.js";
import { PostKind, UnitStatus, UnitType } from "#/prisma/generated/client.js";
import {
  generatePostBody,
  generatePostExtra,
  generateTranslations,
} from "./generators.js";
import type { CreatedPost, CreatedUnit, CreatedUser } from "./types.js";
import {
  chunkedParallel,
  powerLaw,
  randomBoolean,
  randomInt,
} from "./utils.js";

const CHUNK_SIZE = 10;
const BATCH_THRESHOLD = 20;
const BATCH_SIZE = 500;

/**
 * Seed posts for all work units (books, games, media).
 * Per-work counts drawn from a power-law distribution so most works get
 * minimal engagement while a few get extreme engagement.
 */
export async function seedPostsForWorks(
  prisma: PrismaClient,
  works: CreatedUnit[],
  users: CreatedUser[],
  scoreEntries?: Map<string, string>,
): Promise<CreatedPost[]> {
  console.log(
    `[Seed] Seeding posts for ${works.length} works (power-law distribution)...`,
  );
  const allPosts: CreatedPost[] = [];

  await chunkedParallel(works, CHUNK_SIZE, async (work) => {
    const reviewCount = powerLaw(0, 50, 1.8);
    const quoteCount = powerLaw(0, 15, 2.0);
    const remarkCount = powerLaw(0, 10, 2.0);
    const treeCount = powerLaw(0, 120, 1.8);

    const reviews = await seedPostKindForTarget(
      prisma,
      PostKind.REVIEW,
      work.id,
      users,
      reviewCount,
      scoreEntries,
    );
    allPosts.push(...reviews);

    const quotes = await seedPostKindForTarget(
      prisma,
      PostKind.QUOTE,
      work.id,
      users,
      quoteCount,
    );
    allPosts.push(...quotes);

    const remarks = await seedPostKindForTarget(
      prisma,
      PostKind.REMARK,
      work.id,
      users,
      remarkCount,
      scoreEntries,
    );
    allPosts.push(...remarks);

    const treePosts = await seedTreePostsForTarget(
      prisma,
      work.id,
      users,
      treeCount,
    );
    allPosts.push(...treePosts);
  });

  return allPosts;
}

/**
 * Create N posts of a given kind targeting a unit.
 * Uses batch createMany for high-engagement works (> BATCH_THRESHOLD).
 */
async function seedPostKindForTarget(
  prisma: PrismaClient,
  kind: PostKind,
  targetUnitId: string,
  users: CreatedUser[],
  count: number,
  scoreEntries?: Map<string, string>,
): Promise<CreatedPost[]> {
  if (count === 0) return [];
  if (count > BATCH_THRESHOLD) {
    return seedPostKindBatch(
      prisma,
      kind,
      targetUnitId,
      users,
      count,
      scoreEntries,
    );
  }

  const posts: CreatedPost[] = [];
  const needsScore = kind === PostKind.REVIEW || kind === PostKind.REMARK;

  await chunkedParallel(Array.from({ length: count }), CHUNK_SIZE, async () => {
    const author = faker.helpers.arrayElement(users);
    const body = generatePostBody(kind);
    const extra = generatePostExtra(kind);
    const needsTitle = kind === PostKind.REVIEW;
    const translations = needsTitle ? generateTranslations(UnitType.POST) : [];

    let scoreEntryId: string | undefined;
    if (needsScore && scoreEntries) {
      for (const [key, entryId] of scoreEntries) {
        if (key.startsWith(`${author.unitId}:${targetUnitId}:`)) {
          scoreEntryId = entryId;
          break;
        }
      }
    }

    const unit = await prisma.unit.create({
      data: {
        type: UnitType.POST,
        userId: author.unitId,
        status: randomBoolean(0.9) ? UnitStatus.PUBLISHED : UnitStatus.DRAFT,
        defaultLanguage: DEFAULT_LANGUAGE,
        publishedAt: randomBoolean(0.85) ? faker.date.past({ years: 2 }) : null,
        post: {
          create: {
            authorUserId: author.unitId,
            targetUnitId,
            kind,
            body,
            extra: extra ?? undefined,
            depth: 0,
            scoreEntryId: scoreEntryId ?? undefined,
          },
        },
        translations: needsTitle
          ? {
              create: translations.map((t) => ({
                language: t.language,
                title: t.title,
              })),
            }
          : undefined,
        supportLanguages: {
          create: needsTitle
            ? translations.map((t, i) => ({
                language: t.language,
                isPrimary: i === 0,
                sortOrder: i,
              }))
            : { language: DEFAULT_LANGUAGE, isPrimary: true },
        },
      },
      select: { id: true, type: true },
    });

    posts.push({ ...unit, kind, targetUnitId });
  });

  return posts;
}

/**
 * Batch variant for high-engagement works.
 * Generates all rows in memory, then inserts via createMany across tables.
 */
async function seedPostKindBatch(
  prisma: PrismaClient,
  kind: PostKind,
  targetUnitId: string,
  users: CreatedUser[],
  count: number,
  scoreEntries?: Map<string, string>,
): Promise<CreatedPost[]> {
  const needsScore = kind === PostKind.REVIEW || kind === PostKind.REMARK;
  const needsTitle = kind === PostKind.REVIEW;

  interface Row {
    id: string;
    author: CreatedUser;
    body: string;
    extra: ReturnType<typeof generatePostExtra>;
    published: boolean;
    publishedAt: Date | null;
    translations: { language: string; title: string }[];
    scoreEntryId?: string;
  }

  const rows: Row[] = Array.from({ length: count }, () => {
    const author = faker.helpers.arrayElement(users);
    let scoreEntryId: string | undefined;
    if (needsScore && scoreEntries) {
      for (const [key, entryId] of scoreEntries) {
        if (key.startsWith(`${author.unitId}:${targetUnitId}:`)) {
          scoreEntryId = entryId;
          break;
        }
      }
    }
    const published = randomBoolean(0.9);
    return {
      id: randomUUID(),
      author,
      body: generatePostBody(kind),
      extra: generatePostExtra(kind),
      published,
      publishedAt: randomBoolean(0.85) ? faker.date.past({ years: 2 }) : null,
      translations: needsTitle
        ? generateTranslations(UnitType.POST).map((t) => ({
            language: t.language,
            title: t.title,
          }))
        : [],
      scoreEntryId,
    };
  });

  // Unit
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    await prisma.unit.createMany({
      data: chunk.map((r) => ({
        id: r.id,
        type: UnitType.POST,
        userId: r.author.unitId,
        status: r.published ? UnitStatus.PUBLISHED : UnitStatus.DRAFT,
        defaultLanguage: DEFAULT_LANGUAGE,
        publishedAt: r.publishedAt,
      })),
    });
  }

  // Post
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    await prisma.post.createMany({
      data: chunk.map((r) => ({
        unitId: r.id,
        authorUserId: r.author.unitId,
        targetUnitId,
        kind,
        body: r.body,
        extra: r.extra ?? undefined,
        depth: 0,
        scoreEntryId: r.scoreEntryId ?? null,
      })),
    });
  }

  // Translations (reviews only)
  if (needsTitle) {
    const allTranslations = rows.flatMap((r) =>
      r.translations.map((t) => ({
        unitId: r.id,
        language: t.language,
        title: t.title,
      })),
    );
    for (let i = 0; i < allTranslations.length; i += BATCH_SIZE) {
      await prisma.unitTranslation.createMany({
        data: allTranslations.slice(i, i + BATCH_SIZE),
      });
    }
  }

  // Support languages
  const allSupport = rows.flatMap((r) =>
    needsTitle && r.translations.length > 0
      ? r.translations.map((t, i) => ({
          unitId: r.id,
          language: t.language,
          isPrimary: i === 0,
          sortOrder: i,
        }))
      : [
          {
            unitId: r.id,
            language: DEFAULT_LANGUAGE,
            isPrimary: true,
            sortOrder: 0,
          },
        ],
  );
  for (let i = 0; i < allSupport.length; i += BATCH_SIZE) {
    await prisma.unitSupportLanguage.createMany({
      data: allSupport.slice(i, i + BATCH_SIZE),
    });
  }

  return rows.map((r) => ({
    id: r.id,
    type: UnitType.POST,
    kind,
    targetUnitId,
  }));
}

/**
 * Create tree posts (threaded) for a target unit.
 * Two-pass: root posts first, then replies.
 */
async function seedTreePostsForTarget(
  prisma: PrismaClient,
  targetUnitId: string,
  users: CreatedUser[],
  total: number,
): Promise<CreatedPost[]> {
  if (total === 0) return [];

  const rootCount = Math.max(1, Math.floor(total * 0.4));
  const replyCount = total - rootCount;
  const posts: CreatedPost[] = [];

  // Pass 1: Root posts
  const rootIds: string[] = [];

  await chunkedParallel(
    Array.from({ length: rootCount }),
    CHUNK_SIZE,
    async (_, index) => {
      const author = faker.helpers.arrayElement(users);
      const id = randomUUID();
      const sortPath = String(index).padStart(5, "0");

      const unit = await prisma.unit.create({
        data: {
          id,
          type: UnitType.POST,
          userId: author.unitId,
          status: UnitStatus.PUBLISHED,
          defaultLanguage: DEFAULT_LANGUAGE,
          publishedAt: faker.date.past({ years: 1 }),
          post: {
            create: {
              authorUserId: author.unitId,
              targetUnitId,
              rootPostUnitId: id,
              kind: PostKind.POST,
              body: generatePostBody(PostKind.POST),
              depth: 0,
              sortPath,
            },
          },
          supportLanguages: {
            create: { language: DEFAULT_LANGUAGE, isPrimary: true },
          },
        },
        select: { id: true, type: true },
      });

      rootIds.push(unit.id);
      posts.push({
        ...unit,
        kind: PostKind.POST,
        targetUnitId,
      });
    },
  );

  if (rootIds.length === 0 || replyCount === 0) return posts;

  // Pass 2: Replies
  const replyParents: { id: string; sortPath: string; depth: number }[] =
    rootIds.map((id, i) => ({
      id,
      sortPath: String(i).padStart(5, "0"),
      depth: 0,
    }));

  await chunkedParallel(
    Array.from({ length: replyCount }),
    CHUNK_SIZE,
    async () => {
      const author = faker.helpers.arrayElement(users);
      const parent = faker.helpers.arrayElement(replyParents);
      const depth = Math.min(parent.depth + 1, 4);
      const replyId = randomUUID();
      const sortPath = `${parent.sortPath}/${String(randomInt(0, 99999)).padStart(5, "0")}`;
      const rootId = parent.sortPath.includes("/") ? rootIds[0] : parent.id;

      const unit = await prisma.unit.create({
        data: {
          id: replyId,
          type: UnitType.POST,
          userId: author.unitId,
          status: UnitStatus.PUBLISHED,
          defaultLanguage: DEFAULT_LANGUAGE,
          publishedAt: faker.date.past({ years: 1 }),
          post: {
            create: {
              authorUserId: author.unitId,
              targetUnitId,
              rootPostUnitId: rootId,
              parentPostUnitId: parent.id,
              kind: PostKind.POST,
              body: generatePostBody(PostKind.POST),
              depth,
              sortPath,
            },
          },
          supportLanguages: {
            create: { language: DEFAULT_LANGUAGE, isPrimary: true },
          },
        },
        select: { id: true, type: true },
      });

      replyParents.push({ id: replyId, sortPath, depth });
      posts.push({
        ...unit,
        kind: PostKind.POST,
        targetUnitId,
      });
    },
  );

  // Update reply counts on root posts
  const replyCounts = new Map<string, { total: number; direct: number }>();
  for (const parent of replyParents) {
    if (parent.depth === 0) continue;
    const rootSortPath = parent.sortPath.split("/")[0] ?? "0";
    const rootIndex = Number.parseInt(rootSortPath, 10);
    const rootId = rootIds[rootIndex] ?? rootIds[0] ?? parent.id;
    const counts = replyCounts.get(rootId) ?? { total: 0, direct: 0 };
    counts.total++;
    if (parent.depth === 1) counts.direct++;
    replyCounts.set(rootId, counts);
  }

  await chunkedParallel(
    Array.from(replyCounts.entries()),
    CHUNK_SIZE,
    async ([rootId, counts]) => {
      await prisma.post.update({
        where: { unitId: rootId },
        data: {
          replyCount: counts.total,
          directReplyCount: counts.direct,
          lastReplyAt: new Date(),
        },
      });
    },
  );

  return posts;
}

// Deterministic uuidv7-shaped ids (version nibble 7) so reseeds are stable.
const WIKI_GROUP_ID = "01910000-0000-7000-8000-000000000001";
const WIKI_POST_ZH_ID = "01910000-0000-7000-8000-000000001001";
const WIKI_POST_EN_ID = "01910000-0000-7000-8000-000000001002";
const WIKI_POST_JA_ID = "01910000-0000-7000-8000-000000001003";

const WIKI_POSTS: {
  id: string;
  language: string;
  title: string;
  body: string;
}[] = [
  {
    id: WIKI_POST_ZH_ID,
    language: "zh-hant",
    title: "Rezics 是甚麼",
    // MOCK: seeded wiki body for the Traditional Chinese variant.
    body: "Rezics 是一個讓不同語言版本的維基條目並列共存的平台。",
  },
  {
    id: WIKI_POST_EN_ID,
    language: "en",
    title: "What is Rezics",
    // MOCK: seeded wiki body for the English variant.
    body: "Rezics keeps each language's wiki page as its own first-class post and links them as parallel translations.",
  },
  {
    id: WIKI_POST_JA_ID,
    language: "ja",
    title: "Rezics とは",
    // MOCK: seeded wiki body for the Japanese variant.
    body: "Rezics は、各言語のウィキ記事を独立した投稿として扱い、並列翻訳としてつなげるプラットフォームです。",
  },
];

/**
 * Seed at least one parallel-translation wiki POST group (zh-hant / en / ja).
 * Idempotent: skipped if the well-known group id already exists.
 */
export async function seedWikiTranslationGroups(
  prisma: PrismaClient,
  users: CreatedUser[],
): Promise<{ groupId: string; postIds: string[] } | null> {
  if (users.length === 0) return null;

  const existing = await prisma.translationGroup.findUnique({
    where: { id: WIKI_GROUP_ID },
    select: { id: true },
  });
  if (existing) {
    return { groupId: WIKI_GROUP_ID, postIds: WIKI_POSTS.map((p) => p.id) };
  }

  const author = users[0]!;

  await prisma.$transaction(async (tx) => {
    await tx.translationGroup.create({
      data: {
        id: WIKI_GROUP_ID,
        supportedLanguages: WIKI_POSTS.map((p) => p.language),
      },
    });

    for (const p of WIKI_POSTS) {
      await tx.unit.create({
        data: {
          id: p.id,
          type: UnitType.POST,
          userId: author.unitId,
          status: UnitStatus.PUBLISHED,
          defaultLanguage: p.language,
          translationGroupId: WIKI_GROUP_ID,
          publishedAt: new Date(),
          post: {
            create: {
              authorUserId: author.unitId,
              kind: PostKind.POST,
              body: p.body,
              depth: 0,
            },
          },
          translations: {
            create: {
              language: p.language,
              title: p.title,
            },
          },
          supportLanguages: {
            create: {
              language: p.language,
              isPrimary: true,
              sortOrder: 0,
            },
          },
        },
      });
    }
  });

  return { groupId: WIKI_GROUP_ID, postIds: WIKI_POSTS.map((p) => p.id) };
}
