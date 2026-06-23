import type {
  CommentSearchDocument,
  ContentSearchDocument,
  ContentSearchOptions,
  EntitySearchDocument,
  FederatedGroupedSections,
  FederatedSearchOptions,
  FederatedSearchResult,
  PostSearchDocument,
  PostSearchOptions,
  RealmSearchDocument,
  RealmSearchOptions,
  SearchCategory,
  SearchScope,
  ShelfItemSearchDocument,
  ShelfItemShelfGroup,
  UserSearchDocument,
  ZoneSearchDocument,
  ZoneSearchOptions,
} from "@rezics/contract";
import type { Hit, MultiSearchResult, RecordAny } from "meilisearch";
import type { SearchClient } from "@rezics/search";
import {
  DEFAULT_GROUPED_SECTION_LIMIT,
  DEFAULT_PAGE_HITS_PER_PAGE,
  federationWeights,
} from "./federation.config";
import type { FilterContext } from "./filters";
import {
  buildCommentFilter,
  buildContentFilter,
  buildPostFilter,
  buildRealmFilter,
  buildShelfItemFilter,
  buildUserFilter,
  buildZoneFilter,
} from "./filters";
import {
  resolveContentHitDisplay,
  resolvePostHitDisplay,
  resolveRealmHitDisplay,
  resolveZoneHitDisplay,
} from "./read-language";

// ANCHOR: federatedSearch
// ANCHOR: federatedSearch（联邦搜索入口）
// Single entry point used by `POST /meili/search/federated`. Branches on the
// requested `category` and computes the scope-permitted index allowlist.
// `POST /meili/search/federated` 使用的唯一入口。根据请求的 `category` 分支，
// 并计算 scope 允许访问的索引白名单。

interface PermittedIndexes {
  // BOOK | GAME | MEDIA | LINK content surface
  // BOOK | GAME | MEDIA | LINK 内容面
  contentBooks: boolean;
  // SHELF content surface
  // SHELF 内容面
  contentShelves: boolean;
  posts: boolean;
  comments: boolean;
  realms: boolean;
  zones: boolean;
  users: boolean;
  entities: boolean;
}

function permittedFor(scope: SearchScope): PermittedIndexes {
  switch (scope.kind) {
    case "global":
      return {
        contentBooks: true,
        contentShelves: true,
        posts: true,
        comments: true,
        realms: true,
        zones: true,
        users: true,
        entities: true,
      };
    case "book":
      // BOOK-side excluded; SHELF allowed via containedUnitIds; posts via
      // targetUnitId. Realms & users excluded.
      // 排除 BOOK 侧；SHELF 通过 containedUnitIds 允许；posts 通过
      // targetUnitId 允许。排除 realms 与 users。
      return {
        contentBooks: false,
        contentShelves: true,
        posts: true,
        comments: true,
        realms: false,
        zones: false,
        users: false,
        entities: false,
      };
    case "realm":
    case "zone":
      return {
        contentBooks: true,
        contentShelves: true,
        posts: true,
        comments: true,
        realms: false,
        zones: false,
        users: false,
        entities: false,
      };
    case "user":
      return {
        contentBooks: true,
        contentShelves: true,
        posts: true,
        comments: true,
        realms: false,
        zones: false,
        users: false,
        entities: true,
      };
    case "saved":
      return {
        contentBooks: false,
        contentShelves: true,
        posts: false,
        comments: false,
        realms: false,
        zones: false,
        users: false,
        entities: false,
      };
  }
}

