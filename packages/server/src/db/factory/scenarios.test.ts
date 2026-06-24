import { describe, expect, test } from "bun:test";
import {
  ZONE_MENU_MAX_DEPTH,
  type ZoneMenuNode,
  type ZonePage as ZonePageConfig,
  type ZonePageSection,
  type ZoneStageChildSection,
  zoneBoundaryEnvelopeSchema,
  zoneNavEnvelopeSchema,
  zonePageEnvelopeSchema,
  zoneThemeEnvelopeSchema,
} from "@rezics/contract";
import { Value } from "@sinclair/typebox/value";
import { OFFICIAL_ZONE_DEFINITIONS } from "../seed/infra/seed-official-zones";
import {
  buildComplexShelfItemRows,
  buildLargePostTreePlan,
  buildShowcaseFeedPlan,
  buildToaruZoneConfig,
  FACTORY_SCENARIO_NAMES,
  FACTORY_SCENARIOS,
  TOARU_ENTITIES,
  TOARU_LABELS,
  type ToaruEntityKey,
  type ToaruLabelKey,
  type ToaruZoneConfigIds,
} from "./scenarios";
import { PostKind } from "./storage-values";
import {
  buildZoneFixtureConfig,
  ZONE_FIXTURE_KINDS,
  type ZoneFixtureRefs,
} from "./zones";

// Factory writes bypass the zone service's write validation while the read
// path throws on invalid envelopes, so every split-envelope builder must
// produce schema-valid output; these walkers re-check the structural
// invariants the service enforces (page-local section ids, menu refs, depth).
// 工厂写入绕过 zone service 的写入校验，而读取路径会对非法信封抛错，
// 因此每个拆分信封构造器都必须产出通过 schema 的结果；这些遍历器复查
// service 强制的结构不变量（页面内分区 id、菜单引用、深度）。
function collectSectionEntries(
  page: ZonePageConfig,
): Array<ZonePageSection | ZoneStageChildSection> {
  const entries: Array<ZonePageSection | ZoneStageChildSection> = [];
  for (const section of page.sections) {
    entries.push(section);
    if (section.kind === "stage") {
      for (const child of section.sections) {
        entries.push(child);
        if (child.kind === "tabs") {
          for (const tab of child.tabs) {
            for (const inner of tab.sections) entries.push(inner);
          }
        }
        if (child.kind === "columns") {
          for (const column of child.columns) {
            for (const inner of column.sections) entries.push(inner);
          }
        }
      }
    }
    if (section.kind === "tabs") {
      for (const tab of section.tabs) {
        for (const inner of tab.sections) {
          entries.push(inner);
        }
      }
    }
    if (section.kind === "columns") {
      for (const column of section.columns) {
        for (const inner of column.sections) {
          entries.push(inner);
          if (inner.kind === "tabs") {
            for (const tab of inner.tabs) {
              for (const pane of tab.sections) {
                entries.push(pane);
              }
            }
          }
        }
      }
    }
  }
  return entries;
}

function menuDepth(nodes: readonly ZoneMenuNode[]): number {
  let depth = 0;
  for (const node of nodes) {
    depth = Math.max(depth, 1 + (node.children ? menuDepth(node.children) : 0));
  }
  return depth;
}

function expectValidZoneConfig(config: {
  boundary: unknown;
  nav: {
    menus: { id: string; nodes: ZoneMenuNode[] }[];
    header: { menuId: string };
  };
  theme: unknown;
  pages: Array<{ config: ZonePageConfig }>;
  homePageId: string;
}) {
  expect(Value.Check(zoneBoundaryEnvelopeSchema, config.boundary)).toBe(true);
  expect(Value.Check(zoneNavEnvelopeSchema, config.nav)).toBe(true);
  expect(Value.Check(zoneThemeEnvelopeSchema, config.theme)).toBe(true);
  expect(config.pages.some((page) => page.config === undefined)).toBe(false);

  for (const page of config.pages) {
    expect(Value.Check(zonePageEnvelopeSchema, page.config)).toBe(true);
    const sectionIds = collectSectionEntries(page.config).map(
      (entry) => entry.id,
    );
    expect(new Set(sectionIds).size).toBe(sectionIds.length);
  }

  expect(config.pages.map((page) => page.config).length).toBeGreaterThan(0);

  const menuIds = config.nav.menus.map((menu) => menu.id);
  expect(new Set(menuIds).size).toBe(menuIds.length);
  expect(menuIds).toContain(config.nav.header.menuId);
  for (const menu of config.nav.menus) {
    expect(menuDepth(menu.nodes)).toBeLessThanOrEqual(ZONE_MENU_MAX_DEPTH);
  }
}

