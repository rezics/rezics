import { randomUUID } from "node:crypto";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PUBLICATION_LICENSE_SLUG,
  LANGUAGES,
  markdownContentDoc,
} from "@rezics/contract";
import { generateBetween } from "../../src/shelf/fractional-index";
import type { Prisma } from "../generated/client.js";
import {
  PostKind,
  UnitStatus,
  UnitType,
  UnitVisibility,
  UnitWorkDisplayPolicy,
  UnitWorkRole,
} from "../generated/client.js";
import { seedChaptersForBook } from "./books.js";
import { addSpecialSeedTarget, createSeedResult } from "./result.js";
import type { SeedCtx } from "./strategy.js";
import type { CreatedUser, SeedResult } from "./types.js";

export const FACTORY_SCENARIO_NAMES = [
  "large-post-tree",
  "large-content-tree",
  "large-history",
  "complex-shelf",
  "unit-work-domain",
] as const;

export type FactoryScenarioName = (typeof FACTORY_SCENARIO_NAMES)[number];

export interface FactoryScenario {
  name: FactoryScenarioName;
  description: string;
  defaultSelected: boolean;
  run: (ctx: SeedCtx) => Promise<SeedResult>;
}

async function getScenarioUser(ctx: SeedCtx): Promise<CreatedUser> {
  const user = await ctx.prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { unitId: true, name: true },
  });
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
  await ctx.prisma.unit.create({
    data: {
      id,
      type: UnitType.BOOK,
      userId,
      slugScope: userId,
      status: UnitStatus.PUBLISHED,
      licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
      defaultLanguage: DEFAULT_LANGUAGE,
      publishedAt: new Date(),
      book: {
        create: { textLength: 120000, contentStructure: { create: {} } },
      },
      translations: { create: { language: DEFAULT_LANGUAGE, title } },
      supportLanguages: {
        create: { language: DEFAULT_LANGUAGE, isPrimary: true },
      },
    },
  });
  return id;
}

async function createScenarioTag(ctx: SeedCtx, title: string): Promise<string> {
  const id = randomUUID();
  await ctx.prisma.unit.create({
    data: {
      id,
      type: UnitType.TAG,
      slugScope: ctx.slugScopes.tag,
      status: UnitStatus.PUBLISHED,
      visibility: UnitVisibility.PUBLIC,
      defaultLanguage: DEFAULT_LANGUAGE,
      isLanguageNeutral: true,
      translations: { create: { language: DEFAULT_LANGUAGE, title } },
    },
  });
  return id;
}

async function ensureFactoryExternalRefSource(ctx: SeedCtx): Promise<string> {
  const existing = await ctx.prisma.sourceSite.findUnique({
    where: { key: "factory-work-domain" },
    select: { entityUnitId: true },
  });
  if (existing) return existing.entityUnitId;

  const sourceUnit = await ctx.prisma.unit.create({
    data: {
      type: UnitType.ENTITY,
      slug: "factory-work-domain-source",
      slugScope: ctx.slugScopes.entity,
      status: UnitStatus.PUBLISHED,
      defaultLanguage: DEFAULT_LANGUAGE,
      translations: {
        create: {
          language: DEFAULT_LANGUAGE,
          title: "Factory Work Domain Source",
          summary: "Source site used by the unit-work-domain seed scenario.",
        },
      },
      entity: {
        create: {
          kind: "organization",
          verified: true,
          eligibleCreditRoles: ["publisher"],
          eligibleSubjectRoles: [],
          sourceSite: {
            create: {
              key: "factory-work-domain",
              crawlSupport: "unsupported",
              crawlEnabled: false,
              refRules: [],
            },
          },
        },
      },
    },
    select: { id: true },
  });
  await ctx.sync.entity(sourceUnit.id);
  return sourceUnit.id;
}