function resolveFederatedHitDisplay(
  indexUid: string,
  hit: unknown,
  query: FederatedSearchOptions["query"],
): Record<string, unknown> {
  // Domain-specific resolve functions accept full options objects but only read
  // `languages` and `appLocale` (both present on FederatedSearchOptions.query
  // via readLanguageBodyBase). The double-cast through `unknown` is intentional:
  // we supply a structurally compatible subset and only the two relevant fields
  // are accessed at runtime. No behavior change.
  // 特定域 resolve 函数接受完整选项对象，但仅读取 `languages` 与 `appLocale`
  // （两者均通过 readLanguageBodyBase 存在于 FederatedSearchOptions.query）。
  // 经由 `unknown` 的双重转换是有意为之：我们提供结构兼容的子集，运行时
  // 只访问这两个相关字段，无任何行为变化。
  if (indexUid === "content") {
    return resolveContentHitDisplay(
      hit as ContentSearchDocument,
      query as unknown as ContentSearchOptions,
    );
  }
  if (indexUid === "posts") {
    return resolvePostHitDisplay(
      hit as PostSearchDocument,
      query as unknown as PostSearchOptions,
    );
  }
  if (indexUid === "realms") {
    return resolveRealmHitDisplay(
      hit as RealmSearchDocument,
      query as unknown as RealmSearchOptions,
    );
  }
  if (indexUid === "zones") {
    return resolveZoneHitDisplay(
      hit as ZoneSearchDocument,
      query as unknown as ZoneSearchOptions,
    );
  }
  return hit as Record<string, unknown>;
}

interface BuiltQuery {
  indexUid: string;
  q: string;
  filter: string[];
  // Optional weight key for federation-mode multi-search.
  // 联合（federation）模式多重搜索的可选权重键。
  weightKey?: keyof typeof federationWeights;
}

const SHELF_ITEM_PUBLIC_ATTRIBUTES = [
  "itemTitle",
  "itemSummary",
  "itemText",
  "shelfTitle",
] as const;

const SHELF_ITEM_OWNER_ATTRIBUTES = [
  ...SHELF_ITEM_PUBLIC_ATTRIBUTES,
  "searchText",
] as const;

function joinFilter(filters: string[]): string | undefined {
  return filters.length > 0 ? filters.join(" AND ") : undefined;
}

function idFilter(ids: string[]): string {
  return `id IN [${ids.map((id) => `"${id}"`).join(", ")}]`;
}

export async function federatedSearch(
  client: SearchClient,
  opts: FederatedSearchOptions,
  ctx: FilterContext = {},
): Promise<FederatedSearchResult> {
  const { category, query } = opts;
  const q = query.keyword ?? "";
  const page = opts.page ?? 1;
  const hitsPerPage = opts.hitsPerPage ?? DEFAULT_PAGE_HITS_PER_PAGE;

  // ANCHOR: single category → one-element drill-down
  // ANCHOR: 单一分类 → 单元素下钻
  if (category !== "all" && category !== "mixed") {
    return federatedSingle(client, opts, ctx, q, page, hitsPerPage);
  }

  // ANCHOR: mixed → federated multi-search with weights
  // ANCHOR: mixed → 带权重的联邦多重搜索
  if (category === "mixed") {
    return federatedRanked(client, opts, ctx, q, page, hitsPerPage);
  }

  // ANCHOR: all → grouped sections (per-index totals + capped items)
  // ANCHOR: all → 分组分区（每索引总数 + 截断条目）
  return federatedGrouped(client, opts, ctx, q);
}

