import { describe, expect, mock, test } from "bun:test";
import type { FederatedSearchOptions } from "@rezics/contract";
import type { SearchClient } from "../../../search/client";
import { federatedSearch } from "./federated.service";

// Helper builds a fake SearchClient that records every per-index search and
// every multi-search call. Each search resolves with empty hits so the focus
// is on the orchestrator's filter and index allowlist behavior.
// 辅助函数构造一个假的 SearchClient，记录每次按索引的 search 调用以及每次
// multi-search 调用。每次 search 都返回空 hits，从而把关注点集中在编排器的
// filter 与索引白名单行为上。

interface CapturedSearch {
  index:
    | "content"
    | "posts"
    | "comments"
    | "realms"
    | "zones"
    | "users"
    | "entities"
    | "shelfItems";
  q: string;
  filter?: string;
  offset?: number;
  limit?: number;
  attributesToSearchOn?: string[];
}

interface CapturedMultiSearch {
  federation?: { offset?: number; limit?: number };
  queries: Array<{
    indexUid: string;
    q: string;
    filter?: string;
    weight?: number;
    page?: number;
    hitsPerPage?: number;
  }>;
}

function makeFakeClient(opts?: {
  multiSearchResponse?: any;
  perIndex?: (q: string, params: any) => any;
}): {
  client: SearchClient;
  calls: CapturedSearch[];
  multi: CapturedMultiSearch[];
} {
  const calls: CapturedSearch[] = [];
  const multi: CapturedMultiSearch[] = [];

  const captureIndex = (name: CapturedSearch["index"]) => ({
    search: mock(async (q: string, params: any = {}) => {
      calls.push({
        index: name,
        q,
        filter: params.filter,
        offset: params.offset,
        limit: params.limit,
        attributesToSearchOn: params.attributesToSearchOn,
      });
      const fn = opts?.perIndex;
      return (
        fn?.(q, { ...params, indexUid: name }) ?? {
          hits: [],
          estimatedTotalHits: 0,
          processingTimeMs: 1,
          query: q,
        }
      );
    }),
  });

  const meili = {
    multiSearch: mock(async (params: any) => {
      multi.push({
        federation: params.federation,
        queries: params.queries.map((qo: any) => ({
          indexUid: qo.indexUid,
          q: qo.q,
          filter: qo.filter,
          weight: qo.federationOptions?.weight,
          page: qo.page,
          hitsPerPage: qo.hitsPerPage,
        })),
      });
      return (
        opts?.multiSearchResponse ?? {
          results: params.queries.map((qo: any) => ({
            indexUid: qo.indexUid,
            hits: [],
            totalHits: 0,
            estimatedTotalHits: 0,
            processingTimeMs: 1,
            query: qo.q,
          })),
        }
      );
    }),
  };

  const client = {
    meili,
    contentIndex: captureIndex("content"),
    postIndex: captureIndex("posts"),
    commentIndex: captureIndex("comments"),
    realmIndex: captureIndex("realms"),
    zoneIndex: captureIndex("zones"),
    userIndex: captureIndex("users"),
    entityIndex: captureIndex("entities"),
    shelfItemIndex: captureIndex("shelfItems"),
  } as unknown as SearchClient;

  return { client, calls, multi };
}

