import { describe, expect, test } from "bun:test";
import {
  ZONE_MENU_MAX_DEPTH,
  type ZoneConfigV1,
  type ZoneMenuNode,
  zoneConfigV1Schema,
} from "@rezics/contract";
import { Value } from "@sinclair/typebox/value";
import { OFFICIAL_ZONE_DEFINITIONS } from "../seed/infra/seed-official-zones";
import {
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
// path throws on invalid envelopes, so every config builder must produce
// schema-valid output; these walkers re-check the structural invariants the
// service enforces (unique section ids incl. nested, menu refs, depth).
// 工厂写入绕过 zone service 的写入校验，而读取路径会对非法信封抛错，
// 因此每个配置构造器都必须产出通过 schema 的结果；这些遍历器复查
// service 强制的结构不变量（含嵌套的分区 id 唯一、菜单引用、深度）。
function collectSectionEntries(
  config: ZoneConfigV1,
): Array<{ id: string; kind: string }> {
  const entries: Array<{ id: string; kind: string }> = [];
  for (const page of [
    config.pages.home,
    config.pages.search,
    config.pages.feed,
  ]) {
    for (const section of page?.sections ?? []) {
      entries.push({ id: section.id, kind: section.kind });
      if (section.kind === "tabs") {
        for (const tab of section.tabs) {
          for (const inner of tab.sections) {
            entries.push({ id: inner.id, kind: inner.kind });
          }
        }
      }
      if (section.kind === "columns") {
        for (const inner of [...section.side, ...section.main]) {
          entries.push({ id: inner.id, kind: inner.kind });
          if (inner.kind === "tabs") {
            for (const tab of inner.tabs) {
              for (const pane of tab.sections) {
                entries.push({ id: pane.id, kind: pane.kind });
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

function expectValidZoneConfig(config: ZoneConfigV1) {
  expect(Value.Check(zoneConfigV1Schema, config)).toBe(true);

  const sectionIds = collectSectionEntries(config).map((entry) => entry.id);
  expect(new Set(sectionIds).size).toBe(sectionIds.length);

  const menuIds = config.menus.map((menu) => menu.id);
  expect(new Set(menuIds).size).toBe(menuIds.length);
  expect(menuIds).toContain(config.header.menuId);
  for (const menu of config.menus) {
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
      "toaru-wiki",
      "showcase-feed",
    ]);

    for (const name of FACTORY_SCENARIO_NAMES) {
      expect(FACTORY_SCENARIOS[name].defaultSelected).toBe(true);
      expect(typeof FACTORY_SCENARIOS[name].run).toBe("function");
      expect(FACTORY_SCENARIOS[name].description.length).toBeGreaterThan(0);
    }
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
      collectSectionEntries(config).map((entry) => entry.kind),
    );
    expect([...kinds].toSorted()).toEqual([
      "collection",
      "columns",
      "feed",
      "hero",
      "query",
      "richText",
      "stats",
      "tabs",
    ]);

    const richTextRefs = JSON.stringify(config);
    for (const fragmentId of Object.values(ids.fragments)) {
      expect(richTextRefs).toContain(fragmentId);
    }
  });

  test("scopes context and boundary to the wiki realm", () => {
    const config = buildToaruZoneConfig(buildIds());
    expect(config.context).toEqual({
      kind: "realm",
      realmUnitId: "realm-toaru",
    });
    expect(config.filters).toEqual({ realm: "context" });
  });
});

describe("official zone definitions", () => {
  test("every official zone config is schema-valid with a global context", () => {
    expect(OFFICIAL_ZONE_DEFINITIONS).toHaveLength(3);
    for (const definition of OFFICIAL_ZONE_DEFINITIONS) {
      expectValidZoneConfig(definition.config);
      expect(definition.config.context).toEqual({ kind: "global" });
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
      for (const entry of collectSectionEntries(config)) kinds.add(entry.kind);
    }
    // richText needs WIKI fragment posts; the toaru-wiki scenario covers it.
    // richText 需要 WIKI 片段帖子；由 toaru-wiki 情境覆盖。
    expect([...kinds].toSorted()).toEqual([
      "collection",
      "columns",
      "feed",
      "hero",
      "query",
      "stats",
      "tabs",
    ]);
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
