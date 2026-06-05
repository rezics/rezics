import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PUBLICATION_LICENSE_SLUG,
  markdownContentDoc,
} from "@rezics/contract";
import { eq } from "drizzle-orm";
import {
  ContentTranslation,
  Post,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
} from "../schema";
import {
  generatePostBody,
  generatePostContent,
  generatePostExtra,
  generateTranslations,
} from "./generators.js";
import {
  ContentTranslationStatus,
  PostKind,
  UnitStatus,
  UnitType,
} from "./storage-values.js";
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
      ctx,
      PostKind.REVIEW,
      work.id,
      users,
      reviewCount,
      scoreEntries,
    );
    allPosts.push(...reviews);

    const excerpts = await seedPostKindForTarget(
      ctx,
      PostKind.EXCERPT,
      work.id,
      users,
      excerptCount,
    );
    allPosts.push(...excerpts);

    const remarks = await seedPostKindForTarget(
      ctx,
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
  ctx: SeedCtx,
  kind: PostKind,
  targetUnitId: string,
  users: CreatedUser[],
  count: number,
  scoreEntries?: Map<string, string>,
): Promise<CreatedPost[]> {
  if (count === 0) return [];
  if (count > BATCH_THRESHOLD) {
    return seedPostKindBatch(
      ctx,
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
    const published = randomBoolean(0.9);

    let scoreEntryId: string | undefined;
    if (needsScore && scoreEntries) {
      for (const [key, entryId] of scoreEntries) {
        if (key.startsWith(`${author.userId}:${targetUnitId}:`)) {
          scoreEntryId = entryId;
          break;
        }
      }
    }

    const [unit] = await ctx.db
      .insert(Unit)
      .values({
        id: randomUUID(),
        type: UnitType.POST,
        userId: author.userId,
        slugScope: author.userId,
        targetUnitId,
        status: published ? UnitStatus.PUBLISHED : UnitStatus.DRAFT,
        licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
        defaultLanguage: DEFAULT_LANGUAGE,
        publishedAt: randomBoolean(0.85) ? faker.date.past({ years: 2 }) : null,
      })
      .returning({ id: Unit.id, type: Unit.type });
    if (!unit) throw new Error("Failed to create seeded post unit.");

    await ctx.db.insert(Post).values({
      unitId: unit.id,
      authorUserId: author.userId,
      kind,
      extra: extra ?? undefined,
      scoreEntryId: scoreEntryId ?? undefined,
    });
    await ctx.db.insert(ContentTranslation).values({
      unitId: unit.id,
      language: DEFAULT_LANGUAGE,
      content: markdownContentDoc(body) as never,
      status: published ? "PUBLISHED" : "DRAFT",
      authorUserId: author.userId,
      provenance: { importedFrom: "factory-post-seed" },
    });
    if (needsTitle) {
      await ctx.db.insert(UnitTranslation).values(
        translations.map((t) => ({
          unitId: unit.id,
          language: t.language,
          title: t.title,
        })),
      );
    }
    await ctx.db.insert(UnitSupportLanguage).values(
      needsTitle
        ? translations.map((t, i) => ({
            unitId: unit.id,
            language: t.language,
            isPrimary: i === 0,
            sortOrder: i,
          }))
        : { unitId: unit.id, language: DEFAULT_LANGUAGE, isPrimary: true },
    );

    posts.push({ ...unit, kind, targetUnitId });
  });

  return posts;
}

async function seedPostKindBatch(
  ctx: SeedCtx,
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
    await ctx.db.insert(Unit).values(
      chunk.map((r) => ({
        id: r.id,
        type: UnitType.POST,
        userId: r.author.userId,
        slugScope: r.author.userId,
        targetUnitId,
        status: r.published ? UnitStatus.PUBLISHED : UnitStatus.DRAFT,
        licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
        defaultLanguage: DEFAULT_LANGUAGE,
        publishedAt: r.publishedAt,
      })),
    );
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    await ctx.db.insert(Post).values(
      chunk.map((r) => ({
        unitId: r.id,
        authorUserId: r.author.userId,
        kind,
        extra: r.extra ?? undefined,
        scoreEntryId: r.scoreEntryId ?? null,
      })),
    );
  }

  const allContentTranslations = rows.map((r) => ({
    unitId: r.id,
    language: DEFAULT_LANGUAGE,
    content: markdownContentDoc(r.body) as never,
    status: r.published
      ? ContentTranslationStatus.PUBLISHED
      : ContentTranslationStatus.DRAFT,
    authorUserId: r.author.userId,
    provenance: { importedFrom: "factory-post-seed" },
  }));
  for (let i = 0; i < allContentTranslations.length; i += BATCH_SIZE) {
    await ctx.db
      .insert(ContentTranslation)
      .values(allContentTranslations.slice(i, i + BATCH_SIZE));
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
      await ctx.db
        .insert(UnitTranslation)
        .values(allTranslations.slice(i, i + BATCH_SIZE));
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
    await ctx.db
      .insert(UnitSupportLanguage)
      .values(allSupport.slice(i, i + BATCH_SIZE));
  }

  return rows.map((r) => ({
    id: r.id,
    type: UnitType.POST,
    kind,
    targetUnitId,
  }));
}

