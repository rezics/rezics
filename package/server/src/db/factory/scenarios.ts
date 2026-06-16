import { randomUUID } from "node:crypto";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PUBLICATION_LICENSE_SLUG,
  LANGUAGES,
  markdownContentDoc,
  withCoverUrl,
  type ZoneBoundary,
  type ZoneNav,
  type ZonePage as ZonePageConfig,
  type ZoneTheme,
} from "@rezics/contract";
import { and, asc, eq, inArray } from "drizzle-orm";
import { generateBetween, rebalance } from "../../shelf/fractional-index";
import {
  Book,
  Comment,
  ContentStructure,
  ContentTranslation,
  CreditAttribution,
  Entity,
  HistoryOutbox,
  Post,
  Realm,
  RealmMember,
  Shelf,
  ShelfItem,
  SubjectAttribution,
  Unit,
  UnitExternalLink,
  UnitHistoryClock,
  UnitRealm,
  UnitSupportLanguage,
  UnitTag,
  UnitTranslation,
  User,
  Zone,
  ZonePage,
} from "../schema";
import { seedChaptersForBook } from "./books.js";
import { ensureFandomSourceEntity } from "./external-links.js";
import { addSpecialSeedTarget, createSeedResult } from "./result.js";
import {
  PostKind,
  UnitStatus,
  UnitType,
  UnitVisibility,
} from "./storage-values.js";
import type { SeedCtx } from "./strategy.js";
import type { CreatedUser, SeedResult } from "./types.js";
import { withUpdatedAt, withUpdatedAtRows } from "./utils.js";

export const FACTORY_SCENARIO_NAMES = [
  "large-post-tree",
  "large-content-tree",
  "large-history",
  "complex-shelf",
  "toaru",
  "showcase-feed",
] as const;

export type FactoryScenarioName = (typeof FACTORY_SCENARIO_NAMES)[number];

export interface FactoryScenario {
  name: FactoryScenarioName;
  description: string;
  defaultSelected: boolean;
  run: (ctx: SeedCtx) => Promise<SeedResult>;
}

async function getScenarioUser(ctx: SeedCtx): Promise<CreatedUser> {
  const [user] = await ctx.db
    .select({ unitId: User.unitId, name: User.name })
    .from(User)
    .orderBy(asc(User.createdAt))
    .limit(1);
  if (!user) {
    throw new Error("Factory scenario requires at least one seeded user.");
  }
  return {
    userId: user.unitId,
    name: user.name ?? "Factory User",
    slug: user.unitId,
  };
}

async function createNamedBook(
  ctx: SeedCtx,
  userId: string,
  title: string,
): Promise<string> {
  const id = randomUUID();
  await ctx.db.insert(Unit).values(
    withUpdatedAt({
      id,
      type: UnitType.BOOK,
      userId,
      slugScope: userId,
      status: UnitStatus.PUBLISHED,
      licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
      defaultLanguage: DEFAULT_LANGUAGE,
      publishedAt: new Date(),
    }),
  );
  await ctx.db
    .insert(Book)
    .values(withUpdatedAt({ unitId: id, textLength: 120000 }));
  await ctx.db.insert(UnitTranslation).values(
    withUpdatedAt({
      unitId: id,
      language: DEFAULT_LANGUAGE,
      title,
    }),
  );
  await ctx.db.insert(UnitSupportLanguage).values(
    withUpdatedAt({
      unitId: id,
      language: DEFAULT_LANGUAGE,
      isPrimary: true,
    }),
  );
  await ctx.db
    .insert(ContentStructure)
    .values(withUpdatedAt({ ownerUnitId: id }));
  return id;
}

async function createScenarioTag(ctx: SeedCtx, title: string): Promise<string> {
  const id = randomUUID();
  await ctx.db.insert(Unit).values(
    withUpdatedAt({
      id,
      type: UnitType.TAG,
      slugScope: ctx.slugScopes.tag,
      status: UnitStatus.PUBLISHED,
      visibility: UnitVisibility.PUBLIC,
      defaultLanguage: DEFAULT_LANGUAGE,
      isLanguageNeutral: true,
    }),
  );
  await ctx.db.insert(UnitTranslation).values(
    withUpdatedAt({
      unitId: id,
      language: DEFAULT_LANGUAGE,
      title,
    }),
  );
  await ctx.sync.tag(id);
  return id;
}

interface ScenarioTranslation {
  language: string;
  title: string;
  summary?: string;
  description?: string;
}

async function insertScenarioTranslations(
  ctx: SeedCtx,
  unitId: string,
  translations: ScenarioTranslation[],
) {
  await ctx.db.insert(UnitTranslation).values(
    withUpdatedAtRows(
      translations.map((item) => ({
        unitId,
        language: item.language,
        title: item.title,
        summary: item.summary,
        description: item.description
          ? (markdownContentDoc(item.description) as never)
          : undefined,
      })),
    ),
  );
  await ctx.db.insert(UnitSupportLanguage).values(
    withUpdatedAtRows(
      translations.map((item, index) => ({
        unitId,
        language: item.language,
        isPrimary: index === 0,
        position: rebalance(translations.length)[index]!,
      })),
    ),
  );
}

async function createScenarioLabel(
  ctx: SeedCtx,
  translations: ScenarioTranslation[],
): Promise<string> {
  const id = randomUUID();
  await ctx.db.insert(Unit).values(
    withUpdatedAt({
      id,
      type: UnitType.LABEL,
      slugScope: ctx.slugScopes.zone,
      status: UnitStatus.PUBLISHED,
      visibility: UnitVisibility.PUBLIC,
      defaultLanguage: translations[0]?.language ?? DEFAULT_LANGUAGE,
      isLanguageNeutral: true,
    }),
  );
  await insertScenarioTranslations(ctx, id, translations);
  await ctx.sync.label(id);
  return id;
}

async function createScenarioEntity(
  ctx: SeedCtx,
  input: {
    kind: string;
    subjectRoles: string[];
    translations: ScenarioTranslation[];
  },
): Promise<string> {
  const id = randomUUID();
  await ctx.db.insert(Unit).values(
    withUpdatedAt({
      id,
      type: UnitType.ENTITY,
      slugScope: ctx.slugScopes.entity,
      status: UnitStatus.PUBLISHED,
      visibility: UnitVisibility.PUBLIC,
      defaultLanguage: input.translations[0]?.language ?? DEFAULT_LANGUAGE,
    }),
  );
  await insertScenarioTranslations(ctx, id, input.translations);
  await ctx.db.insert(Entity).values(
    withUpdatedAt({
      unitId: id,
      kind: input.kind,
      verified: true,
      eligibleSubjectRoles: input.subjectRoles,
    }),
  );
  await ctx.sync.entity(id);
  return id;
}

async function createScenarioBookUnit(
  ctx: SeedCtx,
  input: {
    userId: string;
    publishedAt: Date;
    translations: ScenarioTranslation[];
    pageCount?: number;
    textLength?: number;
  },
): Promise<string> {
  const unitId = randomUUID();
  await ctx.db.insert(Unit).values(
    withUpdatedAt({
      id: unitId,
      type: UnitType.BOOK,
      userId: input.userId,
      slugScope: input.userId,
      status: UnitStatus.PUBLISHED,
      visibility: UnitVisibility.PUBLIC,
      licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
      defaultLanguage: input.translations[0]?.language ?? DEFAULT_LANGUAGE,
      publishedAt: input.publishedAt,
    }),
  );
  await insertScenarioTranslations(ctx, unitId, input.translations);
  await ctx.db.insert(Book).values(
    withUpdatedAt({
      unitId,
      pageCount: input.pageCount ?? 320,
      textLength: input.textLength ?? 90000,
      chapterCount: 0,
      formatKey: "ebook",
    }),
  );
  await ctx.db
    .insert(ContentStructure)
    .values(withUpdatedAt({ ownerUnitId: unitId }));
  return unitId;
}

async function getWorkIds(ctx: SeedCtx): Promise<string[]> {
  const rows = await ctx.db
    .select({ id: Unit.id })
    .from(Unit)
    .where(
      and(
        inArray(Unit.type, [UnitType.BOOK, UnitType.GAME, UnitType.MEDIA]),
        eq(Unit.status, UnitStatus.PUBLISHED),
      ),
    )
    .limit(80);
  return rows.map((row) => row.id);
}

interface ShowcaseFeedWorkPlan {
  unitId: string;
  title: string;
  subtitle: string;
  coverUrl: string;
  authorEntityUnitId: string;
  authorName: string;
  tags: Array<{ unitId: string; title: string }>;
  textLength: number;
}

interface ShowcaseFeedPostPlan {
  unitId: string;
  kind: PostKind;
  title: string;
  body: string;
  targetUnitId?: string;
  extra?: Record<string, unknown>;
  publishedAt: Date;
}

interface ShowcaseFeedShelfPlan {
  unitId: string;
  title: string;
  itemUnitIds: string[];
}

interface ShowcaseFeedCommentPlan {
  id: string;
  rootUnitId: string;
  parentCommentId?: string;
  body: string;
  depth: number;
  replyCount: number;
  directReplyCount: number;
  createdAt: Date;
}

