import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PUBLICATION_LICENSE_SLUG,
  markdownContentDoc,
} from "@rezics/contract";
import type { PrismaClient } from "../generated/client.js";
import { PostKind, UnitStatus, UnitType } from "../generated/client.js";
import {
  generatePostBody,
  generatePostContent,
  generatePostExtra,
  generateTranslations,
} from "./generators.js";
import type { SeedCtx } from "./strategy.js";
import type {
  CreatedPost,
  CreatedUnit,
  CreatedUser,
  PostsPerWorkPlan,
  TreeShapePlan,
} from "./types.js";
import { chunkedParallel, randomBoolean } from "./utils.js";

const CHUNK_SIZE = 10;
const BATCH_THRESHOLD = 20;
const BATCH_SIZE = 500;

/**
 * Seed posts for all work units (books, games, media).
 * Per-work counts are drawn from the active CountProvider, so under realistic
 * mode they follow a power-law distribution and under fixed mode they hit the
 * configured target verbatim.
 */
export async function seedPostsForWorks(
  ctx: SeedCtx,
  postsPerWork: PostsPerWorkPlan,
  treeShape: TreeShapePlan,
  works: CreatedUnit[],
  users: CreatedUser[],
  scoreEntries?: Map<string, string>,
): Promise<CreatedPost[]> {
  console.log(`[Seed] Seeding posts for ${works.length} works...`);
  const allPosts: CreatedPost[] = [];

  await chunkedParallel(works, CHUNK_SIZE, async (work) => {
    const reviewCount = ctx.draw(postsPerWork.review);
    const excerptCount = ctx.draw(postsPerWork.excerpt);
    const remarkCount = ctx.draw(postsPerWork.remark);
    const treeCount = ctx.draw(postsPerWork.tree);

    const reviews = await seedPostKindForTarget(
      ctx.prisma,
      PostKind.REVIEW,
      work.id,
      users,
      reviewCount,
      scoreEntries,
    );
    allPosts.push(...reviews);

    const excerpts = await seedPostKindForTarget(
      ctx.prisma,
      PostKind.EXCERPT,
      work.id,
      users,
      excerptCount,
    );
    allPosts.push(...excerpts);

    const remarks = await seedPostKindForTarget(
      ctx.prisma,
      PostKind.REMARK,
      work.id,
      users,
      remarkCount,
      scoreEntries,
    );
    allPosts.push(...remarks);

    const treePosts = await seedTreePostsForTarget(
      ctx,
      treeShape,
      work.id,
      users,
      treeCount,
    );
    allPosts.push(...treePosts);
  });

  for (const post of allPosts) {
    await ctx.sync.post(post.id);
  }

  return allPosts;
}

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
        if (key.startsWith(`${author.userId}:${targetUnitId}:`)) {
          scoreEntryId = entryId;
          break;
        }
      }
    }

    const unit = await prisma.unit.create({
      data: {
        type: UnitType.POST,
        userId: author.userId,
        slugScope: author.userId,
        status: randomBoolean(0.9) ? UnitStatus.PUBLISHED : UnitStatus.DRAFT,
        licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
        defaultLanguage: DEFAULT_LANGUAGE,
        publishedAt: randomBoolean(0.85) ? faker.date.past({ years: 2 }) : null,
        post: {
          create: {
            authorUserId: author.userId,
            targetUnitId,
            kind,
            content: markdownContentDoc(body) as never,
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
        if (key.startsWith(`${author.userId}:${targetUnitId}:`)) {
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

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    await prisma.unit.createMany({
      data: chunk.map((r) => ({
        id: r.id,
        type: UnitType.POST,
        userId: r.author.userId,
        slugScope: r.author.userId,
        status: r.published ? UnitStatus.PUBLISHED : UnitStatus.DRAFT,
        licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
        defaultLanguage: DEFAULT_LANGUAGE,
        publishedAt: r.publishedAt,
      })),
    });
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    await prisma.post.createMany({
      data: chunk.map((r) => ({
        unitId: r.id,
        authorUserId: r.author.userId,
        targetUnitId,
        kind,
        content: markdownContentDoc(r.body) as never,
        extra: r.extra ?? undefined,
        depth: 0,
        scoreEntryId: r.scoreEntryId ?? null,
      })),
    });
  }

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
 * Tree shape is drawn from the plan via ctx.draw on every CountSpec slot:
 *   roots:     how many root posts to create (clamped to total)
 *   depth:     maximum depth a reply may reach
 *   branching: per-parent direct-child target when allocating replies
 *
 * Under fixed mode every draw resolves to the spec's `target`, producing a
 * deterministic tree. Under realistic mode the same call sites recover the
 * pre-change "mostly shallow, occasionally deep" distribution.
 */
async function seedTreePostsForTarget(
  ctx: SeedCtx,
  treeShape: TreeShapePlan,
  targetUnitId: string,
  users: CreatedUser[],
  total: number,
): Promise<CreatedPost[]> {
  if (total === 0) return [];

  const drawnRoots = ctx.draw(treeShape.roots);
  const rootCount = Math.max(1, Math.min(total, drawnRoots));
  const replyCount = total - rootCount;
  const maxDepth = ctx.draw(treeShape.depth);
  const posts: CreatedPost[] = [];

  // Pass 1: Root posts. The planned `path` strings are zero-padded numeric
  // labels (valid ltree tokens) written via raw SQL after the typed create,
  // because `Post.path` is an Unsupported("ltree") column.
  const rootPlans = Array.from({ length: rootCount }, (_, index) => ({
    id: randomUUID(),
    path: String(index + 1).padStart(4, "0"),
  }));
  const rootIds = rootPlans.map((plan) => plan.id);

  await chunkedParallel(rootPlans, CHUNK_SIZE, async (rootPlan) => {
    const author = faker.helpers.arrayElement(users);

    const unit = await ctx.prisma.unit.create({
      data: {
        id: rootPlan.id,
        type: UnitType.POST,
        userId: author.userId,
        slugScope: author.userId,
        status: UnitStatus.PUBLISHED,
        licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
        defaultLanguage: DEFAULT_LANGUAGE,
        publishedAt: faker.date.past({ years: 1 }),
        post: {
          create: {
            authorUserId: author.userId,
            targetUnitId,
            rootPostUnitId: rootPlan.id,
            kind: PostKind.POST,
            content: generatePostContent(PostKind.POST) as never,
            depth: 0,
          },
        },
        supportLanguages: {
          create: { language: DEFAULT_LANGUAGE, isPrimary: true },
        },
      },
      select: { id: true, type: true },
    });

    await ctx.prisma
      .$executeRaw`UPDATE "Post" SET "path" = ${rootPlan.path}::ltree WHERE "unitId" = ${rootPlan.id}::uuid`;

    posts.push({
      ...unit,
      kind: PostKind.POST,
      targetUnitId,
    });
  });

  if (rootIds.length === 0 || replyCount === 0) return posts;

  interface ParentSlot {
    id: string;
    path: string;
    depth: number;
    rootId: string;
    childCount: number;
  }

  const replyParents: ParentSlot[] = rootIds.map((id, i) => ({
    id,
    path: rootPlans[i]!.path,
    depth: 0,
    rootId: id,
    childCount: 0,
  }));

  const eligibleParents = (): ParentSlot[] =>
    replyParents.filter((p) => p.depth < maxDepth);

  const pickParent = (): ParentSlot | undefined => {
    const candidates = eligibleParents();
    if (candidates.length === 0) return undefined;
    // Prefer parents that haven't yet reached their drawn branching cap so
    // that fixed-mode trees produce the exact configured shape, while still
    // accepting any eligible parent as a fallback.
    const underBranching = candidates.filter((p) => {
      const cap = ctx.draw(treeShape.branching);
      return p.childCount < cap;
    });
    const pool = underBranching.length > 0 ? underBranching : candidates;
    return faker.helpers.arrayElement(pool);
  };

  let createdReplies = 0;
  while (createdReplies < replyCount) {
    const parent = pickParent();
    if (!parent) break;

    const author = faker.helpers.arrayElement(users);
    const replyId = randomUUID();
    const path = `${parent.path}.${String(parent.childCount + 1).padStart(
      4,
      "0",
    )}`;

    const unit = await ctx.prisma.unit.create({
      data: {
        id: replyId,
        type: UnitType.POST,
        userId: author.userId,
        slugScope: author.userId,
        status: UnitStatus.PUBLISHED,
        licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
        defaultLanguage: DEFAULT_LANGUAGE,
        publishedAt: faker.date.past({ years: 1 }),
        post: {
          create: {
            authorUserId: author.userId,
            targetUnitId,
            rootPostUnitId: parent.rootId,
            parentPostUnitId: parent.id,
            kind: PostKind.POST,
            content: generatePostContent(PostKind.POST) as never,
            depth: parent.depth + 1,
          },
        },
        supportLanguages: {
          create: { language: DEFAULT_LANGUAGE, isPrimary: true },
        },
      },
      select: { id: true, type: true },
    });

    await ctx.prisma
      .$executeRaw`UPDATE "Post" SET "path" = ${path}::ltree WHERE "unitId" = ${replyId}::uuid`;

    parent.childCount++;
    replyParents.push({
      id: replyId,
      path,
      depth: parent.depth + 1,
      rootId: parent.rootId,
      childCount: 0,
    });
    posts.push({
      ...unit,
      kind: PostKind.POST,
      targetUnitId,
    });
    createdReplies++;
  }

  // Update reply counts on root posts
  const replyCounts = new Map<string, { total: number; direct: number }>();
  for (const node of replyParents) {
    if (node.depth === 0) continue;
    const counts = replyCounts.get(node.rootId) ?? { total: 0, direct: 0 };
    counts.total++;
    if (node.depth === 1) counts.direct++;
    replyCounts.set(node.rootId, counts);
  }

  await chunkedParallel(
    Array.from(replyCounts.entries()),
    CHUNK_SIZE,
    async ([rootId, counts]) => {
      await ctx.prisma.post.update({
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
const WIKI_POST_ZH_ID = "01910000-0000-7000-8000-000000001001";
const WIKI_POST_EN_ID = "01910000-0000-7000-8000-000000001002";
const WIKI_POST_JA_ID = "01910000-0000-7000-8000-000000001003";

const WIKI_POSTS: {
  id: string;
  language: string;
  title: string;
  contentSource: string;
}[] = [
  {
    id: WIKI_POST_ZH_ID,
    language: "zh-hant",
    title: "Rezics 是甚麼",
    // MOCK: seeded wiki content for the Traditional Chinese variant.
    contentSource: "Rezics 是一個讓不同語言版本的維基條目並列共存的平台。",
  },
  {
    id: WIKI_POST_EN_ID,
    language: "en",
    title: "What is Rezics",
    // MOCK: seeded wiki content for the English variant.
    contentSource:
      "Rezics keeps each language's wiki page as its own first-class post and links them as parallel translations.",
  },
  {
    id: WIKI_POST_JA_ID,
    language: "ja",
    title: "Rezics とは",
    // MOCK: seeded wiki content for the Japanese variant.
    contentSource:
      "Rezics は、各言語のウィキ記事を独立した投稿として扱い、並列翻訳としてつなげるプラットフォームです。",
  },
];

export async function seedWikiContentTranslations(
  prisma: PrismaClient,
  users: CreatedUser[],
): Promise<{ unitId: string } | null> {
  if (users.length === 0) return null;

  const existing = await prisma.unit.findUnique({
    where: { id: WIKI_POST_EN_ID },
    select: { id: true },
  });
  if (existing) {
    return { unitId: WIKI_POST_EN_ID };
  }

  const author = users[0]!;

  await prisma.$transaction(async (tx) => {
    const primary = WIKI_POSTS[1] ?? WIKI_POSTS[0]!;
    await tx.unit.create({
      data: {
        id: primary.id,
        type: UnitType.POST,
        userId: author.userId,
        slugScope: author.userId,
        status: UnitStatus.PUBLISHED,
        licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
        defaultLanguage: primary.language,
        publishedAt: new Date(),
        post: {
          create: {
            authorUserId: author.userId,
            kind: PostKind.POST,
            content: markdownContentDoc(primary.contentSource) as never,
            depth: 0,
          },
        },
        translations: {
          create: WIKI_POSTS.map((p) => ({
            language: p.language,
            title: p.title,
          })),
        },
        supportLanguages: {
          create: WIKI_POSTS.map((p, index) => ({
            language: p.language,
            isPrimary: p.language === primary.language,
            sortOrder: index,
          })),
        },
        contentTranslations: {
          create: WIKI_POSTS.map((p) => ({
            language: p.language,
            content: markdownContentDoc(p.contentSource) as never,
            status: "PUBLISHED",
            authorUserId: author.userId,
            provenance: { importedFrom: "factory-wiki-seed" },
          })),
        },
      },
    });
  });

  return { unitId: WIKI_POST_EN_ID };
}
