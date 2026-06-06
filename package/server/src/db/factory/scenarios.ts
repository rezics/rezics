import { randomUUID } from "node:crypto";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PUBLICATION_LICENSE_SLUG,
  LANGUAGES,
  markdownContentDoc,
} from "@rezics/contract";
import { and, asc, eq, inArray } from "drizzle-orm";
import { generateBetween } from "../../shelf/fractional-index";
import {
  Book,
  Comment,
  ContentStructure,
  ContentTranslation,
  Entity,
  HistoryOutbox,
  Post,
  Realm,
  RealmMember,
  Shelf,
  ShelfItem,
  SubjectAttribution,
  Unit,
  UnitHistoryClock,
  UnitRealm,
  UnitSupportLanguage,
  UnitTag,
  UnitTranslation,
  User,
  Zone,
} from "../schema";
import { seedChaptersForBook } from "./books.js";
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
  "wiki-zone-experience",
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
  return id;
}

async function createScenarioLabel(
  ctx: SeedCtx,
  title: string,
): Promise<string> {
  const id = randomUUID();
  await ctx.db.insert(Unit).values(
    withUpdatedAt({
      id,
      type: UnitType.LABEL,
      slugScope: ctx.slugScopes.zone,
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
  await ctx.db.insert(UnitSupportLanguage).values(
    withUpdatedAt({
      unitId: id,
      language: DEFAULT_LANGUAGE,
      isPrimary: true,
    }),
  );
  return id;
}

async function createScenarioEntity(
  ctx: SeedCtx,
  input: {
    title: string;
    kind: string;
    subjectRoles: string[];
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
      defaultLanguage: DEFAULT_LANGUAGE,
    }),
  );
  await ctx.db.insert(UnitTranslation).values(
    withUpdatedAt({
      unitId: id,
      language: DEFAULT_LANGUAGE,
      title: input.title,
      summary: `${input.title} fixture entity for wiki Zone sections.`,
    }),
  );
  await ctx.db.insert(UnitSupportLanguage).values(
    withUpdatedAt({
      unitId: id,
      language: DEFAULT_LANGUAGE,
      isPrimary: true,
    }),
  );
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
    title: string;
    language: string;
    visibility?: UnitVisibility;
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
      visibility: input.visibility ?? UnitVisibility.PUBLIC,
      licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
      defaultLanguage: input.language,
      publishedAt: new Date(),
    }),
  );
  await ctx.db.insert(UnitTranslation).values(
    withUpdatedAt({
      unitId,
      language: input.language,
      title: input.title,
      summary: `${input.title} factory fixture.`,
    }),
  );
  await ctx.db.insert(UnitSupportLanguage).values(
    withUpdatedAt({
      unitId,
      language: input.language,
      isPrimary: true,
      sortOrder: 0,
    }),
  );
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
      textLength: 132000,
    },
    {
      unitId: id(),
      title: "Showcase Feed: Signal Garden",
      textLength: 88000,
    },
    {
      unitId: id(),
      title: "Showcase Feed: Index of Blue Cities",
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
      kindKey: "factory-complex",
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
    visibility: UnitVisibility.PUBLIC,
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
        sortOrder: index,
      })),
    ),
  );
  await ctx.db.insert(ContentTranslation).values(
    withUpdatedAtRows(
      input.translations.map((item) => ({
        unitId: postUnitId,
        language: item.language,
        content: markdownContentDoc(item.body) as never,
        status: "PUBLISHED" as const,
        authorUserId: input.userId,
        provenance: { importedFrom: "factory-wiki-zone-scenario" },
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
        summary: `${work.title} deterministic showcase work.`,
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
        kindKey: "showcase",
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

async function createWikiScenarioZone(
  ctx: SeedCtx,
  input: {
    realmUnitId: string;
    slug: string;
    title: string;
    template: "wiki-classic" | "wiki-media" | "wiki-database" | "wiki-minimal";
    homepageTemplate:
      | "wiki-classic-home"
      | "wiki-media-home"
      | "wiki-database-home"
      | "wiki-minimal-home";
    labelUnitIds: {
      overview: string;
      characters: string;
      places: string;
    };
    entityIds: string[];
    tagUnitIds: string[];
    wikiUnitIds: string[];
  },
): Promise<string> {
  const zoneUnitId = randomUUID();
  const wikiFilters = {
    realmUnitId: input.realmUnitId,
    type: "POST",
    postKind: "WIKI",
  };
  await ctx.db.insert(Unit).values(
    withUpdatedAt({
      id: zoneUnitId,
      type: UnitType.ZONE,
      slug: input.slug,
      slugScope: ctx.slugScopes.zone,
      status: UnitStatus.PUBLISHED,
      visibility: UnitVisibility.PUBLIC,
      defaultLanguage: DEFAULT_LANGUAGE,
      publishedAt: new Date(),
    }),
  );
  await ctx.db.insert(UnitTranslation).values(
    withUpdatedAt({
      unitId: zoneUnitId,
      language: DEFAULT_LANGUAGE,
      title: input.title,
      description: markdownContentDoc(
        `${input.title} fixture portal for wiki Zone verification.`,
      ) as never,
    }),
  );
  await ctx.db.insert(UnitSupportLanguage).values(
    withUpdatedAt({
      unitId: zoneUnitId,
      language: DEFAULT_LANGUAGE,
      isPrimary: true,
    }),
  );
  await ctx.db.insert(Zone).values(
    withUpdatedAt({
      unitId: zoneUnitId,
      template: input.template,
      filters: wikiFilters,
      wiki: {
        filters: wikiFilters,
        navigation: {
          sections: [
            {
              id: "main",
              labelUnitId: input.labelUnitIds.overview,
              items: [
                {
                  kind: "labelHeading",
                  labelUnitId: input.labelUnitIds.overview,
                },
                { kind: "entity", entityId: input.entityIds[0] },
                { kind: "tag", tagUnitId: input.tagUnitIds[0] },
                {
                  kind: "wikiUnit",
                  unitId: input.wikiUnitIds[0],
                },
                {
                  kind: "manualLink",
                  href: "/realm",
                  label: {
                    translations: { en: "Realm index" },
                    fallbackLanguage: DEFAULT_LANGUAGE,
                  },
                },
              ],
            },
          ],
        },
        homepage: {
          template: input.homepageTemplate,
          sections: [
            {
              id: "characters",
              kind: "entityCollection",
              titleLabelUnitId: input.labelUnitIds.characters,
              entityKinds: ["character", "location", "faction"],
              subjectRoles: ["primary_character", "setting", "about"],
              realmUnitId: input.realmUnitId,
              limit: 6,
              sort: "title",
              emptyState: "show-empty",
            },
            {
              id: "tags",
              kind: "tagCollection",
              title: {
                translations: { en: "Wiki tags" },
                fallbackLanguage: DEFAULT_LANGUAGE,
              },
              tagUnitIds: input.tagUnitIds,
              limit: 6,
              sort: "title",
            },
            {
              id: "wiki-units",
              kind: "wikiUnitCollection",
              title: {
                translations: { en: "Translated entries" },
                fallbackLanguage: DEFAULT_LANGUAGE,
              },
              unitIds: input.wikiUnitIds,
              limit: 6,
            },
            { id: "recent", kind: "recentWiki", limit: 4 },
            { id: "updated", kind: "updatedWiki", limit: 4 },
            {
              id: "stub",
              kind: "stubWiki",
              predicate: "short",
              limit: 4,
              emptyState: "show-empty",
            },
            {
              id: "manual",
              kind: "manualLinks",
              titleLabelUnitId: input.labelUnitIds.places,
              links: [
                {
                  kind: "manualLink",
                  href: "/realm/search",
                  label: {
                    translations: { en: "Search wiki posts" },
                    fallbackLanguage: DEFAULT_LANGUAGE,
                  },
                },
              ],
            },
          ],
        },
        theme: {
          template: input.template,
          homepageTemplate: input.homepageTemplate,
          palette: {
            background: "#f8fafc",
            surface: "#ffffff",
            text: "#1f2937",
            accent: "#2563eb",
          },
          chrome: { density: "comfortable", navPosition: "side" },
          layout: { contentWidth: "wide", infoboxPosition: "right" },
        },
      },
    }),
  );
  return zoneUnitId;
}

async function runWikiZoneExperience(ctx: SeedCtx): Promise<SeedResult> {
  const result = createSeedResult();
  const user = await getScenarioUser(ctx);
  const wikiEntryUnitId = await createScenarioBookUnit(ctx, {
    userId: user.userId,
    title: "Factory Scenario: Wiki Zone Entry",
    language: DEFAULT_LANGUAGE,
  });
  const releaseUnitId = await createScenarioBookUnit(ctx, {
    userId: user.userId,
    title: "Factory Scenario: Wiki Zone Release",
    language: DEFAULT_LANGUAGE,
  });

  const realmUnitId = randomUUID();
  await ctx.db.insert(Unit).values(
    withUpdatedAt({
      id: realmUnitId,
      type: UnitType.REALM,
      userId: user.userId,
      slugScope: ctx.slugScopes.realm,
      status: UnitStatus.PUBLISHED,
      visibility: UnitVisibility.PUBLIC,
      defaultLanguage: DEFAULT_LANGUAGE,
      publishedAt: new Date(),
    }),
  );
  await ctx.db.insert(UnitTranslation).values(
    withUpdatedAt({
      unitId: realmUnitId,
      language: DEFAULT_LANGUAGE,
      title: "Factory Scenario: Wiki Realm",
    }),
  );
  await ctx.db.insert(UnitSupportLanguage).values(
    withUpdatedAt({
      unitId: realmUnitId,
      language: DEFAULT_LANGUAGE,
      isPrimary: true,
    }),
  );
  await ctx.db.insert(Realm).values(
    withUpdatedAt({
      unitId: realmUnitId,
      isPublic: true,
      isOfficial: true,
      extra: { scenario: "wiki-zone-experience" },
    }),
  );
  await ctx.db.insert(RealmMember).values(
    withUpdatedAt({
      realmUnitId,
      userId: user.userId,
      roleKey: "owner",
    }),
  );
  const [characterId, locationId, factionId] = await Promise.all([
    createScenarioEntity(ctx, {
      title: "Factory Wiki Character",
      kind: "character",
      subjectRoles: ["primary_character"],
    }),
    createScenarioEntity(ctx, {
      title: "Factory Wiki Location",
      kind: "location",
      subjectRoles: ["setting"],
    }),
    createScenarioEntity(ctx, {
      title: "Factory Wiki Faction",
      kind: "faction",
      subjectRoles: ["about"],
    }),
  ]);
  await ctx.db
    .insert(SubjectAttribution)
    .values([
      {
        unitId: wikiEntryUnitId,
        entityId: characterId,
        role: "primary_character",
      },
      { unitId: wikiEntryUnitId, entityId: locationId, role: "setting" },
      { unitId: releaseUnitId, entityId: factionId, role: "about" },
    ])
    .onConflictDoNothing();

  const [overviewLabelId, charactersLabelId, placesLabelId] = await Promise.all(
    [
      createScenarioLabel(ctx, "Overview"),
      createScenarioLabel(ctx, "Characters"),
      createScenarioLabel(ctx, "Places"),
    ],
  );
  const [loreTagId, stubTagId] = await Promise.all([
    createScenarioTag(ctx, "Factory Wiki Lore"),
    createScenarioTag(ctx, "Factory Wiki Stub"),
  ]);

  const wikiEntries = [
    { id: randomUUID(), en: "Overview", zh: "概覽" },
    { id: randomUUID(), en: "Characters", zh: "角色" },
    { id: randomUUID(), en: "Stub Notes", zh: "短條目" },
  ];

  const now = new Date();
  const postIds: string[] = [];
  for (const [index, entry] of wikiEntries.entries()) {
    postIds.push(
      await createWikiScenarioPost(ctx, {
        userId: user.userId,
        targetUnitId: wikiEntryUnitId,
        realmUnitId,
        defaultLanguage: DEFAULT_LANGUAGE,
        translations: [
          {
            language: LANGUAGES.EN,
            title: `Factory Wiki: ${entry.en}`,
            body:
              index === 2
                ? "Stub."
                : `Long-form wiki entry for ${entry.en} in the wiki Zone scenario.`,
          },
          {
            language: LANGUAGES.ZH_HANT,
            title: `Factory Wiki：${entry.zh}`,
            body:
              index === 2 ? "短。" : `Wiki Zone 情境的${entry.zh}繁中條目。`,
          },
        ],
        publishedAt: new Date(now.getTime() - index * 86400000),
      }),
    );
  }
  await ctx.db
    .insert(UnitTag)
    .values(
      withUpdatedAtRows([
        ...postIds.map((unitId) => ({ unitId, tagUnitId: loreTagId })),
        { unitId: postIds.at(-1)!, tagUnitId: stubTagId },
      ]),
    )
    .onConflictDoNothing();

  const zoneInputs = [
    ["wiki-classic", "wiki-classic-home"],
    ["wiki-media", "wiki-media-home"],
    ["wiki-database", "wiki-database-home"],
    ["wiki-minimal", "wiki-minimal-home"],
  ] as const;
  const zoneIds: string[] = [];
  for (const [template, homepageTemplate] of zoneInputs) {
    zoneIds.push(
      await createWikiScenarioZone(ctx, {
        realmUnitId,
        slug: `factory-${template}`,
        title: `Factory Scenario: ${template}`,
        template,
        homepageTemplate,
        labelUnitIds: {
          overview: overviewLabelId,
          characters: charactersLabelId,
          places: placesLabelId,
        },
        entityIds: [characterId, locationId, factionId],
        tagUnitIds: [loreTagId, stubTagId],
        wikiUnitIds: postIds,
      }),
    );
  }
  await ctx.db
    .update(Realm)
    .set({
      extra: {
        scenario: "wiki-zone-experience",
        wikiZoneUnitId: zoneIds[0],
      },
    })
    .where(eq(Realm.unitId, realmUnitId));

  await Promise.all([
    ctx.sync.content(wikiEntryUnitId),
    ctx.sync.content(releaseUnitId),
    ctx.sync.realm(realmUnitId),
    ...zoneIds.map((zoneId) => ctx.sync.content(zoneId)),
  ]);

  addSpecialSeedTarget(result, {
    label: "Wiki Zone entry",
    scenario: "wiki-zone-experience",
    unitType: UnitType.BOOK,
    unitId: wikiEntryUnitId,
  });
  addSpecialSeedTarget(result, {
    label: "Wiki Zone release",
    scenario: "wiki-zone-experience",
    unitType: UnitType.BOOK,
    unitId: releaseUnitId,
  });
  addSpecialSeedTarget(result, {
    label: "Wiki Zone official realm",
    scenario: "wiki-zone-experience",
    unitType: UnitType.REALM,
    unitId: realmUnitId,
  });
  for (const [index, zoneId] of zoneIds.entries()) {
    addSpecialSeedTarget(result, {
      label: `Wiki Zone template ${zoneInputs[index]![0]}`,
      scenario: "wiki-zone-experience",
      unitType: UnitType.ZONE,
      unitId: zoneId,
    });
  }

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
  "wiki-zone-experience": {
    name: "wiki-zone-experience",
    description:
      "Official wiki realm with translated WIKI posts, labels, entities, and all wiki Zone templates.",
    defaultSelected: true,
    run: runWikiZoneExperience,
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