// ANCHOR: single
// ANCHOR: 单一
async function federatedSingle(
  client: SearchClient,
  opts: FederatedSearchOptions,
  ctx: FilterContext,
  q: string,
  page: number,
  hitsPerPage: number,
): Promise<FederatedSearchResult> {
  const { scope, category, query } = opts;
  const permitted = permittedFor(scope);
  const offset = (page - 1) * hitsPerPage;

  let items: unknown[] = [];
  let totalHits = 0;
  let processingTimeMs = 0;

  switch (category) {
    case "books": {
      if (!permitted.contentBooks) break;
      const filter = buildContentFilter(query, scope, ctx, {
        contentSubtype: "books",
        categoryHint: category,
      });
      const resp = await client.contentIndex.search<ContentSearchDocument>(q, {
        filter: joinFilter(filter),
        offset,
        limit: hitsPerPage,
      });
      items = resp.hits.map((hit) =>
        resolveContentHitDisplay(hit, query as unknown as ContentSearchOptions),
      );
      totalHits = resp.estimatedTotalHits ?? resp.hits.length;
      processingTimeMs = resp.processingTimeMs;
      break;
    }
    case "shelves": {
      if (!permitted.contentShelves) break;
      const section = await searchShelfSection(client, {
        query,
        scope,
        ctx,
        q,
        offset,
        limit: hitsPerPage,
      });
      items = section.items;
      totalHits = section.totalHits;
      processingTimeMs = section.processingTimeMs;
      break;
    }
    case "reviews":
    case "excerpts":
    case "remarks":
    case "posts": {
      if (!permitted.posts) break;
      const filter = buildPostFilter(query, scope, ctx, {
        postCategory: category,
        categoryHint: category,
      });
      const resp = await client.postIndex.search<PostSearchDocument>(q, {
        filter: joinFilter(filter),
        offset,
        limit: hitsPerPage,
      });
      items = resp.hits.map((hit) =>
        resolvePostHitDisplay(hit, query as unknown as PostSearchOptions),
      );
      totalHits = resp.estimatedTotalHits ?? resp.hits.length;
      processingTimeMs = resp.processingTimeMs;
      break;
    }
    case "comments": {
      if (!permitted.comments) break;
      const filter = buildCommentFilter(query, scope, ctx, {
        categoryHint: category,
      });
      const resp = await client.commentIndex.search<CommentSearchDocument>(q, {
        filter: joinFilter(filter),
        offset,
        limit: hitsPerPage,
      });
      items = resp.hits;
      totalHits = resp.estimatedTotalHits ?? resp.hits.length;
      processingTimeMs = resp.processingTimeMs;
      break;
    }
    case "realms": {
      if (!permitted.realms) break;
      const filter = buildRealmFilter(query, scope, ctx);
      const resp = await client.realmIndex.search<RealmSearchDocument>(q, {
        filter: joinFilter(filter),
        offset,
        limit: hitsPerPage,
      });
      items = resp.hits;
      totalHits = resp.estimatedTotalHits ?? resp.hits.length;
      processingTimeMs = resp.processingTimeMs;
      break;
    }
    case "zones": {
      if (!permitted.zones) break;
      const filter = buildZoneFilter(query, scope, ctx);
      const resp = await client.zoneIndex.search<ZoneSearchDocument>(q, {
        filter: joinFilter(filter),
        offset,
        limit: hitsPerPage,
      });
      items = resp.hits.map((hit) =>
        resolveZoneHitDisplay(hit, query as unknown as ZoneSearchOptions),
      );
      totalHits = resp.estimatedTotalHits ?? resp.hits.length;
      processingTimeMs = resp.processingTimeMs;
      break;
    }
    case "users": {
      if (!permitted.users) break;
      const filter = buildUserFilter(query, scope);
      const resp = await client.userIndex.search<UserSearchDocument>(q, {
        filter: joinFilter(filter),
        offset,
        limit: hitsPerPage,
      });
      items = resp.hits;
      totalHits = resp.estimatedTotalHits ?? resp.hits.length;
      processingTimeMs = resp.processingTimeMs;
      break;
    }
    case "entities": {
      if (!permitted.entities) break;
      const filter =
        scope.kind === "user" ? [`ownerUnitId = "${scope.userId}"`] : [];
      const resp = await client.entityIndex.search<EntitySearchDocument>(q, {
        filter: joinFilter(filter),
        offset,
        limit: hitsPerPage,
      });
      items = resp.hits;
      totalHits = resp.estimatedTotalHits ?? resp.hits.length;
      processingTimeMs = resp.processingTimeMs;
      break;
    }
  }

  return {
    kind: "single",
    scope,
    category,
    items: items as FederatedSearchResult extends {
      kind: "single";
      items: infer I;
    }
      ? I
      : never,
    totalHits,
    processingTimeMs,
    page,
    hitsPerPage,
  };
}