export interface ShowcaseFeedPlan {
  scenario: "showcase-feed";
  userId: string;
  realmUnitId: string;
  works: ShowcaseFeedWorkPlan[];
  posts: ShowcaseFeedPostPlan[];
  shelves: ShowcaseFeedShelfPlan[];
  comments: ShowcaseFeedCommentPlan[];
  realmMembershipUnitIds: string[];
}

export function buildShowcaseFeedPlan(input: {
  userId: string;
  idFactory?: () => string;
  now?: Date;
}): ShowcaseFeedPlan {
  const id = input.idFactory ?? randomUUID;
  const now = input.now ?? new Date("2026-06-05T12:00:00.000Z");
  const publishedAt = (hoursAgo: number) =>
    new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
  const realmUnitId = id();
  const works: ShowcaseFeedWorkPlan[] = [
    {
      unitId: id(),
      title: "Showcase Feed: The Long Harbor",
      subtitle: "A cartographic fantasy of tides, gates, and borrowed names",
      coverUrl: "https://picsum.photos/seed/rezics-long-harbor/360/540",
      authorEntityUnitId: id(),
      authorName: "Mira Hoshino",
      tags: [
        { unitId: id(), title: "Urban Fantasy" },
        { unitId: id(), title: "Archive Mystery" },
        { unitId: id(), title: "Sea Cities" },
      ],
      textLength: 132000,
    },
    {
      unitId: id(),
      title: "Showcase Feed: Signal Garden",
      subtitle: "Letters, antennas, and a city that answers in flowers",
      coverUrl: "https://picsum.photos/seed/rezics-signal-garden/360/540",
      authorEntityUnitId: id(),
      authorName: "Ren Calder",
      tags: [
        { unitId: id(), title: "Speculative" },
        { unitId: id(), title: "Epistolary" },
        { unitId: id(), title: "Botanical Tech" },
      ],
      textLength: 88000,
    },
    {
      unitId: id(),
      title: "Showcase Feed: Index of Blue Cities",
      subtitle: "A catalog of impossible places and the readers who map them",
      coverUrl: "https://picsum.photos/seed/rezics-blue-cities/360/540",
      authorEntityUnitId: id(),
      authorName: "Chen Yue",
      tags: [
        { unitId: id(), title: "Catalog Fiction" },
        { unitId: id(), title: "Metafiction" },
        { unitId: id(), title: "Blue Cities" },
      ],
      textLength: 104000,
    },
  ];
  const posts: ShowcaseFeedPostPlan[] = [
    {
      unitId: id(),
      kind: PostKind.POST,
      title: "Showcase dispatch: reading paths for new members",
      body:
        "A long-form realm post for feed layout verification.\n\n" +
        "It has enough text to exercise card previews, wrapping, and scanner-friendly spacing in the realm feed.",
      publishedAt: publishedAt(1),
    },
    {
      unitId: id(),
      kind: PostKind.POST,
      title: "Showcase gallery: cover studies and archive screenshots",
      body:
        "Image-rich showcase post.\n\n" +
        "![Archive wall](https://picsum.photos/seed/rezics-showcase-feed/960/540)\n\n" +
        "The image markdown gives visual QA a media-heavy card inside the same feed.",
      publishedAt: publishedAt(8),
    },
    {
      unitId: id(),
      kind: PostKind.REVIEW,
      title: "Review: The Long Harbor rewards slow reading",
      body: "A review post scoped to the showcase realm. It targets a work directly so the feed card can render the reviewed work link without client hydration.",
      targetUnitId: works[0]!.unitId,
      extra: {
        rating: 4.5,
        book: { id: works[0]!.unitId, title: works[0]!.title },
      },
      publishedAt: publishedAt(20),
    },
    {
      unitId: id(),
      kind: PostKind.REMARK,
      title: "Remark: recurring signal motifs",
      body: "A short remark post for mixed-kind feed verification. It keeps the row compact while still targeting a work.",
      targetUnitId: works[1]!.unitId,
      publishedAt: publishedAt(36),
    },
    {
      unitId: id(),
      kind: PostKind.EXCERPT,
      title: "Excerpt: a city catalog note",
      body: "> Every index is also a map.\n\nA compact excerpt row for feed kind coverage.",
      targetUnitId: works[2]!.unitId,
      extra: {
        source: {
          mode: "unit",
          unitId: works[2]!.unitId,
          title: works[2]!.title,
        },
      },
      publishedAt: publishedAt(60),
    },
  ];
  const shelves: ShowcaseFeedShelfPlan[] = [
    {
      unitId: id(),
      title: "Showcase Feed: start here",
      itemUnitIds: works.map((work) => work.unitId),
    },
    {
      unitId: id(),
      title: "Showcase Feed: review trail",
      itemUnitIds: [works[0]!.unitId, posts[2]!.unitId, works[1]!.unitId],
    },
  ];
  const rootCommentId = id();
  const comments: ShowcaseFeedCommentPlan[] = [
    {
      id: rootCommentId,
      rootUnitId: posts[0]!.unitId,
      body: "This kickoff thread gives the showcase feed a visible comment count.",
      depth: 1,
      replyCount: 1,
      directReplyCount: 1,
      createdAt: publishedAt(0.75),
    },
    {
      id: id(),
      rootUnitId: posts[0]!.unitId,
      parentCommentId: rootCommentId,
      body: "A nested reply exercises comment tree rendering from the same fixture.",
      depth: 2,
      replyCount: 0,
      directReplyCount: 0,
      createdAt: publishedAt(0.5),
    },
  ];

  return {
    scenario: "showcase-feed",
    userId: input.userId,
    realmUnitId,
    works,
    posts,
    shelves,
    comments,
    realmMembershipUnitIds: [
      ...works.map((work) => work.unitId),
      ...posts.map((post) => post.unitId),
    ],
  };
}

async function runLargePostTree(ctx: SeedCtx): Promise<SeedResult> {
  const result = createSeedResult();
  const user = await getScenarioUser(ctx);
  const targetUnitId = await createNamedBook(
    ctx,
    user.userId,
    "Factory Scenario: Large Post Tree",
  );

  await ctx.sync.content(targetUnitId);
  addSpecialSeedTarget(result, {
    label: "Large post tree target",
    scenario: "large-post-tree",
    unitType: UnitType.BOOK,
    unitId: targetUnitId,
  });

  const rootCount = 8;
  const repliesPerRoot = 18;
  const maxDepth = 4;
  const branchCap = 4;
  const now = new Date();
  const plannedPosts = buildLargePostTreePlan({
    rootCount,
    repliesPerRoot,
    maxDepth,
    branchCap,
  });
  const rootPosts = plannedPosts.filter((post) => post.depth === 0);
  const unitRows: Array<{
    id: string;
    type: UnitType;
    userId: string;
    slugScope: string;
    targetUnitId: string;
    status: UnitStatus;
    licenseSlug: string;
    defaultLanguage: string;
    publishedAt: Date;
  }> = [];
  const postRows: Array<{
    unitId: string;
    authorUserId: string;
    kind: PostKind;
  }> = [];
  const contentRows: Array<{
    unitId: string;
    language: string;
    content: unknown;
    status: "PUBLISHED";
    authorUserId: string;
    provenance: unknown;
  }> = [];
  const supportRows: Array<{
    unitId: string;
    language: string;
    isPrimary: boolean;
  }> = [];

  for (const planned of rootPosts) {
    unitRows.push({
      id: planned.id,
      type: UnitType.POST,
      userId: user.userId,
      slugScope: user.userId,
      targetUnitId,
      status: UnitStatus.PUBLISHED,
      licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
      defaultLanguage: DEFAULT_LANGUAGE,
      publishedAt: now,
    });
    postRows.push({
      unitId: planned.id,
      authorUserId: user.userId,
      kind: PostKind.POST,
    });
    contentRows.push({
      unitId: planned.id,
      language: DEFAULT_LANGUAGE,
      content: markdownContentDoc(
        `Root ${planned.rootIndex + 1} for the large post tree scenario.`,
      ),
      status: "PUBLISHED",
      authorUserId: user.userId,
      provenance: { importedFrom: "factory-large-post-tree-scenario" },
    });
    supportRows.push({
      unitId: planned.id,
      language: DEFAULT_LANGUAGE,
      isPrimary: true,
    });
  }

  await ctx.db.insert(Unit).values(withUpdatedAtRows(unitRows));
  await ctx.db.insert(Post).values(withUpdatedAtRows(postRows));
  await ctx.db
    .insert(UnitSupportLanguage)
    .values(withUpdatedAtRows(supportRows));
  await ctx.db
    .insert(ContentTranslation)
    .values(withUpdatedAtRows(contentRows) as never);
  for (const post of rootPosts) {
    await ctx.sync.post(post.id);
  }

  for (const [index, post] of rootPosts.slice(0, 3).entries()) {
    addSpecialSeedTarget(result, {
      label: `Large post tree root ${index + 1}`,
      scenario: "large-post-tree",
      unitType: UnitType.POST,
      unitId: post.id,
    });
  }

  return result;
}

export interface LargePostTreePlanInput {
  rootCount: number;
  repliesPerRoot: number;
  maxDepth: number;
  branchCap: number;
}

