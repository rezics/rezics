import { randomUUID } from "node:crypto";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PUBLICATION_LICENSE_SLUG,
} from "@rezics/contract";
import { PostKind, UnitStatus, UnitType } from "../generated/client.js";
import { generateBetween } from "../../src/shelf/fractional-index";
import { seedChaptersForBook } from "./books.js";
import { addSeedManifestEntry, createSeedResult } from "./manifest.js";
import type { SeedCtx } from "./strategy.js";
import type { CreatedUser, SeedResult } from "./types.js";

export const FACTORY_SCENARIO_NAMES = [
  "large-post-tree",
  "large-content-tree",
  "large-history",
  "complex-shelf",
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

  addSeedManifestEntry(result, {
    label: "Large post tree target",
    scenario: "large-post-tree",
    unitType: UnitType.BOOK,
    unitId: targetUnitId,
    syncTargets: ["content"],
  });

  const rootCount = 8;
  const repliesPerRoot = 18;
  const now = new Date();
  const roots = Array.from({ length: rootCount }, () => randomUUID());
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
    body: string;
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

  const pushPost = (
    unitId: string,
    post: Omit<(typeof postRows)[number], "unitId" | "authorUserId">,
  ) => {
    unitRows.push({
      id: unitId,
      type: UnitType.POST,
      userId: user.userId,
      slugScope: user.userId,
      status: UnitStatus.PUBLISHED,
      licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
      defaultLanguage: DEFAULT_LANGUAGE,
      publishedAt: now,
    });
    postRows.push({
      unitId,
      authorUserId: user.userId,
      ...post,
    });
    supportRows.push({
      unitId,
      language: DEFAULT_LANGUAGE,
      isPrimary: true,
    });
  };

  for (const [rootIndex, rootId] of roots.entries()) {
    const rootSortPath = String(rootIndex + 1).padStart(4, "0");
    pushPost(rootId, {
      targetUnitId,
      rootPostUnitId: rootId,
      kind: PostKind.POST,
      body: `Root ${rootIndex + 1} for the large post tree scenario.`,
      depth: 0,
      sortPath: rootSortPath,
      replyCount: repliesPerRoot,
      directReplyCount: 6,
      lastReplyAt: now,
    });

    for (let replyIndex = 0; replyIndex < repliesPerRoot; replyIndex++) {
      const depth = replyIndex < 6 ? 1 : 2 + (replyIndex % 3);
      pushPost(randomUUID(), {
        targetUnitId,
        rootPostUnitId: rootId,
        parentPostUnitId: rootId,
        kind: PostKind.POST,
        body: `Reply ${replyIndex + 1} under root ${rootIndex + 1}.`,
        depth,
        sortPath: `${rootSortPath}.${String(replyIndex + 1).padStart(4, "0")}`,
      });
    }
  }

  await ctx.prisma.unit.createMany({ data: unitRows });
  await ctx.prisma.post.createMany({ data: postRows });
  await ctx.prisma.unitSupportLanguage.createMany({ data: supportRows });

  for (const [index, unitId] of roots.slice(0, 3).entries()) {
    addSeedManifestEntry(result, {
      label: `Large post tree root ${index + 1}`,
      scenario: "large-post-tree",
      unitType: UnitType.POST,
      unitId,
      syncTargets: ["post"],
    });
  }

  return result;
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

  addSeedManifestEntry(result, {
    label: "Large content tree root",
    scenario: "large-content-tree",
    unitType: UnitType.BOOK,
    unitId: bookUnitId,
    syncTargets: ["content"],
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

  addSeedManifestEntry(result, {
    label: "Large history unit",
    scenario: "large-history",
    unitType: UnitType.BOOK,
    unitId,
    syncTargets: ["content"],
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

  addSeedManifestEntry(result, {
    label: "Complex shelf",
    scenario: "complex-shelf",
    unitType: UnitType.SHELF,
    unitId: shelfId,
    syncTargets: ["content", "content-contained-units"],
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
};

export async function runFactoryScenarios(
  ctx: SeedCtx,
  scenarioNames: FactoryScenarioName[],
): Promise<SeedResult> {
  const result = createSeedResult();
  for (const name of scenarioNames) {
    const scenario = FACTORY_SCENARIOS[name];
    const scenarioResult = await scenario.run(ctx);
    for (const entry of scenarioResult.manifest) {
      addSeedManifestEntry(result, entry);
    }
  }
  return result;
}