async function createWorkDomainBookUnit(
  ctx: SeedCtx,
  input: {
    userId: string;
    title: string;
    language: string;
    visibility?: UnitVisibility;
    sourceUnitId?: string;
    pageCount?: number;
    textLength?: number;
  },
): Promise<string> {
  const unitId = randomUUID();
  await ctx.prisma.book.create({
    data: {
      unitId,
      unit: {
        create: {
          id: unitId,
          type: UnitType.BOOK,
          userId: input.userId,
          slugScope: input.userId,
          workUnitId: input.sourceUnitId,
          status: UnitStatus.PUBLISHED,
          visibility: input.visibility ?? UnitVisibility.PUBLIC,
          licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
          defaultLanguage: input.language,
          publishedAt: new Date(),
          translations: {
            create: {
              language: input.language,
              title: input.title,
              summary: `${input.title} fixture for work-domain behavior.`,
              sourceUnitId: input.sourceUnitId,
            },
          },
          supportLanguages: {
            create: {
              language: input.language,
              isPrimary: true,
              sortOrder: 0,
            },
          },
        },
      },
      pageCount: input.pageCount ?? 320,
      textLength: input.textLength ?? 90000,
      chapterCount: 0,
      formatKey: "ebook",
      contentStructure: { create: {} },
    },
  });
  return unitId;
}