export interface LargePostTreePlanNode {
  id: string;
  rootId: string;
  rootIndex: number;
  replyIndex: number;
  parentId: string | null;
  depth: number;
  path: string;
  replyCount: number;
  directReplyCount: number;
}

export function buildLargePostTreePlan({
  rootCount,
  repliesPerRoot,
  maxDepth,
  branchCap,
}: LargePostTreePlanInput): LargePostTreePlanNode[] {
  const nodes: LargePostTreePlanNode[] = [];

  for (let rootIndex = 0; rootIndex < rootCount; rootIndex++) {
    const rootId = randomUUID();
    const root: LargePostTreePlanNode = {
      id: rootId,
      rootId,
      rootIndex,
      replyIndex: -1,
      parentId: null,
      depth: 0,
      path: String(rootIndex + 1).padStart(4, "0"),
      replyCount: 0,
      directReplyCount: 0,
    };
    nodes.push(root);

    const parents: LargePostTreePlanNode[] = [root];
    const byId = new Map<string, LargePostTreePlanNode>([[root.id, root]]);
    let parentCursor = 0;

    for (let replyIndex = 0; replyIndex < repliesPerRoot; replyIndex++) {
      let parent = parents[parentCursor % parents.length]!;
      let attempts = 0;
      while (
        (parent.depth >= maxDepth || parent.directReplyCount >= branchCap) &&
        attempts < parents.length
      ) {
        parentCursor++;
        attempts++;
        parent = parents[parentCursor % parents.length]!;
      }
      if (parent.depth >= maxDepth) {
        throw new Error("Large post tree plan ran out of eligible parents.");
      }

      const childIndex = parent.directReplyCount + 1;
      const id = randomUUID();
      const node: LargePostTreePlanNode = {
        id,
        rootId,
        rootIndex,
        replyIndex,
        parentId: parent.id,
        depth: parent.depth + 1,
        path: `${parent.path}.${String(childIndex).padStart(4, "0")}`,
        replyCount: 0,
        directReplyCount: 0,
      };

      parent.directReplyCount++;
      nodes.push(node);
      parents.push(node);
      byId.set(node.id, node);

      let ancestor: LargePostTreePlanNode | undefined = parent;
      while (ancestor) {
        ancestor.replyCount++;
        ancestor = ancestor.parentId ? byId.get(ancestor.parentId) : undefined;
      }
      parentCursor++;
    }
  }

  return nodes;
}

async function runLargeContentTree(ctx: SeedCtx): Promise<SeedResult> {
  const result = createSeedResult();
  const user = await getScenarioUser(ctx);
  const bookUnitId = await createNamedBook(
    ctx,
    user.userId,
    "Factory Scenario: Large Content Tree",
  );
  await seedChaptersForBook(ctx, bookUnitId, user.userId, {
    count: { min: 180, max: 180, target: 180 },
    unitProbability: 0.65,
    multiLinkChapterProbability: 0.08,
  });

  await ctx.sync.content(bookUnitId);
  addSpecialSeedTarget(result, {
    label: "Large content tree root",
    scenario: "large-content-tree",
    unitType: UnitType.BOOK,
    unitId: bookUnitId,
  });

  return result;
}

async function runLargeHistory(ctx: SeedCtx): Promise<SeedResult> {
  const result = createSeedResult();
  const user = await getScenarioUser(ctx);
  const unitId = await createNamedBook(
    ctx,
    user.userId,
    "Factory Scenario: Large History",
  );

  await ctx.db.insert(UnitHistoryClock).values(
    withUpdatedAt({
      unitId,
      nextSequence: 121,
    }),
  );
  await ctx.db.insert(HistoryOutbox).values(
    withUpdatedAtRows(
      Array.from({ length: 120 }, (_, index) => ({
        unitId,
        sequence: index + 1,
        actorUserId: user.userId,
        category: index % 2 === 0 ? "revision" : "structure",
        payload: {
          source: "factory",
          scenario: "large-history",
          index,
        },
        status: "pending",
      })),
    ),
  );

  await ctx.sync.content(unitId);
  addSpecialSeedTarget(result, {
    label: "Large history unit",
    scenario: "large-history",
    unitType: UnitType.BOOK,
    unitId,
    notes: "Writes main database HistoryOutbox rows.",
  });

  return result;
}

async function runComplexShelf(ctx: SeedCtx): Promise<SeedResult> {
  const result = createSeedResult();
  const user = await getScenarioUser(ctx);
  const workIds = await getWorkIds(ctx);
  if (workIds.length < 4) {
    throw new Error(
      "complex-shelf requires at least four published work Units.",
    );
  }

  const shelfId = randomUUID();
  await ctx.db.insert(Unit).values(
    withUpdatedAt({
      id: shelfId,
      type: UnitType.SHELF,
      userId: user.userId,
      slugScope: user.userId,
      status: UnitStatus.PUBLISHED,
      licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
      defaultLanguage: DEFAULT_LANGUAGE,
      publishedAt: new Date(),
    }),
  );
  await ctx.db.insert(Shelf).values(
    withUpdatedAt({
      unitId: shelfId,
      extra: { viewMode: "nested", sortBy: "manual" },
    }),
  );
  await ctx.db.insert(UnitTranslation).values(
    withUpdatedAt({
      unitId: shelfId,
      language: DEFAULT_LANGUAGE,
      title: "Factory Scenario: Complex Shelf",
    }),
  );
  await ctx.db.insert(UnitSupportLanguage).values(
    withUpdatedAt({
      unitId: shelfId,
      language: DEFAULT_LANGUAGE,
      isPrimary: true,
    }),
  );

  let prev: string | undefined;
  const selected = workIds.slice(0, Math.min(workIds.length, 48));
  const shelfRows = selected.map((unitId, index) => {
    const position = generateBetween(prev, undefined);
    prev = position;
    return {
      shelfId,
      itemType: "unit",
      itemId: unitId,
      kind: index % 3 === 0 ? "book" : index % 3 === 1 ? "game" : "media",
      position,
      parentItemType: index > 0 && index < 20 ? "unit" : null,
      parentItemId: index > 0 && index < 20 ? selected[index - 1]! : null,
      parentRole:
        index > 0 && index < 20
          ? index % 2 === 0
            ? "sequel"
            : "related"
          : null,
    };
  });
  await ctx.db
    .insert(ShelfItem)
    .values(withUpdatedAtRows(shelfRows))
    .onConflictDoNothing();
  await ctx.db
    .update(Shelf)
    .set({
      rootItemCount: shelfRows.filter((row) => !row.parentItemId).length,
      itemCount: shelfRows.length,
    })
    .where(eq(Shelf.unitId, shelfId));

  await ctx.sync.content(shelfId);
  await ctx.sync.contentContainedUnits(shelfId);
  addSpecialSeedTarget(result, {
    label: "Complex shelf",
    scenario: "complex-shelf",
    unitType: UnitType.SHELF,
    unitId: shelfId,
  });

  return result;
}

async function createWikiScenarioPost(
  ctx: SeedCtx,
  input: {
    userId: string;
    targetUnitId: string;
    realmUnitId: string;
    defaultLanguage: string;
    // UNLISTED makes a "zone fragment": the post renders in richText
    // sections but stays out of wiki listings, query sections, and search
    // (the sync layer indexes PUBLIC units only).
    // UNLISTED 形成“专区片段”：该帖子在 richText 分区中渲染，但不出现在
    // wiki 列表、查询分区与搜索中（同步层只索引 PUBLIC Unit）。
    visibility?: UnitVisibility;
    translations: Array<{ language: string; title: string; body: string }>;
    publishedAt: Date;
  },
): Promise<string> {
  const postUnitId = randomUUID();
  await ctx.db.insert(Unit).values({
    id: postUnitId,
    type: UnitType.POST,
    userId: input.userId,
    slugScope: input.userId,
    status: UnitStatus.PUBLISHED,
    visibility: input.visibility ?? UnitVisibility.PUBLIC,
    licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
    defaultLanguage: input.defaultLanguage,
    targetUnitId: input.targetUnitId,
    publishedAt: input.publishedAt,
    updatedAt: input.publishedAt,
  });
  await ctx.db.insert(UnitTranslation).values(
    withUpdatedAtRows(
      input.translations.map((item) => ({
        unitId: postUnitId,
        language: item.language,
        title: item.title,
        summary: `${item.title} wiki fixture.`,
      })),
    ),
  );
  await ctx.db.insert(UnitSupportLanguage).values(
    withUpdatedAtRows(
      input.translations.map((item, index) => ({
        unitId: postUnitId,
        language: item.language,
        isPrimary: item.language === input.defaultLanguage,
        position: rebalance(input.translations.length)[index]!,
      })),
    ),
  );
  // richText sections read fragment bodies from PUBLISHED
  // `ContentTranslation` rows (see `findFragmentTranslations`), so every
  // language ships as a published content translation, not unit summary text.
  // richText 分区从 PUBLISHED 的 `ContentTranslation` 行读取片段正文
  // （见 `findFragmentTranslations`），因此每种语言都以已发布的内容翻译
  // 落库，而不是 Unit 摘要文本。
  await ctx.db.insert(ContentTranslation).values(
    withUpdatedAtRows(
      input.translations.map((item) => ({
        unitId: postUnitId,
        language: item.language,
        content: markdownContentDoc(item.body) as never,
        status: "PUBLISHED" as const,
        authorUserId: input.userId,
        provenance: { importedFrom: "factory-toaru-scenario" },
      })),
    ),
  );
  await ctx.db.insert(Post).values({
    unitId: postUnitId,
    authorUserId: input.userId,
    kind: PostKind.WIKI,
    createdAt: input.publishedAt,
    updatedAt: input.publishedAt,
  });
  await ctx.db.insert(UnitRealm).values(
    withUpdatedAt({
      realmUnitId: input.realmUnitId,
      unitId: postUnitId,
    }),
  );
  await ctx.sync.post(postUnitId);
  return postUnitId;
}