async function seedTreePostsForTarget(
  ctx: SeedCtx,
  treeShape: TreeShapePlan,
  targetUnitId: string,
  users: CreatedUser[],
  total: number,
): Promise<CreatedPost[]> {
  if (total === 0) return [];

  void treeShape;
  const posts: CreatedPost[] = [];
  const rootIds = Array.from({ length: total }, () => randomUUID());

  await chunkedParallel(rootIds, CHUNK_SIZE, async (rootId) => {
    const author = faker.helpers.arrayElement(users);

    const [unit] = await ctx.db
      .insert(Unit)
      .values({
        id: rootId,
        type: UnitType.POST,
        userId: author.userId,
        slugScope: author.userId,
        targetUnitId,
        status: UnitStatus.PUBLISHED,
        licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
        defaultLanguage: DEFAULT_LANGUAGE,
        publishedAt: faker.date.past({ years: 1 }),
      })
      .returning({ id: Unit.id, type: Unit.type });
    if (!unit) throw new Error("Failed to create seeded tree post unit.");
    await ctx.db.insert(Post).values({
      unitId: unit.id,
      authorUserId: author.userId,
      kind: PostKind.POST,
    });
    await ctx.db.insert(UnitSupportLanguage).values({
      unitId: unit.id,
      language: DEFAULT_LANGUAGE,
      isPrimary: true,
    });
    await ctx.db.insert(ContentTranslation).values({
      unitId: unit.id,
      language: DEFAULT_LANGUAGE,
      content: generatePostContent(PostKind.POST) as never,
      status: "PUBLISHED",
      authorUserId: author.userId,
      provenance: { importedFrom: "factory-post-tree-seed" },
    });

    posts.push({
      ...unit,
      kind: PostKind.POST,
      targetUnitId,
    });
  });

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
      "Rezics keeps language-specific wiki bodies as ContentTranslation rows on one shared wiki post.",
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
  ctx: SeedCtx,
  users: CreatedUser[],
): Promise<{ unitId: string } | null> {
  if (users.length === 0) return null;

  const [existing] = await ctx.db
    .select({ id: Unit.id })
    .from(Unit)
    .where(eq(Unit.id, WIKI_POST_EN_ID))
    .limit(1);
  if (existing) {
    return { unitId: WIKI_POST_EN_ID };
  }

  const author = users[0]!;

  await ctx.db.transaction(async (tx) => {
    const primary = WIKI_POSTS[1] ?? WIKI_POSTS[0]!;
    await tx.insert(Unit).values({
      id: primary.id,
      type: UnitType.POST,
      userId: author.userId,
      slugScope: author.userId,
      status: UnitStatus.PUBLISHED,
      licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
      defaultLanguage: primary.language,
      publishedAt: new Date(),
    });
    await tx.insert(Post).values({
      unitId: primary.id,
      authorUserId: author.userId,
      kind: PostKind.POST,
    });
    await tx.insert(UnitTranslation).values(
      WIKI_POSTS.map((p) => ({
        unitId: primary.id,
        language: p.language,
        title: p.title,
      })),
    );
    await tx.insert(UnitSupportLanguage).values(
      WIKI_POSTS.map((p, index) => ({
        unitId: primary.id,
        language: p.language,
        isPrimary: p.language === primary.language,
        sortOrder: index,
      })),
    );
    await tx.insert(ContentTranslation).values(
      WIKI_POSTS.map((p) => ({
        unitId: primary.id,
        language: p.language,
        content: markdownContentDoc(p.contentSource) as never,
        status: "PUBLISHED",
        authorUserId: author.userId,
        provenance: { importedFrom: "factory-wiki-seed" },
      })),
    );
  });

  return { unitId: WIKI_POST_EN_ID };
}