describe("federatedSearch", () => {
  test("global all returns grouped sections with all permitted indexes", async () => {
    const { client, multi } = makeFakeClient();
    const opts: FederatedSearchOptions = {
      scope: { kind: "global" },
      category: "all",
      query: { keyword: "magic" },
    };

    const result = await federatedSearch(client, opts);

    expect(result.kind).toBe("grouped");
    if (result.kind !== "grouped") throw new Error("expected grouped");
    // The orchestrator issues one multiSearch with all permitted sub-queries.
    // 编排器只发起一次 multiSearch，包含所有允许的子查询。
    expect(multi.length).toBe(1);
    const indexUids = multi[0]!.queries.map((q) => q.indexUid).sort();
    // Books + 4 post sections + comments + shelves + realms + zones + users + entities = 11 sub-queries.
    // Books and shelves both target the "content" index.
    // Books + 4 个 post 分区 + comments + shelves + realms + zones + users + entities = 11 个子查询。
    // Books 和 shelves 都指向 "content" 索引。
    expect(indexUids.filter((u) => u === "content")).toHaveLength(2);
    expect(indexUids.filter((u) => u === "posts")).toHaveLength(4);
    expect(indexUids.filter((u) => u === "comments")).toHaveLength(1);
    expect(indexUids).toContain("realms");
    expect(indexUids).toContain("zones");
    expect(indexUids).toContain("users");
    expect(indexUids).toContain("entities");
  });

  test("book scope omits realms+users and constrains shelves by containedUnitIds", async () => {
    const { client, multi } = makeFakeClient();
    const opts: FederatedSearchOptions = {
      scope: { kind: "book", unitId: "b-9" },
      category: "all",
      query: { keyword: "epic" },
    };

    const result = await federatedSearch(client, opts);

    expect(result.kind).toBe("grouped");
    expect(multi.length).toBe(1);
    const queries = multi[0]!.queries;
    const indexUids = queries.map((q) => q.indexUid);
    // No realms, zones, users, or entities.
    // 不含 realms、zones、users、entities。
    expect(indexUids).not.toContain("realms");
    expect(indexUids).not.toContain("zones");
    expect(indexUids).not.toContain("users");
    expect(indexUids).not.toContain("entities");
    // The shelves sub-query (one of the two `content` targets) must include
    // the containedUnitIds clause for the book scope.
    // shelves 子查询（两个 `content` 目标之一）必须为 book 作用域包含
    // containedUnitIds 子句。
    const shelfQuery = queries.find(
      (q) => q.indexUid === "content" && q.filter?.includes('type = "SHELF"'),
    );
    expect(shelfQuery).toBeDefined();
    expect(shelfQuery!.filter).toContain('containedUnitIds = "b-9"');
    // Posts sub-queries must include targetUnitId.
    // posts 子查询必须包含 targetUnitId。
    const postsQueries = queries.filter((q) => q.indexUid === "posts");
    expect(postsQueries.length).toBeGreaterThan(0);
    for (const q of postsQueries) {
      expect(q.filter).toContain('targetUnitId = "b-9"');
    }
    const commentQuery = queries.find((q) => q.indexUid === "comments");
    expect(commentQuery?.filter).toContain('rootUnitId = "b-9"');
  });

  test("realm scope filters every queried index by realmIds", async () => {
    const { client, multi } = makeFakeClient();
    const opts: FederatedSearchOptions = {
      scope: { kind: "realm", realmId: "r-1" },
      category: "all",
      query: {},
    };

    await federatedSearch(client, opts);

    const queries = multi[0]!.queries;
    const indexUids = queries.map((q) => q.indexUid);
    expect(indexUids).not.toContain("realms");
    expect(indexUids).not.toContain("zones");
    expect(indexUids).not.toContain("users");
    for (const q of queries.filter(
      (qq) => qq.indexUid === "content" || qq.indexUid === "posts",
    )) {
      expect(q.filter).toContain('realmIds = "r-1"');
    }
    const commentQuery = queries.find((q) => q.indexUid === "comments");
    expect(commentQuery?.filter).toContain('realmUnitId = "r-1"');
  });

  test("zone scope permits content, posts, comments, and shelves without realm partition filters", async () => {
    const { client, multi } = makeFakeClient();
    const opts: FederatedSearchOptions = {
      scope: { kind: "zone", zoneUnitId: "zone-1" },
      category: "all",
      query: { type: ["BOOK"] },
    };

    await federatedSearch(client, opts);

    const queries = multi[0]!.queries;
    const indexUids = queries.map((q) => q.indexUid);
    expect(indexUids).toContain("content");
    expect(indexUids).toContain("posts");
    expect(indexUids).toContain("comments");
    expect(indexUids).not.toContain("realms");
    expect(indexUids).not.toContain("zones");
    expect(indexUids).not.toContain("users");
    expect(indexUids).not.toContain("entities");
    for (const q of queries.filter(
      (qq) => qq.indexUid === "content" || qq.indexUid === "posts",
    )) {
      expect(q.filter).not.toContain('realmIds = "zone-1"');
      expect(q.filter).not.toContain('zoneUnitId = "zone-1"');
    }
    const commentQuery = queries.find((q) => q.indexUid === "comments");
    expect(commentQuery?.filter).toBe("isLocked = false");
  });

  test("user scope filters content by userId, posts by authorUserId, and entities by ownerUnitId", async () => {
    const { client, multi } = makeFakeClient();
    const opts: FederatedSearchOptions = {
      scope: { kind: "user", userId: "u-3" },
      category: "all",
      query: {},
    };

    await federatedSearch(client, opts);

    const queries = multi[0]!.queries;
    for (const q of queries.filter((qq) => qq.indexUid === "content")) {
      expect(q.filter).toContain('userId = "u-3"');
    }
    for (const q of queries.filter((qq) => qq.indexUid === "posts")) {
      expect(q.filter).toContain('authorUserId = "u-3"');
    }
    const commentQuery = queries.find((q) => q.indexUid === "comments");
    expect(commentQuery?.filter).toContain('authorUserId = "u-3"');
    const entityQuery = queries.find((q) => q.indexUid === "entities");
    expect(entityQuery?.filter).toContain('ownerUnitId = "u-3"');
  });

  test("single entities category is global and omitted for book scope", async () => {
    const { client, calls } = makeFakeClient();

    await federatedSearch(client, {
      scope: { kind: "global" },
      category: "entities",
      query: { keyword: "liu" },
    });

    expect(calls[0]?.index).toBe("entities");
    expect(calls[0]?.filter).toBeUndefined();

    const bookResult = await federatedSearch(client, {
      scope: { kind: "book", unitId: "book-1" },
      category: "entities",
      query: { keyword: "liu" },
    });
    expect(bookResult.kind).toBe("single");
    if (bookResult.kind !== "single") throw new Error("expected single");
    expect(bookResult.totalHits).toBe(0);
  });

  test("single zones category drills down on the zones index", async () => {
    const { client, calls } = makeFakeClient();

    await federatedSearch(client, {
      scope: { kind: "global" },
      category: "zones",
      query: { keyword: "portal" },
      page: 2,
      hitsPerPage: 20,
    });

    expect(calls.length).toBe(1);
    expect(calls[0]?.index).toBe("zones");
    expect(calls[0]?.offset).toBe(20);
    expect(calls[0]?.limit).toBe(20);
    expect(calls[0]?.filter).toContain('visibility = "PUBLIC"');
  });

  test("mixed category uses federated multiSearch with weights", async () => {
    const { client, multi } = makeFakeClient({
      multiSearchResponse: {
        hits: [
          {
            id: "p-1",
            kind: "REVIEW",
            _federation: { indexUid: "posts" },
          },
          {
            id: "u-1",
            name: "alice",
            _federation: { indexUid: "users" },
          },
        ],
        estimatedTotalHits: 2,
        processingTimeMs: 5,
      },
    });
    const opts: FederatedSearchOptions = {
      scope: { kind: "global" },
      category: "mixed",
      query: { keyword: "magic" },
      page: 1,
      hitsPerPage: 20,
    };

    const result = await federatedSearch(client, opts);

    expect(result.kind).toBe("ranked");
    if (result.kind !== "ranked") throw new Error("expected ranked");
    expect(multi.length).toBe(1);
    expect(multi[0]!.federation).toEqual({ offset: 0, limit: 20 });
    // Every sub-query should carry a weight.
    // 每个子查询都应带有 weight。
    for (const q of multi[0]!.queries) {
      expect(q.weight).toBeGreaterThan(0);
    }
    // Each ranked hit has an _origin discriminator.
    // 每个 ranked 命中都带有 _origin 判别字段。
    for (const h of result.hits as any[]) {
      expect(h._origin?.indexUid).toBeDefined();
      expect(h._origin?.category).toBeDefined();
    }
  });

  test("single category drills down with offset+limit on the right index", async () => {
    const { client, calls } = makeFakeClient();
    const opts: FederatedSearchOptions = {
      scope: { kind: "realm", realmId: "r-1" },
      category: "reviews",
      query: { keyword: "epic" },
      page: 2,
      hitsPerPage: 20,
    };

    const result = await federatedSearch(client, opts);

    expect(result.kind).toBe("single");
    expect(calls.length).toBe(1);
    expect(calls[0]!.index).toBe("posts");
    expect(calls[0]!.offset).toBe(20);
    expect(calls[0]!.limit).toBe(20);
    expect(calls[0]!.filter).toContain('kind = "REVIEW"');
    expect(calls[0]!.filter).toContain('realmIds = "r-1"');
  });

  test("single comments category drills down on the comments index", async () => {
    const { client, calls } = makeFakeClient();
    const result = await federatedSearch(client, {
      scope: { kind: "realm", realmId: "r-1" },
      category: "comments",
      query: { keyword: "answer" },
      page: 2,
      hitsPerPage: 20,
    });

    expect(result.kind).toBe("single");
    expect(calls.length).toBe(1);
    expect(calls[0]!.index).toBe("comments");
    expect(calls[0]!.offset).toBe(20);
    expect(calls[0]!.limit).toBe(20);
    expect(calls[0]!.filter).toContain('realmUnitId = "r-1"');
    expect(calls[0]!.filter).toContain("isLocked = false");
  });

  test("allowed ratings default applies to content sub-queries", async () => {
    const { client, multi } = makeFakeClient();
    const opts: FederatedSearchOptions = {
      scope: { kind: "global" },
      category: "all",
      query: { keyword: "test" },
    };

    await federatedSearch(client, opts, {
      allowedRatings: ["GENERAL", "R_15"],
    });

    const contentQueries = multi[0]!.queries.filter(
      (q) => q.indexUid === "content",
    );
    expect(contentQueries.length).toBeGreaterThan(0);
    for (const q of contentQueries) {
      expect(q.filter).toContain('rating IN ["GENERAL", "R_15"]');
    }
  });

  test("posts sub-queries always include isLocked = false", async () => {
    const { client, multi } = makeFakeClient();
    const opts: FederatedSearchOptions = {
      scope: { kind: "global" },
      category: "all",
      query: {},
    };

    await federatedSearch(client, opts);

    const postsQueries = multi[0]!.queries.filter(
      (q) => q.indexUid === "posts",
    );
    for (const q of postsQueries) {
      expect(q.filter).toContain("isLocked = false");
    }
  });

  test("grouped shelves hydrate shelves from grouped shelf item matches", async () => {
    const { client, calls } = makeFakeClient({
      perIndex: (_q, params) => {
        if (params.indexUid === "shelfItems") {
          return {
            hits: [
              {
                id: "shelf-1:unit:book-1",
                shelfId: "shelf-1",
                shelfOwnerUserId: "owner-1",
                shelfVisibility: "PUBLIC",
                shelfStatus: "PUBLISHED",
                shelfTitle: "Favorites",
                itemType: "unit",
                itemId: "book-1",
                kind: "root",
                rootItemType: "unit",
                rootItemId: "book-1",
                parentItemType: null,
                parentItemId: null,
                parentRole: null,
                position: "a0",
                itemTitle: "Magic Book",
                itemSummary: null,
                itemText: null,
                searchText: "private note",
                rootUnitId: null,
                realmUnitId: null,
                parentCommentId: null,
                authorUserId: null,
                authorName: null,
                moderationStatus: null,
                isLocked: null,
                deletedAt: null,
                createdAt: 1,
                updatedAt: 2,
              },
            ],
            estimatedTotalHits: 1,
            processingTimeMs: 2,
          };
        }
        if (params.indexUid === "content" && params.filter?.includes("id IN")) {
          return {
            hits: [
              {
                id: "shelf-1",
                type: "SHELF",
                titles: ["Favorites"],
                subtitles: [],
                contentText: null,
                descriptionText: null,
                summaries: [],
                descriptions: [],
                creditNames: [],
                subjectNames: [],
                subjectEntityIds: [],
                subjectKinds: [],
                subjectRoles: [],
                tagLabels: [],
                aliasValues: [],
                tagIds: [],
                tagScores: {},
                catalogEntryKind: null,
                targetUnitId: null,
                seriesUnitIds: [],
                seriesKindKeys: [],
                seriesTitles: [],
                realmIds: [],
                realmTagKeys: [],
                containedUnitIds: ["book-1"],
                languages: [],
                isLanguageNeutral: true,
                rating: "GENERAL",
                aiDisclosureMode: "NONE",
                visibility: "PUBLIC",
                isLicensed: false,
                postKind: null,
                textLength: null,
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
                publishedAt: null,
                bestScore: 0,
                hotScore: 0,
                topScore: 0,
                risingScore: 0,
                controversyScore: 0,
                trendingScore: 0,
                qualityScore: 0,
                rankUpdatedAt: null,
                referenceCount: 0,
                shareCount: 0,
                defaultLanguage: null,
                coverUrl: null,
                userId: "owner-1",
              },
            ],
            estimatedTotalHits: 1,
            processingTimeMs: 1,
          };
        }
        return undefined;
      },
    });

    const result = await federatedSearch(client, {
      scope: { kind: "global" },
      category: "all",
      query: { keyword: "magic" },
    });

    expect(result.kind).toBe("grouped");
    if (result.kind !== "grouped") throw new Error("expected grouped");
    expect(result.sections.shelves?.items[0]?.id).toBe("shelf-1");
    expect(
      (result.sections.shelves?.items[0] as any).matchedShelfItemGroup
        .matches[0].item.itemTitle,
    ).toBe("Magic Book");
    const shelfItemCall = calls.find((call) => call.index === "shelfItems");
    expect(shelfItemCall?.attributesToSearchOn).not.toContain("searchText");
  });

  test("saved shelf search hydrates saved shelf units from shelf item matches", async () => {
    const { client, calls, multi } = makeFakeClient({
      perIndex: (_q, params) => {
        if (params.indexUid === "shelfItems") {
          return {
            hits: [
              {
                id: "saved-system-shelf:unit:shared-shelf",
                shelfId: "saved-system-shelf",
                shelfOwnerUserId: "owner-1",
                shelfVisibility: "PRIVATE",
                shelfStatus: "PUBLISHED",
                shelfTitle: "Saved",
                itemType: "unit",
                itemId: "shared-shelf",
                kind: "shelf",
                rootItemType: "unit",
                rootItemId: "shared-shelf",
                parentItemType: null,
                parentItemId: null,
                parentRole: null,
                position: "a0",
                itemTitle: "Shared Shelf",
                itemSummary: null,
                itemText: null,
                searchText: "private saved note",
                rootUnitId: "shared-shelf",
                realmUnitId: null,
                parentCommentId: null,
                authorUserId: null,
                authorName: null,
                moderationStatus: null,
                isLocked: null,
                deletedAt: null,
                createdAt: 1,
                updatedAt: 2,
              },
            ],
            estimatedTotalHits: 1,
            processingTimeMs: 2,
          };
        }
        if (params.indexUid === "content" && params.filter?.includes("id IN")) {
          return {
            hits: [
              {
                id: "shared-shelf",
                type: "SHELF",
                titles: ["Shared Shelf"],
                subtitles: [],
                contentText: null,
                descriptionText: null,
                summaries: [],
                descriptions: [],
                creditNames: [],
                subjectNames: [],
                subjectEntityIds: [],
                subjectKinds: [],
                subjectRoles: [],
                tagLabels: [],
                aliasValues: [],
                tagIds: [],
                tagScores: {},
                catalogEntryKind: null,
                targetUnitId: null,
                seriesUnitIds: [],
                seriesKindKeys: [],
                seriesTitles: [],
                realmIds: [],
                realmTagKeys: [],
                containedUnitIds: [],
                languages: [],
                isLanguageNeutral: true,
                rating: "GENERAL",
                aiDisclosureMode: "NONE",
                visibility: "PUBLIC",
                isLicensed: false,
                postKind: null,
                textLength: null,
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
                publishedAt: null,
                bestScore: 0,
                hotScore: 0,
                topScore: 0,
                risingScore: 0,
                controversyScore: 0,
                trendingScore: 0,
                qualityScore: 0,
                rankUpdatedAt: null,
                referenceCount: 0,
                shareCount: 0,
                defaultLanguage: null,
                coverUrl: null,
                userId: "saved-owner",
              },
            ],
            estimatedTotalHits: 1,
            processingTimeMs: 1,
          };
        }
        return undefined;
      },
    });

    const result = await federatedSearch(
      client,
      {
        scope: {
          kind: "saved",
          shelfId: "saved-system-shelf",
          userId: "owner-1",
        },
        category: "all",
        query: { keyword: "private saved note" },
      },
      { viewerUserId: "owner-1" },
    );

    expect(result.kind).toBe("grouped");
    if (result.kind !== "grouped") throw new Error("expected grouped");
    expect(multi.length).toBe(0);
    expect(result.sections.shelves?.items[0]?.id).toBe("shared-shelf");
    const shelfItemCall = calls.find((call) => call.index === "shelfItems");
    expect(shelfItemCall?.filter).toContain('shelfId = "saved-system-shelf"');
    expect(shelfItemCall?.filter).toContain('kind = "shelf"');
    expect(shelfItemCall?.attributesToSearchOn).toContain("searchText");
  });

  test("owner shelf item search includes private searchText", async () => {
    const { client, calls } = makeFakeClient();

    await federatedSearch(
      client,
      {
        scope: { kind: "user", userId: "owner-1" },
        category: "shelves",
        query: { keyword: "private note" },
      },
      { viewerUserId: "owner-1" },
    );

    const shelfItemCall = calls.find((call) => call.index === "shelfItems");
    expect(shelfItemCall?.filter).toContain('shelfOwnerUserId = "owner-1"');
    expect(shelfItemCall?.attributesToSearchOn).toContain("searchText");
  });

  test("logged-in global shelf item search still excludes private searchText", async () => {
    const { client, calls } = makeFakeClient();

    await federatedSearch(
      client,
      {
        scope: { kind: "global" },
        category: "shelves",
        query: { keyword: "private note" },
      },
      { viewerUserId: "owner-1" },
    );

    const shelfItemCall = calls.find((call) => call.index === "shelfItems");
    expect(shelfItemCall?.filter).toContain('shelfVisibility = "PUBLIC"');
    expect(shelfItemCall?.attributesToSearchOn).not.toContain("searchText");
  });
});