// ANCHOR: ranked (mixed)
// ANCHOR: 排序（mixed）
async function federatedRanked(
  client: SearchClient,
  opts: FederatedSearchOptions,
  ctx: FilterContext,
  q: string,
  page: number,
  hitsPerPage: number,
): Promise<FederatedSearchResult> {
  const { scope, query } = opts;
  const built = buildAllSubQueries(query, scope, ctx, "mixed");
  if (built.length === 0) {
    return {
      kind: "ranked",
      scope,
      hits: [],
      totalHits: 0,
      processingTimeMs: 0,
      page,
      hitsPerPage,
    };
  }

  const resp = await client.meili.multiSearch({
    federation: { offset: (page - 1) * hitsPerPage, limit: hitsPerPage },
    queries: built.map((b) => ({
      indexUid: b.indexUid,
      q,
      filter: joinFilter(b.filter),
      federationOptions: b.weightKey
        ? { weight: federationWeights[b.weightKey] }
        : undefined,
    })),
  });

  // FederatedMultiSearchParams makes multiSearch return SearchResponse<T>,
  // whose hits are Hit<T>. _federation is typed on Hit<RecordAny> by the SDK.
  // FederatedMultiSearchParams 使 multiSearch 返回 SearchResponse<T>，
  // 其 hits 为 Hit<T>。SDK 在 Hit<RecordAny> 上声明了 _federation 字段。
  const hits = (resp.hits ?? []).map((h: Hit<RecordAny>) => {
    const indexUid: string = h._federation?.indexUid ?? "";
    const category = mapIndexToCategory(indexUid, h);
    const resolved = resolveFederatedHitDisplay(indexUid, h, query);
    return { ...resolved, _origin: { indexUid, category } };
  });

  return {
    kind: "ranked",
    scope,
    hits: hits as FederatedSearchResult extends {
      kind: "ranked";
      hits: infer H;
    }
      ? H
      : never,
    // estimatedTotalHits is typed as Partial<InfinitePagination> on SearchResponse.
    // estimatedTotalHits 在 SearchResponse 上以 Partial<InfinitePagination> 类型声明。
    totalHits: resp.estimatedTotalHits ?? hits.length,
    processingTimeMs: resp.processingTimeMs ?? 0,
    page,
    hitsPerPage,
  };
}

// ANCHOR: grouped (all)
// ANCHOR: 分组（all）
async function federatedGrouped(
  client: SearchClient,
  opts: FederatedSearchOptions,
  ctx: FilterContext,
  q: string,
): Promise<FederatedSearchResult> {
  const { scope, query } = opts;
  const limit = DEFAULT_GROUPED_SECTION_LIMIT;
  const built = buildAllSubQueries(query, scope, ctx, "all");
  const permitted = permittedFor(scope);
  if (built.length === 0) {
    const sections: FederatedGroupedSections = {};
    if (permitted.contentShelves) {
      sections.shelves = await searchShelfSection(client, {
        query,
        scope,
        ctx,
        q,
        offset: 0,
        limit,
      });
    }
    return { kind: "grouped", scope, sections };
  }

  const resp = await client.meili.multiSearch({
    queries: built.map((b) => ({
      indexUid: b.indexUid,
      q,
      filter: joinFilter(b.filter),
      hitsPerPage: limit,
      page: 1,
    })),
  });

  const sections: FederatedGroupedSections = {};
  // MultiSearchResult<RecordAny> is SearchResponse<RecordAny> & { indexUid }.
  // totalHits/estimatedTotalHits are both optional (finite vs. infinite pagination).
  // MultiSearchResult<RecordAny> 是 SearchResponse<RecordAny> & { indexUid }。
  // totalHits/estimatedTotalHits 均为可选（有限分页与无限分页两种模式）。
  resp.results.forEach((r: MultiSearchResult<RecordAny>, idx: number) => {
    const meta = built[idx]!;
    const sectionKey = meta.sectionKey;
    if (!sectionKey) return;
    sections[sectionKey] = {
      totalHits: r.totalHits ?? r.estimatedTotalHits ?? r.hits.length,
      items: r.hits.map((hit) =>
        resolveFederatedHitDisplay(meta.indexUid, hit, query),
      ),
      processingTimeMs: r.processingTimeMs,
    } as FederatedGroupedSections[typeof sectionKey];
  });

  if (permitted.contentShelves) {
    sections.shelves = await searchShelfSection(client, {
      query,
      scope,
      ctx,
      q,
      offset: 0,
      limit,
    });
  }

  return { kind: "grouped", scope, sections };
}