describe("factory scenarios", () => {
  test("registry exposes every scenario with defaults and runners", () => {
    expect(FACTORY_SCENARIO_NAMES).toEqual([
      "large-post-tree",
      "large-content-tree",
      "large-history",
      "complex-shelf",
      "toaru",
      "showcase-feed",
    ]);

    for (const name of FACTORY_SCENARIO_NAMES) {
      expect(FACTORY_SCENARIOS[name].defaultSelected).toBe(true);
      expect(typeof FACTORY_SCENARIOS[name].run).toBe("function");
      expect(FACTORY_SCENARIOS[name].description.length).toBeGreaterThan(0);
    }
  });
});

describe("buildComplexShelfItemRows", () => {
  test("builds paginated roots with contract-valid child roles", () => {
    const rows = buildComplexShelfItemRows({
      shelfId: "shelf-complex",
      roots: Array.from({ length: 48 }, (_, index) => ({
        itemId: `root-${index}`,
        kind: "book",
      })),
      variants: Array.from({ length: 8 }, (_, index) => ({
        itemId: `variant-${index}`,
        kind: "book",
      })),
      reviews: Array.from({ length: 24 }, (_, index) => ({
        itemId: `review-${index}`,
        kind: "review",
      })),
      tags: Array.from({ length: 10 }, (_, index) => ({
        itemId: `tag-${index}`,
        kind: "tag",
      })),
      comments: Array.from({ length: 8 }, (_, index) => ({
        itemType: "comment",
        itemId: `comment-${index}`,
        kind: "comment",
      })),
      annotations: Array.from({ length: 6 }, (_, index) => ({
        itemId: `annotation-${index}`,
        kind: "post",
      })),
    });

    const roots = rows.filter((row) => !row.parentItemId);
    const itemKeys = rows.map((row) => `${row.itemType}:${row.itemId}`);
    const childRoles = new Set(
      rows
        .map((row) => row.parentRole)
        .filter((role): role is NonNullable<typeof role> => Boolean(role)),
    );

    expect(roots).toHaveLength(48);
    expect(rows.length).toBeGreaterThan(90);
    expect(new Set(itemKeys).size).toBe(rows.length);
    expect(childRoles).toEqual(
      new Set(["review", "variant", "comment", "tag", "annotation"]),
    );
    expect(
      rows.every((row) =>
        row.parentRole
          ? ["review", "variant", "comment", "tag", "annotation"].includes(
              row.parentRole,
            )
          : true,
      ),
    ).toBe(true);
  });
});

describe("buildToaruZoneConfig", () => {
  function buildIds(): ToaruZoneConfigIds {
    return {
      realmUnitId: "realm-toaru",
      labels: Object.fromEntries(
        Object.keys(TOARU_LABELS).map((key) => [key, `label-${key}`]),
      ) as Record<ToaruLabelKey, string>,
      entities: Object.fromEntries(
        Object.keys(TOARU_ENTITIES).map((key) => [key, `entity-${key}`]),
      ) as Record<ToaruEntityKey, string>,
      bookUnitIds: ["book-1", "book-2", "book-3", "book-4", "book-5"],
      fragments: {
        welcome: "fragment-welcome",
        spoilerNotice: "fragment-spoiler",
        news: "fragment-news",
        didYouKnow: "fragment-dyk",
      },
    };
  }

  test("produces a schema-valid config with unique section ids", () => {
    expectValidZoneConfig(buildToaruZoneConfig(buildIds()));
  });

  test("exercises every section kind including richText fragments", () => {
    const ids = buildIds();
    const config = buildToaruZoneConfig(ids);
    const kinds = new Set(
      config.pages.flatMap((page) =>
        collectSectionEntries(page.config).map((entry) => entry.kind),
      ),
    );
    expect([...kinds].toSorted()).toEqual([
      "actions",
      "collection",
      "columns",
      "query",
      "richText",
      "sources",
      "stage",
      "stats",
      "stream",
      "tabs",
      "zoneInfo",
    ]);

    const richTextRefs = JSON.stringify(config);
    for (const fragmentId of Object.values(ids.fragments)) {
      expect(richTextRefs).toContain(fragmentId);
    }
    expect(richTextRefs).toContain('"kind":"sources"');
    expect(richTextRefs).not.toContain("toaru.fandom.com");
  });

  test("scopes context and boundary to the Toaru realm", () => {
    const config = buildToaruZoneConfig(buildIds());
    expect(config.boundary.context).toEqual({
      kind: "realm",
      realmUnitId: "realm-toaru",
    });
    expect(config.boundary.filters).toEqual({ realm: "context" });
  });
});