async function runShowcaseFeed(ctx: SeedCtx): Promise<SeedResult> {
  const result = createSeedResult();
  const user = await getScenarioUser(ctx);
  const plan = buildShowcaseFeedPlan({ userId: user.userId });

  await ctx.db.insert(Unit).values(
    withUpdatedAt({
      id: plan.realmUnitId,
      type: UnitType.REALM,
      userId: user.userId,
      slugScope: ctx.slugScopes.realm,
      status: UnitStatus.PUBLISHED,
      visibility: UnitVisibility.PUBLIC,
      defaultLanguage: DEFAULT_LANGUAGE,
      publishedAt: new Date("2026-06-05T12:00:00.000Z"),
    }),
  );
  await ctx.db.insert(UnitTranslation).values(
    withUpdatedAt({
      unitId: plan.realmUnitId,
      language: DEFAULT_LANGUAGE,
      title: "Factory Scenario: Showcase Feed Realm",
      description: markdownContentDoc(
        "Deterministic realm with mixed feed content, review targets, shelves, and varied timestamps.",
      ) as never,
    }),
  );
  await ctx.db.insert(UnitSupportLanguage).values(
    withUpdatedAt({
      unitId: plan.realmUnitId,
      language: DEFAULT_LANGUAGE,
      isPrimary: true,
    }),
  );
  await ctx.db.insert(Realm).values(
    withUpdatedAt({
      unitId: plan.realmUnitId,
      isPublic: true,
      isOfficial: true,
      memberCount: 1,
      extra: { scenario: "showcase-feed" },
    }),
  );
  await ctx.db.insert(RealmMember).values(
    withUpdatedAt({
      realmUnitId: plan.realmUnitId,
      userId: user.userId,
      roleKey: "owner",
    }),
  );

  for (const work of plan.works) {
    await ctx.db.insert(Unit).values(
      withUpdatedAt({
        id: work.authorEntityUnitId,
        type: UnitType.ENTITY,
        slugScope: ctx.slugScopes.entity,
        status: UnitStatus.PUBLISHED,
        visibility: UnitVisibility.PUBLIC,
        defaultLanguage: DEFAULT_LANGUAGE,
      }),
    );
    await ctx.db.insert(UnitTranslation).values(
      withUpdatedAt({
        unitId: work.authorEntityUnitId,
        language: DEFAULT_LANGUAGE,
        title: work.authorName,
      }),
    );
    await ctx.db.insert(Entity).values(
      withUpdatedAt({
        unitId: work.authorEntityUnitId,
        kind: "person",
        verified: true,
        eligibleCreditRoles: ["author"],
      }),
    );
    await ctx.db.insert(Unit).values(
      withUpdatedAtRows(
        work.tags.map((tag) => ({
          id: tag.unitId,
          type: UnitType.TAG,
          slugScope: ctx.slugScopes.tag,
          status: UnitStatus.PUBLISHED,
          visibility: UnitVisibility.PUBLIC,
          defaultLanguage: DEFAULT_LANGUAGE,
          isLanguageNeutral: true,
        })),
      ),
    );
    await ctx.db.insert(UnitTranslation).values(
      withUpdatedAtRows(
        work.tags.map((tag) => ({
          unitId: tag.unitId,
          language: DEFAULT_LANGUAGE,
          title: tag.title,
        })),
      ),
    );
    await ctx.db.insert(Unit).values(
      withUpdatedAt({
        id: work.unitId,
        type: UnitType.BOOK,
        userId: user.userId,
        slugScope: user.userId,
        status: UnitStatus.PUBLISHED,
        visibility: UnitVisibility.PUBLIC,
        licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
        defaultLanguage: DEFAULT_LANGUAGE,
        publishedAt: new Date("2026-06-05T10:00:00.000Z"),
      }),
    );
    await ctx.db.insert(Book).values(
      withUpdatedAt({
        unitId: work.unitId,
        pageCount: 320,
        textLength: work.textLength,
        chapterCount: 0,
        formatKey: "ebook",
      }),
    );
    await ctx.db.insert(UnitTranslation).values(
      withUpdatedAt({
        unitId: work.unitId,
        language: DEFAULT_LANGUAGE,
        title: work.title,
        subtitle: work.subtitle,
        summary: `${work.title} deterministic showcase work.`,
        extra: withCoverUrl(undefined, work.coverUrl) as never,
      }),
    );
    await ctx.db.insert(UnitSupportLanguage).values(
      withUpdatedAt({
        unitId: work.unitId,
        language: DEFAULT_LANGUAGE,
        isPrimary: true,
      }),
    );
    await ctx.db
      .insert(ContentStructure)
      .values(withUpdatedAt({ ownerUnitId: work.unitId }));
    await ctx.db.insert(CreditAttribution).values({
      unitId: work.unitId,
      entityId: work.authorEntityUnitId,
      role: "author",
      position: generateBetween(undefined, undefined),
    });
    await ctx.db.insert(UnitTag).values(
      withUpdatedAtRows(
        work.tags.map((tag, index) => ({
          unitId: work.unitId,
          tagUnitId: tag.unitId,
          score: 10 - index,
          voteCount: 10 - index,
        })),
      ),
    );
  }

  await ctx.db.insert(Unit).values(
    withUpdatedAtRows(
      plan.posts.map((post) => ({
        id: post.unitId,
        type: UnitType.POST,
        userId: user.userId,
        slugScope: user.userId,
        targetUnitId: post.targetUnitId,
        status: UnitStatus.PUBLISHED,
        visibility: UnitVisibility.PUBLIC,
        licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
        defaultLanguage: DEFAULT_LANGUAGE,
        publishedAt: post.publishedAt,
      })),
    ),
  );
  await ctx.db.insert(UnitTranslation).values(
    withUpdatedAtRows(
      plan.posts.map((post) => ({
        unitId: post.unitId,
        language: DEFAULT_LANGUAGE,
        title: post.title,
      })),
    ),
  );
  await ctx.db.insert(UnitSupportLanguage).values(
    withUpdatedAtRows(
      plan.posts.map((post) => ({
        unitId: post.unitId,
        language: DEFAULT_LANGUAGE,
        isPrimary: true,
      })),
    ),
  );
  await ctx.db.insert(ContentTranslation).values(
    withUpdatedAtRows(
      plan.posts.map((post) => ({
        unitId: post.unitId,
        language: DEFAULT_LANGUAGE,
        content: markdownContentDoc(post.body) as never,
        status: "PUBLISHED" as const,
        authorUserId: user.userId,
        provenance: { importedFrom: "factory-showcase-feed-scenario" },
      })),
    ),
  );
  await ctx.db.insert(Post).values(
    withUpdatedAtRows(
      plan.posts.map((post) => ({
        unitId: post.unitId,
        authorUserId: user.userId,
        kind: post.kind,
        replyCount:
          plan.comments.filter((comment) => comment.rootUnitId === post.unitId)
            .length ?? 0,
        directReplyCount: plan.comments.filter(
          (comment) =>
            comment.rootUnitId === post.unitId && !comment.parentCommentId,
        ).length,
        lastReplyAt:
          plan.comments
            .filter((comment) => comment.rootUnitId === post.unitId)
            .toSorted(
              (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
            )[0]?.createdAt ?? null,
        extra: post.extra,
        createdAt: post.publishedAt,
      })),
    ),
  );
  await ctx.db.insert(Comment).values(
    withUpdatedAtRows(
      plan.comments.map((comment) => ({
        id: comment.id,
        rootUnitId: comment.rootUnitId,
        realmUnitId: plan.realmUnitId,
        parentCommentId: comment.parentCommentId,
        authorUserId: user.userId,
        content: markdownContentDoc(comment.body) as never,
        depth: comment.depth,
        replyCount: comment.replyCount,
        directReplyCount: comment.directReplyCount,
        createdAt: comment.createdAt,
      })),
    ),
  );
  await ctx.db
    .insert(UnitRealm)
    .values(
      withUpdatedAtRows(
        plan.realmMembershipUnitIds.map((unitId) => ({
          realmUnitId: plan.realmUnitId,
          unitId,
          moderationStatus: "APPROVED" as const,
          createdAt: new Date("2026-06-05T12:00:00.000Z"),
        })),
      ),
    )
    .onConflictDoNothing();

  for (const shelf of plan.shelves) {
    await ctx.db.insert(Unit).values(
      withUpdatedAt({
        id: shelf.unitId,
        type: UnitType.SHELF,
        userId: user.userId,
        slugScope: user.userId,
        status: UnitStatus.PUBLISHED,
        visibility: UnitVisibility.PUBLIC,
        licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
        defaultLanguage: DEFAULT_LANGUAGE,
        publishedAt: new Date("2026-06-05T09:00:00.000Z"),
      }),
    );
    await ctx.db.insert(Shelf).values(
      withUpdatedAt({
        unitId: shelf.unitId,
        rootItemCount: shelf.itemUnitIds.length,
        itemCount: shelf.itemUnitIds.length,
        extra: { scenario: "showcase-feed" },
      }),
    );
    await ctx.db.insert(UnitTranslation).values(
      withUpdatedAt({
        unitId: shelf.unitId,
        language: DEFAULT_LANGUAGE,
        title: shelf.title,
      }),
    );
    await ctx.db.insert(UnitSupportLanguage).values(
      withUpdatedAt({
        unitId: shelf.unitId,
        language: DEFAULT_LANGUAGE,
        isPrimary: true,
      }),
    );
    let previousPosition: string | undefined;
    const itemRows = shelf.itemUnitIds.map((unitId) => {
      const work = plan.works.find((candidate) => candidate.unitId === unitId);
      const post = plan.posts.find((candidate) => candidate.unitId === unitId);
      const position = generateBetween(previousPosition, undefined);
      previousPosition = position;
      return {
        shelfId: shelf.unitId,
        itemType: "unit",
        itemId: unitId,
        kind: work
          ? "book"
          : post?.kind === PostKind.REVIEW
            ? "review"
            : "post",
        position,
      };
    });
    await ctx.db
      .insert(ShelfItem)
      .values(withUpdatedAtRows(itemRows))
      .onConflictDoNothing();
  }

  await Promise.all([
    ctx.sync.realm(plan.realmUnitId),
    ...plan.works.map((work) => ctx.sync.content(work.unitId)),
    ...plan.posts.map((post) => ctx.sync.post(post.unitId)),
    ...plan.shelves.flatMap((shelf) => [
      ctx.sync.content(shelf.unitId),
      ctx.sync.contentContainedUnits(shelf.unitId),
    ]),
  ]);

  addSpecialSeedTarget(result, {
    label: "Showcase feed realm",
    scenario: "showcase-feed",
    unitType: UnitType.REALM,
    unitId: plan.realmUnitId,
    notes: "Use this realm to verify mixed feed rows and review target links.",
  });
  addSpecialSeedTarget(result, {
    label: "Showcase feed review",
    scenario: "showcase-feed",
    unitType: UnitType.POST,
    unitId: plan.posts.find((post) => post.kind === PostKind.REVIEW)!.unitId,
  });
  addSpecialSeedTarget(result, {
    label: "Showcase feed shelf",
    scenario: "showcase-feed",
    unitType: UnitType.SHELF,
    unitId: plan.shelves[0]!.unitId,
  });

  return result;
}

// ANCHOR: toaru scenario
// ANCHOR: toaru 情境

interface ToaruTrilingual {
  zhHant: string;
  en: string;
  ja: string;
}

function toaruTranslations(
  titles: ToaruTrilingual,
  extras?: { summaries?: ToaruTrilingual; descriptions?: ToaruTrilingual },
): ScenarioTranslation[] {
  return [
    {
      language: LANGUAGES.ZH_HANT,
      title: titles.zhHant,
      summary: extras?.summaries?.zhHant,
      description: extras?.descriptions?.zhHant,
    },
    {
      language: LANGUAGES.EN,
      title: titles.en,
      summary: extras?.summaries?.en,
      description: extras?.descriptions?.en,
    },
    {
      language: LANGUAGES.JA,
      title: titles.ja,
      summary: extras?.summaries?.ja,
      description: extras?.descriptions?.ja,
    },
  ];
}

export const TOARU_LABELS = {
  classification: { zhHant: "分類", en: "Categories", ja: "分類" },
  characters: { zhHant: "人物角色", en: "Characters", ja: "キャラクター" },
  terms: { zhHant: "名詞術語", en: "Terminology", ja: "用語" },
  factions: { zhHant: "機構組織", en: "Factions", ja: "組織" },
  locations: { zhHant: "地點場所", en: "Locations", ja: "場所" },
  events: { zhHant: "事件記錄", en: "Events", ja: "事件" },
  timeline: { zhHant: "時間線", en: "Timeline", ja: "タイムライン" },
  world: { zhHant: "世界", en: "World", ja: "世界" },
  magicSide: { zhHant: "魔法側", en: "Magic Side", ja: "魔術サイド" },
  scienceSide: { zhHant: "科學側", en: "Science Side", ja: "科学サイド" },
  series: { zhHant: "系列", en: "Series", ja: "シリーズ" },
  carrier: { zhHant: "載體", en: "Media", ja: "媒体" },
  editGuide: { zhHant: "編輯規範", en: "Editing Guide", ja: "編集ガイド" },
  pageStyle: { zhHant: "頁面樣式", en: "Page Style", ja: "ページ様式" },
  citationGuide: { zhHant: "引用來源", en: "Citations", ja: "出典" },
  wikiBuild: { zhHant: "維基建設", en: "Wiki Building", ja: "Wiki構築" },
  recentChanges: { zhHant: "最近更改", en: "Recent Changes", ja: "最近の更新" },
  wantedPages: { zhHant: "待建頁面", en: "Wanted Pages", ja: "作成待ちページ" },
  watchOrder: {
    zhHant: "作品觀看順序參考",
    en: "Viewing Order Reference",
    ja: "視聴順参考",
  },
  // Tab titles for the activity tabs section; LABEL units like the 8
  // category labels above so `titleLabelUnitId` resolution is exercised.
  // 活动标签页分区的标签标题；与上方 8 个分类标签一样是 LABEL Unit，
  // 以演练 `titleLabelUnitId` 解析。
  latestEdits: { zhHant: "最新編輯", en: "Recent Edits", ja: "最近の編集" },
  hotDiscussions: {
    zhHant: "熱門討論",
    en: "Hot Discussions",
    ja: "人気の議論",
  },
  newReleases: { zhHant: "新作", en: "New Releases", ja: "新刊" },
} satisfies Record<string, ToaruTrilingual>;

export type ToaruLabelKey = keyof typeof TOARU_LABELS;

export const TOARU_ENTITIES = {
  kamijou: {
    kind: "character",
    subjectRoles: ["primary_character"],
    titles: { zhHant: "上條當麻", en: "Kamijou Touma", ja: "上条当麻" },
  },
  misaka: {
    kind: "character",
    subjectRoles: ["primary_character"],
    titles: { zhHant: "御坂美琴", en: "Misaka Mikoto", ja: "御坂美琴" },
  },
  accelerator: {
    kind: "character",
    subjectRoles: ["primary_character"],
    titles: { zhHant: "一方通行", en: "Accelerator", ja: "一方通行" },
  },
  index: {
    kind: "character",
    subjectRoles: ["primary_character"],
    titles: { zhHant: "茵蒂克絲", en: "Index", ja: "インデックス" },
  },
  aleister: {
    kind: "character",
    subjectRoles: ["primary_character"],
    titles: {
      zhHant: "亞雷斯塔",
      en: "Aleister Crowley",
      ja: "アレイスター＝クロウリー",
    },
  },
  academyCity: {
    kind: "location",
    subjectRoles: ["setting"],
    titles: { zhHant: "學園都市", en: "Academy City", ja: "学園都市" },
  },
  tokiwadai: {
    kind: "location",
    subjectRoles: ["setting"],
    titles: {
      zhHant: "常盤台中學",
      en: "Tokiwadai Middle School",
      ja: "常盤台中学",
    },
  },
  anglicanChurch: {
    kind: "faction",
    subjectRoles: ["about"],
    titles: {
      zhHant: "英國清教",
      en: "Anglican Church",
      ja: "イギリス清教",
    },
  },
  darkSide: {
    kind: "faction",
    subjectRoles: ["about"],
    titles: {
      zhHant: "學園都市暗部",
      en: "Academy City Dark Side",
      ja: "学園都市暗部",
    },
  },
  daihasei: {
    kind: "event",
    subjectRoles: ["about"],
    titles: {
      zhHant: "大霸星祭",
      en: "Daihasei Festival",
      ja: "大覇星祭",
    },
  },
} satisfies Record<
  string,
  { kind: string; subjectRoles: string[]; titles: ToaruTrilingual }
>;

export type ToaruEntityKey = keyof typeof TOARU_ENTITIES;

// Ordered newest → oldest so the covers rail and the publishedAt-desc query
// both surface the latest release first.
// 按从新到旧排序，使封面栏与 publishedAt 降序查询都先呈现最新刊。
const TOARU_BOOKS: Array<{
  publishedAt: string;
  titles: ToaruTrilingual;
  subjects: Array<{ entity: ToaruEntityKey; role: string }>;
}> = [
  {
    publishedAt: "2026-05-08T00:00:00.000Z",
    titles: {
      zhHant: "創約 魔法禁書目錄 (15)",
      en: "Souyaku: A Certain Magical Index Vol. 15",
      ja: "創約 とある魔術の禁書目録 (15)",
    },
    subjects: [
      { entity: "kamijou", role: "primary_character" },
      { entity: "academyCity", role: "setting" },
    ],
  },
  {
    publishedAt: "2023-01-10T00:00:00.000Z",
    titles: {
      zhHant: "暗部少女共棲",
      en: "A Certain Dark Side Girls' Cohabitation",
      ja: "とある暗部の少女共棲",
    },
    subjects: [
      { entity: "darkSide", role: "about" },
      { entity: "academyCity", role: "setting" },
    ],
  },
  {
    publishedAt: "2020-09-25T00:00:00.000Z",
    titles: {
      zhHant: "科學心理掌握",
      en: "A Certain Scientific Mental Out",
      ja: "とある科学の心理掌握",
    },
    subjects: [{ entity: "tokiwadai", role: "setting" }],
  },
  {
    publishedAt: "2007-02-08T00:00:00.000Z",
    titles: {
      zhHant: "科學超電磁砲",
      en: "A Certain Scientific Railgun",
      ja: "とある科学の超電磁砲",
    },
    subjects: [
      { entity: "misaka", role: "primary_character" },
      { entity: "tokiwadai", role: "setting" },
    ],
  },
  {
    publishedAt: "2004-04-10T00:00:00.000Z",
    titles: {
      zhHant: "魔法禁書目錄",
      en: "A Certain Magical Index",
      ja: "とある魔術の禁書目録",
    },
    subjects: [
      { entity: "kamijou", role: "primary_character" },
      { entity: "index", role: "primary_character" },
      { entity: "academyCity", role: "setting" },
    ],
  },
];

const TOARU_FRAGMENTS = {
  welcome: {
    titles: {
      zhHant: "歡迎",
      en: "Welcome",
      ja: "ようこそ",
    },
    bodies: {
      zhHant:
        "歡迎來到魔法禁書目錄 Wiki！這裡由 r/toaru 社群共同整理角色、用語、組織與事件。",
      en: "Welcome to the Toaru wiki! The r/toaru community collects characters, terminology, factions, and events here.",
      ja: "とある魔術の禁書目録 Wiki へようこそ！r/toaru コミュニティがキャラクター・用語・組織・出来事をまとめています。",
    },
  },
  spoilerNotice: {
    titles: {
      zhHant: "劇透注意",
      en: "Spoiler Notice",
      ja: "ネタバレ注意",
    },
    bodies: {
      zhHant: "注意：本 Wiki 含有最新刊（含創約）劇透，請斟酌閱讀。",
      en: "Heads up: this wiki contains spoilers up to the latest volumes, including Souyaku.",
      ja: "注意：本 Wiki には最新刊（創約を含む）のネタバレが含まれます。",
    },
  },
  news: {
    titles: {
      zhHant: "最新消息",
      en: "News",
      ja: "ニュース",
    },
    bodies: {
      zhHant: "最新消息：創約 第 15 卷已發售；大霸星祭相關條目整理中。",
      en: "News: Souyaku Vol. 15 is out; Daihasei Festival articles are being reorganized.",
      ja: "ニュース：創約 15 巻発売中。大覇星祭関連の項目を整理中。",
    },
  },
  didYouKnow: {
    titles: {
      zhHant: "你知道嗎",
      en: "Did You Know",
      ja: "豆知識",
    },
    bodies: {
      zhHant: "你知道嗎：學園都市的人口約有八成是學生。",
      en: "Did you know: about eighty percent of Academy City's population are students.",
      ja: "豆知識:学園都市の人口の約 8 割は学生。",
    },
  },
} satisfies Record<
  string,
  { titles: ToaruTrilingual; bodies: ToaruTrilingual }
>;

type ToaruFragmentKey = keyof typeof TOARU_FRAGMENTS;

export interface ToaruZoneConfigIds {
  realmUnitId: string;
  labels: Record<ToaruLabelKey, string>;
  entities: Record<ToaruEntityKey, string>;
  bookUnitIds: string[];
  fragments: Record<ToaruFragmentKey, string>;
}

export type ToaruZoneConfig = {
  boundary: ZoneBoundary;
  nav: ZoneNav;
  theme: ZoneTheme;
  pages: Array<{
    id: string;
    slug: string;
    position: string;
    config: ZonePageConfig;
  }>;
  homePageId: string;
};

/**
 * Pure builder for the /z/toaru zone split envelopes, exercising every zone
 * primitive: stage with actions, columns, richText fragments, collections, tabs
 * with per-target queries, feed, stats, label-driven menus, header, boundary
 * filters, and theme tokens. The factory writes this straight to Zone and
 * ZonePage rows (bypassing service validation) while the read path throws on
 * invalid envelopes, so the output must always satisfy the contract schemas
 * and structural invariants (page-local section ids, menu depth ≤ 3, header
 * menu reference); tests assert both.
 * /z/toaru 专区拆分信封的纯构造器，演练所有专区原语：带行动的 stage、
 * columns、richText 片段、collection、按目标查询的 tabs、feed、stats、
 * 标签驱动的菜单、header、边界过滤与主题 token。工厂将其直接写入 Zone 与
 * ZonePage 行（绕过 service 校验），而读取路径会对非法信封抛错，因此输出
 * 必须始终满足契约 schema 与结构不变量（页面内分区 id 唯一、菜单深度 ≤ 3、
 * header 菜单引用）；测试对两者均有断言。
 */
export function buildToaruZoneConfig(ids: ToaruZoneConfigIds): ToaruZoneConfig {
  const { labels, entities, fragments } = ids;
  const unitTarget = (unitId: string) => ({ kind: "unit", unitId }) as const;
  const bookTarget = (index: number) =>
    ({
      kind: "unit",
      unitId: ids.bookUnitIds[index] ?? ids.bookUnitIds[0]!,
    }) as const;
  const pageIds = {
    home: "00000000-0000-7000-8000-000000001001",
    search: "00000000-0000-7000-8000-000000001002",
    feed: "00000000-0000-7000-8000-000000001003",
    characters: "00000000-0000-7000-8000-000000001004",
  };
  const pagePositions = rebalance(4);
  return {
    boundary: {
      schema: "rezics/zone-boundary",
      version: 1,
      context: { kind: "realm", realmUnitId: ids.realmUnitId },
      // The boundary pins every query, search, and feed to the Toaru realm.
      filters: { realm: "context" },
    },
    nav: {
      schema: "rezics/zone-nav",
      version: 1,
      menus: [
        {
          id: "main",
          nodes: [
            {
              id: "nav-classification",
              labelUnitId: labels.classification,
              children: [
                {
                  id: "nav-characters",
                  labelUnitId: labels.characters,
                  target: { kind: "zonePage", pageId: pageIds.characters },
                },
                {
                  id: "nav-terms",
                  labelUnitId: labels.terms,
                  target: { kind: "zonePage", pageId: pageIds.search },
                },
                {
                  id: "nav-factions",
                  labelUnitId: labels.factions,
                  target: unitTarget(entities.anglicanChurch),
                },
                {
                  id: "nav-locations",
                  labelUnitId: labels.locations,
                  target: unitTarget(entities.academyCity),
                },
                {
                  id: "nav-events",
                  labelUnitId: labels.events,
                  target: unitTarget(entities.daihasei),
                },
                {
                  id: "nav-timeline",
                  labelUnitId: labels.timeline,
                  target: { kind: "zonePage", pageId: pageIds.feed },
                },
              ],
            },
            {
              id: "nav-world",
              labelUnitId: labels.world,
              children: [
                {
                  id: "nav-magic",
                  labelUnitId: labels.magicSide,
                  target: unitTarget(entities.index),
                  children: [
                    {
                      id: "nav-magic-index",
                      target: unitTarget(entities.index),
                    },
                    {
                      id: "nav-magic-anglican",
                      target: unitTarget(entities.anglicanChurch),
                    },
                  ],
                },
                {
                  id: "nav-science",
                  labelUnitId: labels.scienceSide,
                  target: unitTarget(entities.academyCity),
                  children: [
                    {
                      id: "nav-science-misaka",
                      target: unitTarget(entities.misaka),
                    },
                    {
                      id: "nav-science-accelerator",
                      target: unitTarget(entities.accelerator),
                    },
                    {
                      id: "nav-science-academy-city",
                      target: unitTarget(entities.academyCity),
                    },
                  ],
                },
              ],
            },
            {
              id: "nav-series",
              labelUnitId: labels.series,
              children: [
                { id: "nav-index-series", target: bookTarget(4) },
                { id: "nav-railgun-series", target: bookTarget(3) },
                { id: "nav-mental-out-series", target: bookTarget(2) },
                { id: "nav-dark-side-series", target: bookTarget(1) },
              ],
            },
            {
              id: "nav-carrier",
              labelUnitId: labels.carrier,
              children: [
                { id: "nav-light-novel", target: bookTarget(0) },
                { id: "nav-comic", target: bookTarget(3) },
                { id: "nav-spinoff", target: bookTarget(1) },
              ],
            },
            {
              id: "nav-edit-guide",
              labelUnitId: labels.editGuide,
              children: [
                {
                  id: "nav-page-style",
                  labelUnitId: labels.pageStyle,
                  target: { kind: "zonePage", pageId: pageIds.characters },
                },
                {
                  id: "nav-citation-guide",
                  labelUnitId: labels.citationGuide,
                  target: { kind: "zonePage", pageId: pageIds.search },
                },
              ],
            },
            {
              id: "nav-wiki-build",
              labelUnitId: labels.wikiBuild,
              children: [
                {
                  id: "nav-recent-changes",
                  labelUnitId: labels.recentChanges,
                  target: { kind: "zonePage", pageId: pageIds.feed },
                },
                {
                  id: "nav-wanted-pages",
                  labelUnitId: labels.wantedPages,
                  target: { kind: "zonePage", pageId: pageIds.search },
                },
              ],
            },
            {
              id: "nav-watch-order",
              labelUnitId: labels.watchOrder,
              target: { kind: "zonePage", pageId: pageIds.feed },
            },
          ],
        },
      ],
      header: { menuId: "main" },
    },
    pages: [
      {
        id: pageIds.home,
        slug: "home",
        position: pagePositions[0]!,
        config: {
          schema: "rezics/zone-page",
          version: 1,
          sections: [
            {
              id: "stage",
              kind: "stage",
              sections: [
                { id: "zone-info", kind: "zoneInfo" },
                {
                  id: "stage-actions",
                  kind: "actions",
                  items: [
                    // `external.text` is the single sanctioned inline-text
                    // exception in zone configs.
                    // `external.text` 是专区配置中唯一被允许的内联文本例外。
                    {
                      target: {
                        kind: "external",
                        url: "/r/toaru/create?mode=wiki",
                        text: "建立條目",
                      },
                    },
                    {
                      target: {
                        kind: "external",
                        url: "/r/toaru",
                        text: "r/toaru",
                      },
                    },
                  ],
                },
              ],
            },
            {
              id: "layout",
              kind: "columns",
              columns: [
                {
                  id: "main",
                  ratio: 3,
                  sections: [
                    {
                      id: "welcome",
                      kind: "richText",
                      contentUnitId: fragments.welcome,
                    },
                    {
                      id: "spoiler-notice",
                      kind: "richText",
                      contentUnitId: fragments.spoilerNotice,
                    },
                    {
                      id: "featured-characters",
                      kind: "collection",
                      display: "tiles",
                      titleLabelUnitId: labels.characters,
                      items: [
                        entities.kamijou,
                        entities.misaka,
                        entities.accelerator,
                        entities.index,
                        entities.aleister,
                      ].map((unitId) => ({ target: unitTarget(unitId) })),
                    },
                    {
                      id: "activity",
                      kind: "tabs",
                      defaultTabId: "latest-edits",
                      tabs: [
                        {
                          id: "latest-edits",
                          titleLabelUnitId: labels.latestEdits,
                          sections: [
                            {
                              id: "latest-edits-feed",
                              kind: "stream",
                              streamKind: "updates",
                              limit: 12,
                            },
                          ],
                        },
                        {
                          id: "hot-discussions",
                          titleLabelUnitId: labels.hotDiscussions,
                          sections: [
                            {
                              id: "hot-discussions-query",
                              kind: "query",
                              display: "list",
                              limit: 12,
                              loadMore: true,
                              query: {
                                target: "post",
                                realm: "context",
                                languages: "viewer",
                                sort: { field: "hotScore", direction: "desc" },
                              },
                            },
                          ],
                        },
                        {
                          id: "new-releases",
                          titleLabelUnitId: labels.newReleases,
                          sections: [
                            {
                              id: "new-releases-query",
                              kind: "query",
                              display: "covers",
                              limit: 8,
                              query: {
                                target: "unit",
                                types: ["BOOK"],
                                realm: "context",
                                languages: "viewer",
                                sort: {
                                  field: "publishedAt",
                                  direction: "desc",
                                },
                              },
                            },
                          ],
                        },
                      ],
                    },
                    {
                      id: "wiki-stats",
                      kind: "stats",
                      metrics: ["articles", "members"],
                    },
                  ],
                },
                {
                  id: "side",
                  ratio: 1,
                  sections: [
                    {
                      id: "external-sources",
                      kind: "sources",
                      limit: 6,
                    },
                    {
                      id: "quick-links",
                      kind: "collection",
                      display: "list",
                      items: [
                        {
                          target: unitTarget(entities.daihasei),
                          labelUnitId: labels.events,
                        },
                        {
                          target: unitTarget(entities.academyCity),
                          labelUnitId: labels.locations,
                        },
                        {
                          target: { kind: "zonePage", pageId: pageIds.search },
                          labelUnitId: labels.terms,
                        },
                        {
                          target: {
                            kind: "external",
                            url: "https://discord.gg/toaru",
                            text: "Discord",
                          },
                        },
                      ],
                    },
                    {
                      id: "book-covers",
                      kind: "collection",
                      display: "covers",
                      titleLabelUnitId: labels.newReleases,
                      items: ids.bookUnitIds.map((unitId) => ({
                        target: unitTarget(unitId),
                      })),
                    },
                    {
                      id: "news",
                      kind: "richText",
                      contentUnitId: fragments.news,
                    },
                    {
                      id: "did-you-know",
                      kind: "richText",
                      contentUnitId: fragments.didYouKnow,
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        id: pageIds.characters,
        slug: "characters",
        position: pagePositions[1]!,
        config: {
          schema: "rezics/zone-page",
          version: 1,
          sections: [
            {
              id: "characters",
              kind: "collection",
              display: "avatar-wall",
              titleLabelUnitId: labels.characters,
              items: [
                entities.kamijou,
                entities.misaka,
                entities.accelerator,
                entities.index,
                entities.aleister,
              ].map((unitId) => ({
                target: unitTarget(unitId),
                displayUnitId: unitId,
              })),
            },
          ],
        },
      },
      {
        id: pageIds.search,
        slug: "search",
        position: pagePositions[2]!,
        config: { schema: "rezics/zone-page", version: 1, sections: [] },
      },
      {
        id: pageIds.feed,
        slug: "feed",
        position: pagePositions[3]!,
        config: {
          schema: "rezics/zone-page",
          version: 1,
          sections: [
            { id: "feed", kind: "stream", streamKind: "all", limit: 20 },
          ],
        },
      },
    ],
    homePageId: pageIds.home,
    theme: {
      schema: "rezics/zone-theme",
      version: 1,
      tokens: { accent: "#155e75", accentText: "#ffffff" },
      layout: { contentMaxWidth: 1440, density: "comfortable" },
    },
  };
}

function toaruWikiTranslations(
  titles: ToaruTrilingual,
): Array<{ language: string; title: string; body: string }> {
  return [
    {
      language: LANGUAGES.ZH_HANT,
      title: titles.zhHant,
      body: `${titles.zhHant}是《魔法禁書目錄》世界觀中的重要條目。本條目整理其登場、設定與相關事件。`,
    },
    {
      language: LANGUAGES.EN,
      title: titles.en,
      body: `${titles.en} is a key article in the A Certain Magical Index setting, collecting appearances, lore, and related events.`,
    },
    {
      language: LANGUAGES.JA,
      title: titles.ja,
      body: `${titles.ja}は『とある魔術の禁書目録』世界の主要項目。登場・設定・関連する出来事をまとめる。`,
    },
  ];
}

async function runToaru(ctx: SeedCtx): Promise<SeedResult> {
  const result = createSeedResult();
  const user = await getScenarioUser(ctx);
  const now = new Date();

  const realmUnitId = randomUUID();
  await ctx.db.insert(Unit).values(
    withUpdatedAt({
      id: realmUnitId,
      type: UnitType.REALM,
      userId: user.userId,
      slug: "toaru",
      slugScope: ctx.slugScopes.realm,
      status: UnitStatus.PUBLISHED,
      visibility: UnitVisibility.PUBLIC,
      defaultLanguage: LANGUAGES.ZH_HANT,
      publishedAt: now,
    }),
  );
  await insertScenarioTranslations(
    ctx,
    realmUnitId,
    toaruTranslations(
      {
        zhHant: "魔法禁書目錄",
        en: "A Certain Magical Index",
        ja: "とある魔術の禁書目録",
      },
      {
        descriptions: {
          zhHant: "魔法禁書目錄系列的索引、討論與協作知識社群。",
          en: "The community indexing, discussing, and documenting the A Certain Magical Index series.",
          ja: "とある魔術の禁書目録シリーズの索引・議論・共同知識コミュニティ。",
        },
      },
    ),
  );
  await ctx.db.insert(Realm).values(
    withUpdatedAt({
      unitId: realmUnitId,
      isPublic: true,
      isOfficial: true,
      memberCount: 1,
      extra: { scenario: "toaru" },
    }),
  );
  await ctx.db.insert(RealmMember).values(
    withUpdatedAt({
      realmUnitId,
      userId: user.userId,
      roleKey: "owner",
    }),
  );

  const labelEntries = Object.entries(TOARU_LABELS) as Array<
    [ToaruLabelKey, ToaruTrilingual]
  >;
  const labelIds = {} as Record<ToaruLabelKey, string>;
  for (const [key, titles] of labelEntries) {
    labelIds[key] = await createScenarioLabel(ctx, toaruTranslations(titles));
  }

  const entityEntries = Object.entries(TOARU_ENTITIES) as Array<
    [ToaruEntityKey, (typeof TOARU_ENTITIES)[ToaruEntityKey]]
  >;
  const entityIds = {} as Record<ToaruEntityKey, string>;
  for (const [key, definition] of entityEntries) {
    entityIds[key] = await createScenarioEntity(ctx, {
      kind: definition.kind,
      subjectRoles: definition.subjectRoles,
      translations: toaruTranslations(definition.titles),
    });
  }

  const seriesTagId = await createScenarioTag(ctx, "魔法禁書目錄");
  const entityWikiPostIds: string[] = [];
  for (const [index, [key, definition]] of entityEntries.entries()) {
    entityWikiPostIds.push(
      await createWikiScenarioPost(ctx, {
        userId: user.userId,
        targetUnitId: entityIds[key],
        realmUnitId,
        defaultLanguage: LANGUAGES.ZH_HANT,
        translations: toaruWikiTranslations(definition.titles),
        publishedAt: new Date(now.getTime() - index * 86400000),
      }),
    );
  }
  await ctx.db
    .insert(UnitTag)
    .values(
      withUpdatedAtRows(
        entityWikiPostIds.map((unitId) => ({
          unitId,
          tagUnitId: seriesTagId,
          score: 1,
          voteCount: 1,
        })),
      ),
    )
    .onConflictDoNothing();
  await ctx.db
    .insert(UnitRealm)
    .values(
      withUpdatedAtRows(
        Object.values(entityIds).map((unitId) => ({ realmUnitId, unitId })),
      ),
    )
    .onConflictDoNothing();

  const bookUnitIds: string[] = [];
  for (const book of TOARU_BOOKS) {
    const bookUnitId = await createScenarioBookUnit(ctx, {
      userId: user.userId,
      publishedAt: new Date(book.publishedAt),
      translations: toaruTranslations(book.titles),
    });
    bookUnitIds.push(bookUnitId);
    await ctx.db
      .insert(SubjectAttribution)
      .values(
        book.subjects.map((subject) => ({
          unitId: bookUnitId,
          entityId: entityIds[subject.entity],
          role: subject.role,
        })),
      )
      .onConflictDoNothing();
  }
  // Realm association makes the books reachable from the zone's
  // realm-context query sections (e.g. the publishedAt-desc release rail).
  // realm 关联使这些书可被专区的 realm 语境查询分区命中（如 publishedAt
  // 降序的新刊栏）。
  await ctx.db
    .insert(UnitRealm)
    .values(
      withUpdatedAtRows(bookUnitIds.map((unitId) => ({ realmUnitId, unitId }))),
    )
    .onConflictDoNothing();

  const fragmentEntries = Object.entries(TOARU_FRAGMENTS) as Array<
    [ToaruFragmentKey, (typeof TOARU_FRAGMENTS)[ToaruFragmentKey]]
  >;
  const fragmentIds = {} as Record<ToaruFragmentKey, string>;
  for (const [key, fragment] of fragmentEntries) {
    // UNLISTED keeps the fragments out of wiki listings, query sections,
    // and search while richText sections still render them.
    // UNLISTED 使片段不出现在 wiki 列表、查询分区与搜索中，但 richText
    // 分区仍会渲染它们。
    fragmentIds[key] = await createWikiScenarioPost(ctx, {
      userId: user.userId,
      targetUnitId: realmUnitId,
      realmUnitId,
      defaultLanguage: LANGUAGES.ZH_HANT,
      visibility: UnitVisibility.UNLISTED,
      translations: [
        {
          language: LANGUAGES.ZH_HANT,
          title: fragment.titles.zhHant,
          body: fragment.bodies.zhHant,
        },
        {
          language: LANGUAGES.EN,
          title: fragment.titles.en,
          body: fragment.bodies.en,
        },
        {
          language: LANGUAGES.JA,
          title: fragment.titles.ja,
          body: fragment.bodies.ja,
        },
      ],
      publishedAt: now,
    });
  }

  const zoneUnitId = randomUUID();
  await ctx.db.insert(Unit).values(
    withUpdatedAt({
      id: zoneUnitId,
      type: UnitType.ZONE,
      userId: user.userId,
      slug: "toaru",
      slugScope: ctx.slugScopes.zone,
      status: UnitStatus.PUBLISHED,
      visibility: UnitVisibility.PUBLIC,
      defaultLanguage: LANGUAGES.ZH_HANT,
      publishedAt: now,
    }),
  );
  await insertScenarioTranslations(
    ctx,
    zoneUnitId,
    toaruTranslations(
      {
        // Zones are the realm's portal, named after the community/work. Wiki
        // remains a section inside the portal, not the portal's name.
        zhHant: "魔法禁書目錄",
        en: "Toaru",
        ja: "とある魔術の禁書目録",
      },
      {
        descriptions: {
          zhHant:
            "由 r/toaru 社群維護的魔法禁書目錄社群門戶，含百科、討論與新作索引。",
          en: "The r/toaru community portal for A Certain Magical Index, with encyclopedia pages, discussion, and release indexes.",
          ja: "r/toaru コミュニティによる、とある魔術の禁書目録のポータル。百科ページ、議論、新刊索引を含みます。",
        },
      },
    ),
  );
  const fandomSourceEntityUnitId = await ensureFandomSourceEntity(ctx);
  await ctx.db
    .insert(UnitExternalLink)
    .values(
      withUpdatedAt({
        unitId: zoneUnitId,
        sourceEntityUnitId: fandomSourceEntityUnitId,
        url: "https://toaru.fandom.com/",
        normalizedUrl: "https://toaru.fandom.com/",
        normalizedUrlHash:
          "815d1333159a3a5a444554d82a293593fa2fa334d15d96a41526eecff8735090",
        role: "wiki",
      }),
    )
    .onConflictDoNothing();
  const toaruZoneConfig = buildToaruZoneConfig({
    realmUnitId,
    labels: labelIds,
    entities: entityIds,
    bookUnitIds,
    fragments: fragmentIds,
  });
  await ctx.db.insert(Zone).values(
    withUpdatedAt({
      unitId: zoneUnitId,
      ownerRealmUnitId: realmUnitId,
      boundary: toaruZoneConfig.boundary,
      nav: toaruZoneConfig.nav,
      theme: toaruZoneConfig.theme,
      homePageId: toaruZoneConfig.homePageId,
    }),
  );
  await ctx.db.insert(ZonePage).values(
    withUpdatedAtRows(
      toaruZoneConfig.pages.map((page) => ({
        id: page.id,
        zoneUnitId: zoneUnitId,
        slug: page.slug,
        position: page.position,
        config: page.config,
      })),
    ),
  );

  await Promise.all([
    ctx.sync.realm(realmUnitId),
    ctx.sync.zone(zoneUnitId),
    ...bookUnitIds.map((unitId) => ctx.sync.content(unitId)),
  ]);

  addSpecialSeedTarget(result, {
    label: "Toaru realm",
    scenario: "toaru",
    unitType: UnitType.REALM,
    unitId: realmUnitId,
    notes: "r/toaru — the realm behind the /z/toaru portal.",
  });
  addSpecialSeedTarget(result, {
    label: "Toaru zone portal",
    scenario: "toaru",
    unitType: UnitType.ZONE,
    unitId: zoneUnitId,
    notes: "Open /z/toaru to verify every zone config primitive.",
  });
  addSpecialSeedTarget(result, {
    label: "Toaru entity (上條當麻)",
    scenario: "toaru",
    unitType: UnitType.ENTITY,
    unitId: entityIds.kamijou,
  });
  addSpecialSeedTarget(result, {
    label: "Toaru latest release",
    scenario: "toaru",
    unitType: UnitType.BOOK,
    unitId: bookUnitIds[0]!,
  });

  return result;
}

export const FACTORY_SCENARIOS: Record<FactoryScenarioName, FactoryScenario> = {
  "large-post-tree": {
    name: "large-post-tree",
    description: "Large deterministic post roots for pagination.",
    defaultSelected: true,
    run: runLargePostTree,
  },
  "large-content-tree": {
    name: "large-content-tree",
    description: "Large book content tree with materialized chapters.",
    defaultSelected: true,
    run: runLargeContentTree,
  },
  "large-history": {
    name: "large-history",
    description: "Unit with many main database history outbox rows.",
    defaultSelected: true,
    run: runLargeHistory,
  },
  "complex-shelf": {
    name: "complex-shelf",
    description: "Shelf with mixed items, relations, and ordering volume.",
    defaultSelected: true,
    run: runComplexShelf,
  },
  toaru: {
    name: "toaru",
    description:
      "r/toaru realm and /z/toaru portal exercising every zone config primitive with trilingual labels, entities, books, and fragments.",
    defaultSelected: true,
    run: runToaru,
  },
  "showcase-feed": {
    name: "showcase-feed",
    description:
      "Deterministic realm feed showcase with mixed post kinds, review target context, shelves, and varied timestamps.",
    defaultSelected: true,
    run: runShowcaseFeed,
  },
};

export async function runFactoryScenarios(
  ctx: SeedCtx,
  scenarioNames: FactoryScenarioName[],
): Promise<SeedResult> {
  const result = createSeedResult();
  for (const name of scenarioNames) {
    const scenario = FACTORY_SCENARIOS[name];
    const scenarioResult = await scenario.run(ctx);
    for (const entry of scenarioResult.specialTargets) {
      addSpecialSeedTarget(result, entry);
    }
  }
  return result;
}
