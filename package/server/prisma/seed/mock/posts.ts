import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import type { PrismaClient } from "#/prisma/generated/client.js";
import { PostKind, UnitStatus, UnitType } from "#/prisma/generated/client.js";
import {
  generatePostBody,
  generatePostExtra,
  generateTranslation,
} from "./generators.js";
import type { CreatedPost, CreatedUnit, CreatedUser } from "./types.js";
import { chunkedParallel, randomBoolean, randomInt } from "./utils.js";

const CHUNK_SIZE = 10;

interface PostCounts {
  reviews: number;
  comments: number;
  quotes: number;
  remarks: number;
}

/**
 * Seed posts for all work units (books, games, media).
 * Creates reviews, quotes, remarks, and threaded comments.
 * scoreEntries maps `${userId}:${unitId}:${realm}` -> scoreEntryId for linking reviews/remarks.
 */
export async function seedPostsForWorks(
  prisma: PrismaClient,
  works: CreatedUnit[],
  users: CreatedUser[],
  counts: PostCounts,
  scoreEntries?: Map<string, string>,
): Promise<CreatedPost[]> {
  console.log(
    `[Seed] Seeding posts for ${works.length} works (${counts.reviews} reviews, ${counts.quotes} quotes, ${counts.remarks} remarks, ${counts.comments} comments per work)...`,
  );
  const allPosts: CreatedPost[] = [];

  // Process works in chunks
  await chunkedParallel(works, CHUNK_SIZE, async (work) => {
    // Reviews
    const reviews = await seedPostKindForTarget(
      prisma,
      PostKind.REVIEW,
      work.id,
      users,
      counts.reviews,
      scoreEntries,
    );
    allPosts.push(...reviews);

    // Quotes
    const quotes = await seedPostKindForTarget(
      prisma,
      PostKind.QUOTE,
      work.id,
      users,
      counts.quotes,
    );
    allPosts.push(...quotes);

    // Remarks
    const remarks = await seedPostKindForTarget(
      prisma,
      PostKind.REMARK,
      work.id,
      users,
      counts.remarks,
      scoreEntries,
    );
    allPosts.push(...remarks);

    // Threaded comments
    const comments = await seedCommentsForTarget(
      prisma,
      work.id,
      users,
      counts.comments,
    );
    allPosts.push(...comments);
  });

  return allPosts;
}

/**
 * Create N posts of a given kind targeting a unit.
 * For REVIEW and REMARK kinds, links to a ScoreEntry if available in scoreEntries map.
 */
async function seedPostKindForTarget(
  prisma: PrismaClient,
  kind: PostKind,
  targetUnitId: string,
  users: CreatedUser[],
  count: number,
  scoreEntries?: Map<string, string>,
): Promise<CreatedPost[]> {
  const posts: CreatedPost[] = [];
  const needsScore = kind === PostKind.REVIEW || kind === PostKind.REMARK;

  await chunkedParallel(Array.from({ length: count }), CHUNK_SIZE, async () => {
    const author = faker.helpers.arrayElement(users);
    const body = generatePostBody(kind);
    const extra = generatePostExtra(kind);
    const needsTitle = kind === PostKind.REVIEW;

    // Find a matching scoreEntryId for this author+target
    let scoreEntryId: string | undefined;
    if (needsScore && scoreEntries) {
      // Try all realms — keys are `${userId}:${unitId}:${realm}`
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
        defaultLanguage: "en",
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
              create: {
                language: "en",
                title: generateTranslation(UnitType.POST).title,
              },
            }
          : undefined,
        supportLanguages: {
          create: { language: "en", isPrimary: true },
        },
      },
      select: { id: true, type: true },
    });

    posts.push({ ...unit, kind, targetUnitId });
  });

  return posts;
}

/**
 * Create threaded comments for a target unit.
 * Two-pass: root comments first, then replies.
 */
async function seedCommentsForTarget(
  prisma: PrismaClient,
  targetUnitId: string,
  users: CreatedUser[],
  total: number,
): Promise<CreatedPost[]> {
  const rootCount = Math.max(1, Math.floor(total * 0.4));
  const replyCount = total - rootCount;
  const posts: CreatedPost[] = [];

  // Pass 1: Root comments
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
          defaultLanguage: "en",
          publishedAt: faker.date.past({ years: 1 }),
          post: {
            create: {
              authorUserId: author.unitId,
              targetUnitId,
              rootPostUnitId: id,
              kind: PostKind.COMMENT,
              body: generatePostBody(PostKind.COMMENT),
              depth: 0,
              sortPath,
            },
          },
          supportLanguages: {
            create: { language: "en", isPrimary: true },
          },
        },
        select: { id: true, type: true },
      });

      rootIds.push(unit.id);
      posts.push({
        ...unit,
        kind: PostKind.COMMENT,
        targetUnitId,
      });
    },
  );

  if (rootIds.length === 0 || replyCount === 0) return posts;

  // Pass 2: Reply comments
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
      const rootId = parent.sortPath.includes("/")
        ? rootIds[0]
        : parent.id;

      const unit = await prisma.unit.create({
        data: {
          id: replyId,
          type: UnitType.POST,
          userId: author.unitId,
          status: UnitStatus.PUBLISHED,
          defaultLanguage: "en",
          publishedAt: faker.date.past({ years: 1 }),
          post: {
            create: {
              authorUserId: author.unitId,
              targetUnitId,
              rootPostUnitId: rootId,
              parentPostUnitId: parent.id,
              kind: PostKind.COMMENT,
              body: generatePostBody(PostKind.COMMENT),
              depth,
              sortPath,
            },
          },
          supportLanguages: {
            create: { language: "en", isPrimary: true },
          },
        },
        select: { id: true, type: true },
      });

      // Add this reply as a potential parent for future replies
      replyParents.push({ id: replyId, sortPath, depth });
      posts.push({
        ...unit,
        kind: PostKind.COMMENT,
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