describe("official zone definitions", () => {
  test("every official zone config is schema-valid with a global context", () => {
    expect(OFFICIAL_ZONE_DEFINITIONS).toHaveLength(4);
    for (const definition of OFFICIAL_ZONE_DEFINITIONS) {
      expectValidZoneConfig(definition.config);
      expect(definition.config.boundary.context).toEqual({ kind: "global" });
    }
  });
});

describe("zone fixture configs", () => {
  const refs: ZoneFixtureRefs = {
    contextRealmUnitId: null,
    workUnitIds: ["work-1", "work-2", "work-3", "work-4"],
    tagUnitIds: ["tag-1", "tag-2"],
    realmUnitIds: ["realm-1", "realm-2", "realm-3"],
  };

  test("every fixture kind builds a schema-valid config", () => {
    for (const kind of ZONE_FIXTURE_KINDS) {
      expectValidZoneConfig(
        buildZoneFixtureConfig(kind, {
          ...refs,
          contextRealmUnitId: kind === "columns-portal" ? "realm-1" : null,
        }),
      );
    }
  });

  test("fixture kinds together cover every section kind except richText", () => {
    const kinds = new Set<string>();
    for (const kind of ZONE_FIXTURE_KINDS) {
      const config = buildZoneFixtureConfig(kind, {
        ...refs,
        contextRealmUnitId: kind === "columns-portal" ? "realm-1" : null,
      });
      for (const page of config.pages) {
        for (const entry of collectSectionEntries(page.config)) {
          kinds.add(entry.kind);
        }
      }
    }
    // richText needs WIKI fragment posts; the toaru scenario covers it.
    // richText 需要 WIKI 片段帖子；由 toaru 情境覆盖。
    expect([...kinds].toSorted()).toEqual([
      "collection",
      "columns",
      "query",
      "stage",
      "stats",
      "stream",
      "tabs",
      "zoneInfo",
    ]);
  });

  test("fixture query sections cover dedicated realm and zone indexes", () => {
    const targets = new Set<string>();
    for (const kind of ZONE_FIXTURE_KINDS) {
      const config = buildZoneFixtureConfig(kind, {
        ...refs,
        contextRealmUnitId: kind === "columns-portal" ? "realm-1" : null,
      });
      for (const page of config.pages) {
        for (const entry of collectSectionEntries(page.config)) {
          if (entry.kind === "query") {
            targets.add(entry.query.target);
          }
        }
      }
    }
    expect(targets).toContain("realm");
    expect(targets).toContain("zone");
  });

  test("book portal fixture uses dynamic query rails for topic variety", () => {
    const config = buildZoneFixtureConfig("book-portal", refs);
    const sections = config.pages[0]!.config.sections;
    const querySections = collectSectionEntries(config.pages[0]!.config).filter(
      (section) => section.kind === "query",
    );
    const dynamicSections = querySections.filter(
      (section) => section.kind === "query" && section.dynamicTags,
    );

    expect(config.boundary.filters).toEqual({ types: ["BOOK"] });
    expect(sections.map((section) => section.kind)).toEqual([
      "stage",
      "query",
      "query",
      "query",
      "query",
      "query",
    ]);
    expect(dynamicSections).toHaveLength(3);
    expect(
      dynamicSections.every(
        (section) =>
          section.kind === "query" &&
          section.display === "carousel" &&
          section.query.target === "unit" &&
          section.dynamicTags?.groupId === "book-portal-topics",
      ),
    ).toBe(true);
  });
});