async function searchShelfSection(
  client: SearchClient,
  input: {
    query: FederatedSearchOptions["query"];
    scope: SearchScope;
    ctx: FilterContext;
    q: string;
    offset: number;
    limit: number;
  },
) {
  const { query, scope, ctx, q, offset, limit } = input;
  const isSavedScope = scope.kind === "saved";
  const hydrateScope: SearchScope = isSavedScope ? { kind: "global" } : scope;
  const contentFilter = buildContentFilter(query, hydrateScope, ctx, {
    contentSubtype: "shelves",
    categoryHint: "shelves",
  });
  const directResp = isSavedScope
    ? {
        hits: [] as ContentSearchDocument[],
        estimatedTotalHits: 0,
        processingTimeMs: 0,
      }
    : await client.contentIndex.search<ContentSearchDocument>(q, {
        filter: joinFilter(contentFilter),
        offset,
        limit,
      });
  const directItems = directResp.hits.map((hit) =>
    resolveContentHitDisplay(hit, query as unknown as ContentSearchOptions),
  ) as Array<
    ContentSearchDocument & { matchedShelfItemGroup?: ShelfItemShelfGroup }
  >;

  const groupResp = q
    ? await searchShelfItemGroups(client, query, scope, ctx, q, offset, limit)
    : {
        groups: [] as ShelfItemShelfGroup[],
        totalGroups: 0,
        processingTimeMs: 0,
      };
  const groupByShelfId = new Map(
    groupResp.groups.map((group) => [group.shelfId, group]),
  );
  for (const item of directItems) {
    const group = groupByShelfId.get(item.id);
    if (group) {
      item.matchedShelfItemGroup = group;
      groupByShelfId.delete(item.id);
    }
  }

  const missingGroupIds = [...groupByShelfId.keys()];
  const hydratedResp =
    missingGroupIds.length > 0
      ? await client.contentIndex.search<ContentSearchDocument>("", {
          filter: joinFilter([
            ...buildContentFilter(query, hydrateScope, ctx, {
              contentSubtype: "shelves",
              categoryHint: "shelves",
            }),
            idFilter(missingGroupIds),
          ]),
          limit: missingGroupIds.length,
        })
      : null;
  const hydratedItems = (hydratedResp?.hits ?? []).map((hit) => {
    const resolved = resolveContentHitDisplay(
      hit,
      query as unknown as ContentSearchOptions,
    ) as ContentSearchDocument & {
      matchedShelfItemGroup?: ShelfItemShelfGroup;
    };
    const group = groupByShelfId.get(resolved.id);
    if (group) resolved.matchedShelfItemGroup = group;
    return resolved;
  });

  const items = [...directItems, ...hydratedItems].slice(0, limit);
  return {
    totalHits: Math.max(
      directResp.estimatedTotalHits ?? directResp.hits.length,
      groupResp.totalGroups,
    ),
    items,
    processingTimeMs:
      directResp.processingTimeMs +
      groupResp.processingTimeMs +
      (hydratedResp?.processingTimeMs ?? 0),
  };
}

