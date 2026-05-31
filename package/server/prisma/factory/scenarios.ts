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
  "wiki-zone-experience",
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
      book: { create: { textLength: 120000 } },
      translations: { create: { language: DEFAULT_LANGUAGE, title } },
      supportLanguages: {
        create: { language: DEFAULT_LANGUAGE, isPrimary: true },
      },
    },
  });
  await ctx.prisma.contentStructure.create({ data: { ownerUnitId: id } });
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

async function createScenarioLabel(
  ctx: SeedCtx,
  title: string,
): Promise<string> {
  const id = randomUUID();
  await ctx.prisma.unit.create({
    data: {
      id,
      type: UnitType.LABEL,
      slugScope: ctx.slugScopes.zone,
      status: UnitStatus.PUBLISHED,
      visibility: UnitVisibility.PUBLIC,
      defaultLanguage: DEFAULT_LANGUAGE,
      isLanguageNeutral: true,
      translations: { create: { language: DEFAULT_LANGUAGE, title } },
      supportLanguages: {
        create: { language: DEFAULT_LANGUAGE, isPrimary: true },
      },
    },
  });
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
  await ctx.prisma.unit.create({
    data: {
      id,
      type: UnitType.ENTITY,
      slugScope: ctx.slugScopes.entity,
      status: UnitStatus.PUBLISHED,
      visibility: UnitVisibility.PUBLIC,
      defaultLanguage: DEFAULT_LANGUAGE,
      translations: {
        create: {
          language: DEFAULT_LANGUAGE,
          title: input.title,
          summary: `${input.title} fixture entity for wiki Zone sections.`,
        },
      },
      supportLanguages: {
        create: { language: DEFAULT_LANGUAGE, isPrimary: true },
      },
      entity: {
        create: {
          kind: input.kind,
          verified: true,
          eligibleSubjectRoles: input.subjectRoles,
        },
      },
    },
  });
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
  await ctx.prisma.book.create({
    data: {
      unit: {
        create: {
          id: unitId,
          type: UnitType.BOOK,
          userId: input.userId,
          slugScope: input.userId,
          status: UnitStatus.PUBLISHED,
          visibility: input.visibility ?? UnitVisibility.PUBLIC,
          licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
          defaultLanguage: input.language,
          publishedAt: new Date(),
          translations: {
            create: {
              language: input.language,
              title: input.title,
              summary: `${input.title} factory fixture.`,
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
    },
  });
  await ctx.prisma.contentStructure.create({ data: { ownerUnitId: unitId } });
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
  // `Post.path` is Unsupported("ltree"); set every planned path in one bulk
  // statement after the typed createMany (zero-padded numeric labels are valid
  // ltree tokens).
  await ctx.prisma.$executeRaw`
    UPDATE "Post" AS p
    SET "path" = data.path::ltree
    FROM (
      SELECT
        unnest(${plannedPosts.map((node) => node.id)}::uuid[]) AS unit_id,
        unnest(${plannedPosts.map((node) => node.path)}::text[]) AS path
    ) AS data
    WHERE p."unitId" = data.unit_id
  `;
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
  const primary =
    input.translations.find(
      (item) => item.language === input.defaultLanguage,
    ) ?? input.translations[0]!;
  const postUnitId = randomUUID();
  await ctx.prisma.unit.create({
    data: {
      id: postUnitId,
      type: UnitType.POST,
      userId: input.userId,
      slugScope: input.userId,
      status: UnitStatus.PUBLISHED,
      visibility: UnitVisibility.PUBLIC,
      licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
      defaultLanguage: input.defaultLanguage,
      publishedAt: input.publishedAt,
      updatedAt: input.publishedAt,
      translations: {
        create: input.translations.map((item) => ({
          language: item.language,
          title: item.title,
          summary: `${item.title} wiki fixture.`,
        })),
      },
      supportLanguages: {
        create: input.translations.map((item, index) => ({
          language: item.language,
          isPrimary: item.language === input.defaultLanguage,
          sortOrder: index,
        })),
      },
      contentTranslations: {
        create: input.translations.map((item) => ({
          language: item.language,
          content: markdownContentDoc(item.body) as Prisma.InputJsonValue,
          status: "PUBLISHED",
          authorUserId: input.userId,
          provenance: { importedFrom: "factory-wiki-zone-scenario" },
        })),
      },
      post: {
        create: {
          authorUserId: input.userId,
          targetUnitId: input.targetUnitId,
          kind: PostKind.WIKI,
          content: markdownContentDoc(primary.body) as Prisma.InputJsonValue,
          depth: 0,
          createdAt: input.publishedAt,
          updatedAt: input.publishedAt,
        },
      },
    },
  });
  await ctx.prisma
    .$executeRaw`UPDATE "Post" SET "path" = '0001'::ltree WHERE "unitId" = ${postUnitId}::uuid`;
  await ctx.prisma.unitRealm.create({
    data: {
      realmUnitId: input.realmUnitId,
      unitId: postUnitId,
    },
  });
  await ctx.sync.post(postUnitId);
  return postUnitId;
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
  await ctx.prisma.unit.create({
    data: {
      id: zoneUnitId,
      type: UnitType.ZONE,
      slug: input.slug,
      slugScope: ctx.slugScopes.zone,
      status: UnitStatus.PUBLISHED,
      visibility: UnitVisibility.PUBLIC,
      defaultLanguage: DEFAULT_LANGUAGE,
      publishedAt: new Date(),
      translations: {
        create: {
          language: DEFAULT_LANGUAGE,
          title: input.title,
          description: markdownContentDoc(
            `${input.title} fixture portal for wiki Zone verification.`,
          ) as Prisma.InputJsonValue,
        },
      },
      supportLanguages: {
        create: { language: DEFAULT_LANGUAGE, isPrimary: true },
      },
      zone: {
        create: {
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
          } satisfies Prisma.InputJsonValue,
        },
      },
    },
  });
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
  await ctx.prisma.unit.create({
    data: {
      id: realmUnitId,
      type: UnitType.REALM,
      userId: user.userId,
      slugScope: ctx.slugScopes.realm,
      status: UnitStatus.PUBLISHED,
      visibility: UnitVisibility.PUBLIC,
      defaultLanguage: DEFAULT_LANGUAGE,
      publishedAt: new Date(),
      translations: {
        create: {
          language: DEFAULT_LANGUAGE,
          title: "Factory Scenario: Wiki Realm",
        },
      },
      supportLanguages: {
        create: { language: DEFAULT_LANGUAGE, isPrimary: true },
      },
      realm: {
        create: {
          isPublic: true,
          isOfficial: true,
          extra: { scenario: "wiki-zone-experience" },
        },
      },
    },
  });
  await ctx.prisma.realmMember.create({
    data: { realmUnitId, userId: user.userId, roleKey: "owner" },
  });
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
  await ctx.prisma.subjectAttribution.createMany({
    data: [
      {
        unitId: wikiEntryUnitId,
        entityId: characterId,
        role: "primary_character",
      },
      { unitId: wikiEntryUnitId, entityId: locationId, role: "setting" },
      { unitId: releaseUnitId, entityId: factionId, role: "about" },
    ],
    skipDuplicates: true,
  });

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
            language: DEFAULT_LANGUAGE,
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
  await ctx.prisma.unitTag.createMany({
    data: [
      ...postIds.map((unitId) => ({ unitId, tagUnitId: loreTagId })),
      { unitId: postIds.at(-1)!, tagUnitId: stubTagId },
    ],
    skipDuplicates: true,
  });

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
  await ctx.prisma.realm.update({
    where: { unitId: realmUnitId },
    data: {
      extra: {
        scenario: "wiki-zone-experience",
        wikiZoneUnitId: zoneIds[0],
      },
    },
  });

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
  "wiki-zone-experience": {
    name: "wiki-zone-experience",
    description:
      "Official wiki realm with translated WIKI posts, labels, entities, and all wiki Zone templates.",
    defaultSelected: true,
    run: runWikiZoneExperience,
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