describe("buildShowcaseFeedPlan", () => {
  test("creates realm-scoped feed posts with review target context", () => {
    let nextId = 0;
    const plan = buildShowcaseFeedPlan({
      userId: "user-1",
      idFactory: () => `id-${++nextId}`,
      now: new Date("2026-06-05T12:00:00.000Z"),
    });

    expect(plan.works).toHaveLength(3);
    expect(plan.posts.map((post) => post.kind)).toEqual([
      PostKind.POST,
      PostKind.POST,
      PostKind.REVIEW,
      PostKind.REMARK,
      PostKind.EXCERPT,
    ]);

    const review = plan.posts.find((post) => post.kind === PostKind.REVIEW);
    const work = plan.works[0];
    expect(review).toBeDefined();
    expect(work).toBeDefined();
    if (!review || !work) throw new Error("Expected a review and a work");
    if (!review.targetUnitId) throw new Error("Expected review target unit");
    expect(review.targetUnitId).toBe(work.unitId);
    expect(review?.extra).toMatchObject({
      book: { id: work.unitId, title: work.title },
    });
    expect(plan.realmMembershipUnitIds).toContain(review.unitId);
    expect(plan.realmMembershipUnitIds).toContain(review.targetUnitId);
    expect(plan.shelves.length).toBeGreaterThanOrEqual(2);
    expect(plan.comments).toHaveLength(2);
    expect(plan.comments[0]).toMatchObject({
      rootUnitId: plan.posts[0]?.unitId,
      depth: 1,
      directReplyCount: 1,
      replyCount: 1,
    });
    expect(plan.comments[1]).toMatchObject({
      rootUnitId: plan.posts[0]?.unitId,
      parentCommentId: plan.comments[0]?.id,
      depth: 2,
    });
    expect(plan.posts.map((post) => post.publishedAt.getTime())).toStrictEqual(
      [...plan.posts]
        .map((post) => post.publishedAt.getTime())
        .sort((a, b) => b - a),
    );
  });
});

describe("buildLargePostTreePlan", () => {
  test("creates a real nested tree with coherent parent, depth, and path", () => {
    const nodes = buildLargePostTreePlan({
      rootCount: 2,
      repliesPerRoot: 18,
      maxDepth: 4,
      branchCap: 3,
    });
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const roots = nodes.filter((node) => node.parentId == null);

    expect(roots).toHaveLength(2);
    expect(nodes).toHaveLength(38);
    expect(Math.max(...nodes.map((node) => node.depth))).toBeGreaterThanOrEqual(
      3,
    );

    for (const node of nodes) {
      if (!node.parentId) {
        expect(node.depth).toBe(0);
        expect(node.rootId).toBe(node.id);
        continue;
      }

      const parent = byId.get(node.parentId);
      expect(parent).toBeDefined();
      expect(node.rootId).toBe(parent!.rootId);
      expect(node.depth).toBe(parent!.depth + 1);
      expect(node.path.startsWith(`${parent!.path}.`)).toBe(true);
    }
  });

  test("derives direct and total reply counts from the generated tree", () => {
    const nodes = buildLargePostTreePlan({
      rootCount: 1,
      repliesPerRoot: 18,
      maxDepth: 4,
      branchCap: 3,
    });

    for (const node of nodes) {
      const directChildren = nodes.filter(
        (candidate) => candidate.parentId === node.id,
      );
      const descendants = nodes.filter(
        (candidate) =>
          candidate.id !== node.id &&
          candidate.rootId === node.rootId &&
          candidate.path.startsWith(`${node.path}.`),
      );

      expect(node.directReplyCount).toBe(directChildren.length);
      expect(node.replyCount).toBe(descendants.length);
    }
  });
});