async function searchShelfItemGroups(
  client: SearchClient,
  query: FederatedSearchOptions["query"],
  scope: SearchScope,
  ctx: FilterContext,
  q: string,
  offset: number,
  limit: number,
) {
  const filter = buildShelfItemFilter(query, scope, ctx);
  const includePrivate =
    (scope.kind === "user" || scope.kind === "saved") &&
    ctx.viewerUserId === scope.userId;
  // attributesToSearchOn accepts string[] | null; the spread converts the
  // readonly tuple constants to plain mutable string[] that the SDK accepts.
  // attributesToSearchOn 接受 string[] | null；展开操作将只读元组常量
  // 转换为 SDK 接受的普通可变 string[]。
  const resp = await client.shelfItemIndex.search<ShelfItemSearchDocument>(q, {
    filter: joinFilter(filter),
    offset,
    limit: Math.max(limit * 4, limit),
    attributesToSearchOn: includePrivate
      ? ([...SHELF_ITEM_OWNER_ATTRIBUTES] as string[])
      : ([...SHELF_ITEM_PUBLIC_ATTRIBUTES] as string[]),
  });
  const groupMap = new Map<string, ShelfItemShelfGroup>();
  for (const hit of resp.hits) {
    const groupId = scope.kind === "saved" ? hit.itemId : hit.shelfId;
    let group = groupMap.get(groupId);
    if (!group) {
      group = {
        shelfId: groupId,
        shelfTitle: scope.kind === "saved" ? hit.itemTitle : hit.shelfTitle,
        shelfOwnerUserId: hit.shelfOwnerUserId,
        shelfVisibility: hit.shelfVisibility,
        total: 0,
        matches: [],
      };
      groupMap.set(groupId, group);
    }
    group.total += 1;
    if (group.matches.length < 3) {
      group.matches.push({ item: hit });
    }
  }
  const groups = [...groupMap.values()].slice(0, limit);
  return {
    groups,
    totalGroups: groupMap.size,
    processingTimeMs: resp.processingTimeMs ?? 0,
  };
}

// ANCHOR: buildAllSubQueries
// ANCHOR: buildAllSubQueries（构造全部子查询）
// Constructs the full set of permitted sub-queries for grouped/ranked modes.
// For `all` (grouped), each post-kind becomes its own section.
// For `mixed` (ranked), posts are queried as one bucket with no kind filter.
// 为 grouped/ranked 模式构造完整的允许子查询集合。
// 对 `all`（grouped），每个 post-kind 成为独立分区。
// 对 `mixed`（ranked），posts 作为单一桶查询，不带 kind 过滤。

interface BuiltSubQuery extends BuiltQuery {
  // Section name in the grouped variant (`books`, `reviews`, ...).
  // grouped 变体中的分区名（`books`、`reviews` 等）。
  sectionKey?:
    | "books"
    | "reviews"
    | "excerpts"
    | "remarks"
    | "posts"
    | "comments"
    | "shelves"
    | "realms"
    | "zones"
    | "users"
    | "entities";
}