async function getWorkIds(ctx: SeedCtx): Promise<string[]> {
  const rows = await ctx.prisma.unit.findMany({
    where: {
      type: { in: [UnitType.BOOK, UnitType.GAME, UnitType.MEDIA] },
      status: UnitStatus.PUBLISHED,
    },
    select: { id: true },
    take: 80,
  });
  return rows.map((row) => row.id);
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
  const unitRows: Array<{
    id: string;
    type: UnitType;
    userId: string;
    slugScope: string;
    status: UnitStatus;
    licenseSlug: string;
    defaultLanguage: string;
    publishedAt: Date;
  }> = [];
  const postRows: Array<{
    unitId: string;
    authorUserId: string;
    targetUnitId: string;
    rootPostUnitId: string;
    parentPostUnitId?: string;
    kind: PostKind;
    content: Prisma.InputJsonValue;
    depth: number;
    sortPath: string;
    replyCount?: number;
    directReplyCount?: number;
    lastReplyAt?: Date;
  }> = [];
  const supportRows: Array<{
    unitId: string;
    language: string;
    isPrimary: boolean;
  }> = [];

  for (const planned of plannedPosts) {
    unitRows.push({
      id: planned.id,
      type: UnitType.POST,
      userId: user.userId,
      slugScope: user.userId,
      status: UnitStatus.PUBLISHED,
      licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
      defaultLanguage: DEFAULT_LANGUAGE,
      publishedAt: now,
    });
    postRows.push({
      unitId: planned.id,
      authorUserId: user.userId,
      targetUnitId,
      rootPostUnitId: planned.rootId,
      ...(planned.parentId ? { parentPostUnitId: planned.parentId } : {}),
      kind: PostKind.POST,
      content: markdownContentDoc(
        planned.depth === 0
          ? `Root ${planned.rootIndex + 1} for the large post tree scenario.`
          : `Reply ${planned.replyIndex + 1} at depth ${planned.depth} under root ${planned.rootIndex + 1}.`,
      ) as Prisma.InputJsonValue,
      depth: planned.depth,
      sortPath: planned.sortPath,
      replyCount: planned.replyCount,
      directReplyCount: planned.directReplyCount,
      ...(planned.replyCount > 0 ? { lastReplyAt: now } : {}),
    });
    supportRows.push({
      unitId: planned.id,
      language: DEFAULT_LANGUAGE,
      isPrimary: true,
    });
  }

  await ctx.prisma.unit.createMany({ data: unitRows });
  await ctx.prisma.post.createMany({ data: postRows });
  await ctx.prisma.unitSupportLanguage.createMany({ data: supportRows });
  for (const post of plannedPosts) {
    await ctx.sync.post(post.id);
  }

  const roots = plannedPosts.filter((post) => post.depth === 0);
  for (const [index, post] of roots.slice(0, 3).entries()) {
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
  sortPath: string;
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
      sortPath: String(rootIndex + 1).padStart(4, "0"),
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
        sortPath: `${parent.sortPath}.${String(childIndex).padStart(4, "0")}`,
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

  await ctx.prisma.unitHistoryClock.create({
    data: { unitId, nextSequence: BigInt(121) },
  });
  await ctx.prisma.historyOutbox.createMany({
    data: Array.from({ length: 120 }, (_, index) => ({
      unitId,
      sequence: BigInt(index + 1),
      actorUserId: user.userId,
      category: index % 2 === 0 ? "revision" : "structure",
      payload: {
        source: "factory",
        scenario: "large-history",
        index,
      },
      status: "pending",
    })),
  });

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
  await ctx.prisma.unit.create({
    data: {
      id: shelfId,
      type: UnitType.SHELF,
      userId: user.userId,
      slugScope: user.userId,
      status: UnitStatus.PUBLISHED,
      licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
      defaultLanguage: DEFAULT_LANGUAGE,
      publishedAt: new Date(),
      shelf: {
        create: {
          kindKey: "factory-complex",
          extra: { viewMode: "nested", sortBy: "manual" },
        },
      },
      translations: {
        create: {
          language: DEFAULT_LANGUAGE,
          title: "Factory Scenario: Complex Shelf",
        },
      },
      supportLanguages: {
        create: { language: DEFAULT_LANGUAGE, isPrimary: true },
      },
    },
  });

  let prev: string | undefined;
  const selected = workIds.slice(0, Math.min(workIds.length, 48));
  const shelfRows = selected.map((unitId, index) => {
    const position = generateBetween(prev, undefined);
    prev = position;
    return {
      shelfId,
      unitId,
      kind: index % 3 === 0 ? "book" : index % 3 === 1 ? "game" : "media",
      position,
    };
  });
  await ctx.prisma.shelfUnit.createMany({
    data: shelfRows,
    skipDuplicates: true,
  });
  await ctx.prisma.shelfUnitRelation.createMany({
    data: selected.slice(1, 20).map((childUnitId, index) => ({
      shelfId,
      parentUnitId: selected[index]!,
      childUnitId,
      role: index % 2 === 0 ? "sequel" : "related",
    })),
    skipDuplicates: true,
  });
  await ctx.prisma.shelf.update({
    where: { unitId: shelfId },
    data: { itemCount: shelfRows.length },
  });

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

async function runUnitWorkDomain(ctx: SeedCtx): Promise<SeedResult> {
  const result = createSeedResult();
  const user = await getScenarioUser(ctx);
  const [workTagId, releaseLocalTagId] = await Promise.all([
    createScenarioTag(ctx, "Factory Work-Domain Shared Tag"),
    createScenarioTag(ctx, "Factory Release-Local Tag"),
  ]);
  const sourceSiteEntityUnitId = await ensureFactoryExternalRefSource(ctx);

  const hiddenWorkId = await createWorkDomainBookUnit(ctx, {
    userId: user.userId,
    title: "Factory Scenario: Hidden Work Domain",
    language: DEFAULT_LANGUAGE,
    visibility: UnitVisibility.PRIVATE,
    pageCount: 0,
    textLength: 0,
  });

  const releases = [
    {
      key: "primary",
      title: "Factory Work Domain: Primary Release",
      language: DEFAULT_LANGUAGE,
      displayPolicy: UnitWorkDisplayPolicy.PRIMARY,
      position: "a0",
      specialLabel: "Work-domain primary release",
      externalId: "factory-work-domain-primary",
    },
    {
      key: "translation",
      title: "工廠 Work Domain：繁中譯本",
      language: LANGUAGES.ZH_HANT,
      displayPolicy: UnitWorkDisplayPolicy.PRIMARY,
      position: "b0",
      specialLabel: "Work-domain translation release",
      externalId: "factory-work-domain-zh-hant",
    },
    {
      key: "secondary",
      title: "Factory Work Domain: Secondary Edition",
      language: LANGUAGES.JA,
      displayPolicy: UnitWorkDisplayPolicy.SECONDARY,
      position: "c0",
      specialLabel: "Work-domain secondary release",
      externalId: "factory-work-domain-secondary",
    },
    {
      key: "hidden",
      title: "Factory Work Domain: Hidden Draftlike Release",
      language: DEFAULT_LANGUAGE,
      displayPolicy: UnitWorkDisplayPolicy.HIDDEN_BY_DEFAULT,
      position: "d0",
      specialLabel: "Work-domain hidden-by-default release",
      externalId: "factory-work-domain-hidden",
    },
  ] as const;

  const releaseUnitIds: Record<(typeof releases)[number]["key"], string> =
    {} as Record<(typeof releases)[number]["key"], string>;

  for (const release of releases) {
    const unitId = await createWorkDomainBookUnit(ctx, {
      userId: user.userId,
      title: release.title,
      language: release.language,
      sourceUnitId: hiddenWorkId,
    });
    releaseUnitIds[release.key] = unitId;
    await ctx.prisma.unitWork.create({
      data: {
        unitId,
        workUnitId: hiddenWorkId,
        role: UnitWorkRole.RELEASE,
        language: release.language,
        position: release.position,
        displayPolicy: release.displayPolicy,
      },
    });
    await seedChaptersForBook(ctx, unitId, user.userId, {
      count: { min: 3, max: 3, target: 3 },
      unitProbability: 1,
      multiLinkChapterProbability: 0,
    });
    await ctx.prisma.unitExternalRef.upsert({
      where: {
        sourceSiteEntityUnitId_externalKind_externalId: {
          sourceSiteEntityUnitId,
          externalKind: "book",
          externalId: release.externalId,
        },
      },
      create: {
        unitId,
        sourceSiteEntityUnitId,
        externalKind: "book",
        externalId: release.externalId,
        canonicalUrl: `https://factory.rezics.local/books/${release.externalId}`,
      },
      update: {
        unitId,
        canonicalUrl: `https://factory.rezics.local/books/${release.externalId}`,
      },
    });
  }

  await ctx.prisma.unitTag.createMany({
    data: [
      { unitId: hiddenWorkId, tagUnitId: workTagId },
      { unitId: releaseUnitIds.primary, tagUnitId: releaseLocalTagId },
      { unitId: releaseUnitIds.translation, tagUnitId: releaseLocalTagId },
    ],
    skipDuplicates: true,
  });

  const reviewSpecs = [
    {
      targetUnitId: releaseUnitIds.primary,
      title: "Factory review of primary release",
      content: "Primary release review for work-domain feed aggregation.",
    },
    {
      targetUnitId: releaseUnitIds.translation,
      title: "Factory review of translation release",
      content: "Translation release review for same-work feed aggregation.",
    },
  ];

  const reviewUnitIds: string[] = [];
  for (const spec of reviewSpecs) {
    const postUnitId = randomUUID();
    await ctx.prisma.unit.create({
      data: {
        id: postUnitId,
        type: UnitType.POST,
        userId: user.userId,
        slugScope: user.userId,
        status: UnitStatus.PUBLISHED,
        visibility: UnitVisibility.PUBLIC,
        licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
        defaultLanguage: DEFAULT_LANGUAGE,
        publishedAt: new Date(),
        translations: {
          create: { language: DEFAULT_LANGUAGE, title: spec.title },
        },
        supportLanguages: {
          create: { language: DEFAULT_LANGUAGE, isPrimary: true },
        },
        post: {
          create: {
            authorUserId: user.userId,
            targetUnitId: spec.targetUnitId,
            rootTargetUnitId: spec.targetUnitId,
            rootTargetUnitType: UnitType.BOOK,
            kind: PostKind.REVIEW,
            content: markdownContentDoc(spec.content) as Prisma.InputJsonValue,
            depth: 0,
            sortPath: "0001",
          },
        },
      },
    });
    await ctx.prisma.unitWork.create({
      data: {
        unitId: postUnitId,
        workUnitId: hiddenWorkId,
        role: UnitWorkRole.REVIEW,
        displayPolicy: UnitWorkDisplayPolicy.PRIMARY,
      },
    });
    reviewUnitIds.push(postUnitId);
  }

  const shelfId = randomUUID();
  await ctx.prisma.unit.create({
    data: {
      id: shelfId,
      type: UnitType.SHELF,
      userId: user.userId,
      slugScope: user.userId,
      status: UnitStatus.PUBLISHED,
      visibility: UnitVisibility.PUBLIC,
      licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
      defaultLanguage: DEFAULT_LANGUAGE,
      publishedAt: new Date(),
      translations: {
        create: {
          language: DEFAULT_LANGUAGE,
          title: "Factory Scenario: Work-Domain Shelf",
        },
      },
      supportLanguages: {
        create: { language: DEFAULT_LANGUAGE, isPrimary: true },
      },
      shelf: {
        create: {
          kindKey: "factory-work-domain",
          itemCount: 3,
          extra: { scenario: "unit-work-domain" },
        },
      },
    },
  });

  let prev: string | undefined;
  const shelfRows = [
    releaseUnitIds.primary,
    releaseUnitIds.translation,
    releaseUnitIds.hidden,
  ].map((unitId) => {
    const position = generateBetween(prev, undefined);
    prev = position;
    return { shelfId, unitId, kind: "book", position };
  });
  await ctx.prisma.shelfUnit.createMany({
    data: shelfRows,
    skipDuplicates: true,
  });
  await ctx.prisma.unitWork.create({
    data: {
      unitId: shelfId,
      workUnitId: hiddenWorkId,
      role: UnitWorkRole.SHELF,
      displayPolicy: UnitWorkDisplayPolicy.PRIMARY,
    },
  });

  await ctx.sync.content(hiddenWorkId);
  await Promise.all([
    ...Object.values(releaseUnitIds).map((unitId) => ctx.sync.content(unitId)),
    ...reviewUnitIds.map((unitId) => ctx.sync.post(unitId)),
    ctx.sync.content(shelfId),
    ctx.sync.contentContainedUnits(shelfId),
  ]);

  addSpecialSeedTarget(result, {
    label: "Work-domain hidden work",
    scenario: "unit-work-domain",
    unitType: UnitType.BOOK,
    unitId: hiddenWorkId,
    notes: "Private canonical work Unit with work-level tags.",
  });
  addSpecialSeedTarget(result, {
    label: "Work-domain primary release",
    scenario: "unit-work-domain",
    unitType: UnitType.BOOK,
    unitId: releaseUnitIds.primary,
  });
  addSpecialSeedTarget(result, {
    label: "Work-domain translation release",
    scenario: "unit-work-domain",
    unitType: UnitType.BOOK,
    unitId: releaseUnitIds.translation,
  });
  addSpecialSeedTarget(result, {
    label: "Work-domain hidden-by-default release",
    scenario: "unit-work-domain",
    unitType: UnitType.BOOK,
    unitId: releaseUnitIds.hidden,
  });
  addSpecialSeedTarget(result, {
    label: "Work-domain shelf",
    scenario: "unit-work-domain",
    unitType: UnitType.SHELF,
    unitId: shelfId,
  });

  return result;
}

export const FACTORY_SCENARIOS: Record<FactoryScenarioName, FactoryScenario> = {
  "large-post-tree": {
    name: "large-post-tree",
    description: "Large deterministic post tree for thread pagination.",
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
  "unit-work-domain": {
    name: "unit-work-domain",
    description:
      "Hidden work with same-work releases, inherited tags, reviews, shelf, and external refs.",
    defaultSelected: true,
    run: runUnitWorkDomain,
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