function buildAllSubQueries(
  query: FederatedSearchOptions["query"],
  scope: SearchScope,
  ctx: FilterContext,
  mode: "all" | "mixed",
): BuiltSubQuery[] {
  const out: BuiltSubQuery[] = [];
  const permitted = permittedFor(scope);

  if (permitted.contentBooks) {
    const filter = buildContentFilter(query, scope, ctx, {
      contentSubtype: "books",
      categoryHint: mode === "all" ? "books" : "mixed",
    });
    out.push({
      indexUid: "content",
      q: query.keyword ?? "",
      filter,
      weightKey: "content",
      sectionKey: "books",
    });
  }

  if (permitted.posts) {
    if (mode === "all") {
      // One section per post-kind category
      // 每个 post-kind 类别一个分区。
      (["reviews", "excerpts", "remarks", "posts"] as const).forEach((cat) => {
        const filter = buildPostFilter(query, scope, ctx, {
          postCategory: cat,
          categoryHint: cat,
        });
        out.push({
          indexUid: "posts",
          q: query.keyword ?? "",
          filter,
          weightKey: "posts",
          sectionKey: cat,
        });
      });
    } else {
      const filter = buildPostFilter(query, scope, ctx, {
        categoryHint: "mixed",
      });
      out.push({
        indexUid: "posts",
        q: query.keyword ?? "",
        filter,
        weightKey: "posts",
      });
    }
  }

  if (permitted.comments) {
    const filter = buildCommentFilter(query, scope, ctx, {
      categoryHint: mode === "all" ? "comments" : "mixed",
    });
    out.push({
      indexUid: "comments",
      q: query.keyword ?? "",
      filter,
      weightKey: "comments",
      sectionKey: "comments",
    });
  }

  if (permitted.contentShelves && scope.kind !== "saved") {
    const filter = buildContentFilter(query, scope, ctx, {
      contentSubtype: "shelves",
      categoryHint: mode === "all" ? "shelves" : "mixed",
    });
    out.push({
      indexUid: "content",
      q: query.keyword ?? "",
      filter,
      weightKey: "content",
      sectionKey: "shelves",
    });
  }

  if (permitted.realms) {
    const filter = buildRealmFilter(query, scope, ctx);
    out.push({
      indexUid: "realms",
      q: query.keyword ?? "",
      filter,
      weightKey: "realms",
      sectionKey: "realms",
    });
  }

  if (permitted.zones) {
    const filter = buildZoneFilter(query, scope, ctx);
    out.push({
      indexUid: "zones",
      q: query.keyword ?? "",
      filter,
      weightKey: "zones",
      sectionKey: "zones",
    });
  }

  if (permitted.users) {
    const filter = buildUserFilter(query, scope);
    out.push({
      indexUid: "users",
      q: query.keyword ?? "",
      filter,
      weightKey: "users",
      sectionKey: "users",
    });
  }

  if (permitted.entities) {
    const filter =
      scope.kind === "user" ? [`ownerUnitId = "${scope.userId}"`] : [];
    out.push({
      indexUid: "entities",
      q: query.keyword ?? "",
      filter,
      weightKey: "entities",
      sectionKey: "entities",
    });
  }

  return out;
}

// ANCHOR: mapIndexToCategory
// ANCHOR: mapIndexToCategory（索引映射到分类）
// In ranked (federated multi-search) the response is a flat hits[] without
// per-query metadata for posts kinds. Map index → coarse category; for
// post-index hits, refine by document.kind when available.
// 在 ranked（联合多重搜索）中，响应是扁平的 hits[]，对 posts kinds 没有
// 逐查询元数据。将 index → 粗粒度 category 映射；对 post 索引的命中，
// 在可用时通过 document.kind 进一步细化。

function mapIndexToCategory(
  indexUid: string,
  hit: Hit<RecordAny>,
): SearchCategory {
  if (indexUid === "posts") {
    const k = (hit?.kind ?? "").toString().toLowerCase();
    if (k === "review") return "reviews";
    if (k === "excerpt") return "excerpts";
    if (k === "remark") return "remarks";
    return "posts";
  }
  if (indexUid === "comments") return "comments";
  if (indexUid === "content") {
    const t = (hit?.type ?? "").toString().toUpperCase();
    if (t === "SHELF") return "shelves";
    return "books";
  }
  if (indexUid === "realms") return "realms";
  if (indexUid === "zones") return "zones";
  if (indexUid === "users") return "users";
  if (indexUid === "entities") return "entities";
  // Fallback for unmapped index uids — treat as posts so the union resolves.
  // 未映射 index uid 的兜底——视作 posts 以便联合类型可解析。
  return "posts";
}
