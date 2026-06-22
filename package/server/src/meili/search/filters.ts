import type {
  ContentRating,
  PostKind,
  SearchCategory,
  SearchQuery,
  SearchScope,
  ZoneBoundaryFilter,
  ZoneSectionQuery,
  ZoneSectionQueryFilterField,
  ZoneSectionQuerySortField,
} from "@rezics/contract";
import {
  CATALOG_UNIT_TYPES,
  ZONE_SECTION_QUERY_FILTERABLE_FIELDS,
  ZONE_SECTION_QUERY_SORT_FIELDS,
} from "@rezics/contract";

// ANCHOR: shared filter builders for federated search
// ANCHOR: 联合搜索的共享过滤器构造器
//
// These builders are pure functions that accept a `SearchQuery` plus the
// route-derived `SearchScope` (and pre-resolved tag/realm ids when relevant)
// and return a Meilisearch filter expression as a string array.
// 这些构造器是纯函数，接受一个 `SearchQuery` 以及从路由派生的
// `SearchScope`（在相关时还包括预先解析的 tag/realm id），并返回作为
// 字符串数组的 Meilisearch 过滤表达式。
//
// The federated endpoint (`POST /meili/search/federated`) is the single
// caller; each sub-query for a permitted index is built via one of these.
// They are pure so they can be unit-tested without a database client or live
// Meilisearch instance.
// 联合端点（`POST /meili/search/federated`）是唯一的调用方；每个被允许
// 索引的子查询都通过其中之一构建。它们是纯函数，因此无需数据库客户端
// 或运行中的 Meilisearch 实例即可进行单元测试。

export interface FilterContext {
  // Tag ids resolved upstream from `query.tags` (SlugRef[]).
  // 从上游 `query.tags`（SlugRef[]）解析出的 tag id。
  resolvedTagIds?: string[];
  // Realm unitId resolved upstream from `query.realm` (SlugRef).
  // 从上游 `query.realm`（SlugRef）解析出的 realm unitId。
  resolvedRealmId?: string | null;
  // Allowed ratings derived from the caller session (already intersected
  // with `query.ratings` if provided). Pass null/undefined for "no rating
  // restriction" (e.g., admin contexts); pass an empty array for "no
  // ratings allowed" — the builder will reject all content.
  // 从调用方会话派生的允许评级（若提供了 `query.ratings` 则已与之取交集）。
  // 传入 null/undefined 表示“无评级限制”（例如管理员上下文）；传入空数组
  // 表示“不允许任何评级”——构造器将拒绝所有内容。
  allowedRatings?: ContentRating[] | null;
  // Authenticated viewer. Used only for viewer-private search affordances
  // such as owner-only shelf item notes.
  // 已认证的查看者。仅用于查看者私有的搜索能力，例如仅所有者可见的书架
  // 条目备注。
  viewerUserId?: string | null;
  // Zone scope only: the zone's unremovable `boundary.filters` boundary,
  // pre-compiled per index by the caller (see `compileZoneSectionQuery`).
  // User filters only narrow within it.
  // 仅 zone 作用域：专区不可移除的 `boundary.filters` 边界，由调用方按索引
  // 预编译（见 `compileZoneSectionQuery`）。用户过滤只能在其内部收窄。
  zoneBoundaryContentFilter?: string[];
  zoneBoundaryPostFilter?: string[];
  zoneBoundaryZoneFilter?: string[];
  // Unit ids resolved from explicit policy-tag source filters. Undefined means
  // no policy source was requested; an empty array means requested but no match.
  // 从显式 policy-tag 来源过滤解析出的 Unit id。undefined 表示未请求 policy
  // 来源；空数组表示已请求但没有匹配项。
  policyTagUnitIds?: string[];
}

export interface ContentBuildOpts {
  // Hint that scopes the content sub-query to either the BOOK-side
  // surfaces or the SHELF subset. Drives `type =` filters and the book
  // scope's `containedUnitIds` join.
  // 将内容子查询限定到 BOOK 侧界面或 SHELF 子集的提示。驱动 `type =`
  // 过滤以及 book 作用域的 `containedUnitIds` 关联。
  contentSubtype?: "books" | "shelves";
  // Top-level category hint passed by the federated orchestrator.
  // 由联合编排器传入的顶层 category 提示。
  categoryHint?: SearchCategory;
}

export interface PostBuildOpts {
  // Maps category to a `kind =` literal; supersedes `query.kind`/`postKind`.
  // 将 category 映射为 `kind =` 字面量；优先于 `query.kind`/`postKind`。
  postCategory?: "reviews" | "excerpts" | "remarks" | "posts";
  categoryHint?: SearchCategory;
}

export interface CommentBuildOpts {
  categoryHint?: SearchCategory;
}

export interface ShelfItemBuildOpts {
  includePrivateSearchText?: boolean;
}

const POST_CATEGORY_TO_KIND: Record<
  NonNullable<PostBuildOpts["postCategory"]>,
  PostKind
> = {
  reviews: "REVIEW",
  excerpts: "EXCERPT",
  remarks: "REMARK",
  posts: "POST",
};

function quoteList(values: readonly string[]): string {
  return values.map((v) => `"${v}"`).join(", ");
}

const BOOK_CONTENT_TYPES = [...CATALOG_UNIT_TYPES, "LINK", "SERIES"] as const;

const BOOK_CONTENT_CATALOG_FILTER = [
  '(type = "BOOK" AND catalogEntryKind = "MAIN")',
  '(type = "GAME" AND catalogEntryKind = "MAIN")',
  '(type = "MEDIA" AND catalogEntryKind = "MAIN")',
  'type = "LINK"',
  'type = "SERIES"',
].join(" OR ");

const EMPTY_POLICY_TAG_FILTER = 'id = "__policy_tag_source_no_match__"';

function policyTagUnitIdFilter(ctx: FilterContext): string | null {
  if (!ctx.policyTagUnitIds) return null;
  if (ctx.policyTagUnitIds.length === 0) return EMPTY_POLICY_TAG_FILTER;
  return ctx.policyTagUnitIds.length === 1
    ? `id = "${ctx.policyTagUnitIds[0]}"`
    : `id IN [${quoteList(ctx.policyTagUnitIds)}]`;
}

function resolveBookScope(scope: SearchScope): {
  mode: "exact";
  unitId: string;
} {
  if (scope.kind === "book") return { mode: "exact", unitId: scope.unitId };
  throw new Error("resolveBookScope requires a book scope");
}

// ANCHOR: buildContentFilter
// ANCHOR: buildContentFilter（构建内容筛选器）
// Maps SearchScope onto the content index per the strict-membership table:
//   global → no scope filter
//   book   → contentSubtype must be "shelves" (BOOK/GAME/MEDIA/LINK excluded)
//          → containedUnitIds = unitId AND type = "SHELF"
//   realm  → realmIds = realmId
//   zone   → the zone's pre-compiled `boundary.filters` boundary
//            (ctx.zoneBoundaryContentFilter) — unremovable, user filters
//            only narrow within it
//   user   → userId = userId
//   saved  → handled by the shelf-item grouped path, not direct content search
// 按严格成员关系表将 SearchScope 映射到内容索引：
//   global → 无作用域过滤
//   book   → contentSubtype 必须为 "shelves"（排除 BOOK/GAME/MEDIA/LINK）
//          → containedUnitIds = unitId AND type = "SHELF"
//   realm  → realmIds = realmId
//   zone   → 专区预编译的 `boundary.filters` 边界
//            （ctx.zoneBoundaryContentFilter）——不可移除，用户过滤只能
//            在其内部收窄
//   user   → userId = userId
//   saved  → 由书架条目分组路径处理，而非直接的内容搜索

export function buildContentFilter(
  query: SearchQuery,
  scope: SearchScope,
  ctx: FilterContext = {},
  opts: ContentBuildOpts = {},
): string[] {
  const filter: string[] = [];

  // 1. Type filter
  // 1. 类型过滤
  if (opts.contentSubtype === "shelves") {
    filter.push(`type = "SHELF"`);
  } else if (opts.contentSubtype === "books") {
    // BOOK-side content surfaces (BOOK | GAME | MEDIA | LINK)
    // BOOK 侧内容界面（BOOK | GAME | MEDIA | LINK）
    filter.push(`type IN [${quoteList(BOOK_CONTENT_TYPES)}]`);
    filter.push(`(${BOOK_CONTENT_CATALOG_FILTER})`);
  } else if (query.type?.length) {
    if (query.type.length === 1) {
      filter.push(`type = "${query.type[0]}"`);
    } else {
      filter.push(`type IN [${quoteList(query.type)}]`);
    }
  }

  // 2. Scope filter
  // 2. 作用域过滤
  if (scope.kind === "book") {
    const bookScope = resolveBookScope(scope);
    filter.push(`containedUnitIds = "${bookScope.unitId}"`);
  } else if (scope.kind === "realm") {
    filter.push(`realmIds = "${scope.realmId}"`);
  } else if (scope.kind === "user") {
    filter.push(`userId = "${scope.userId}"`);
  } else if (scope.kind === "zone") {
    filter.push(...(ctx.zoneBoundaryContentFilter ?? []));
  } else if (scope.kind === "saved") {
    filter.push('id = "__saved_shelf_scope_requires_shelf_items__"');
  }

  // 3. Resolved realm tag (from query.realm SlugRef)
  // 3. 已解析的 realm 标签（来自 query.realm SlugRef）
  if (ctx.resolvedRealmId && scope.kind !== "realm") {
    filter.push(`realmIds = "${ctx.resolvedRealmId}"`);
  }

  // 4. Tag IDs (already resolved from SlugRefs)
  // 4. Tag ID（已从 SlugRef 解析）
  for (const tagId of ctx.resolvedTagIds ?? []) {
    filter.push(`tagIds = "${tagId}"`);
  }
  const policyFilter = policyTagUnitIdFilter(ctx);
  if (policyFilter) filter.push(policyFilter);

  // 6. Ratings — intersect query.ratings with allowedRatings if both provided
  // 6. 评级——若同时提供了 query.ratings 与 allowedRatings 则取交集
  const requested = query.ratings ?? null;
  const allowed = ctx.allowedRatings ?? null;
  let effectiveRatings: ContentRating[] | null = null;
  if (requested && allowed) {
    const allowedSet = new Set(allowed);
    effectiveRatings = requested.filter((r) => allowedSet.has(r));
  } else if (requested) {
    effectiveRatings = requested;
  } else if (allowed) {
    effectiveRatings = allowed;
  }
  if (effectiveRatings && effectiveRatings.length > 0) {
    filter.push(`rating IN [${quoteList(effectiveRatings)}]`);
  }

  // 7. AI disclosure
  // 7. AI 披露
  if (query.aiDisclosureModes?.length) {
    filter.push(`aiDisclosureMode IN [${quoteList(query.aiDisclosureModes)}]`);
  }

  // 8. License
  // 8. 许可
  if (query.isLicensed === true) filter.push("isLicensed = true");
  else if (query.isLicensed === false) filter.push("isLicensed = false");

  // 9. Text length
  // 9. 文本长度
  if (query.textLength) {
    if (typeof query.textLength.min === "number") {
      filter.push(`textLength >= ${query.textLength.min}`);
    }
    if (typeof query.textLength.max === "number") {
      filter.push(`textLength <= ${query.textLength.max}`);
    }
  }

  // 10. Visibility — content search is always public-only.
  // 10. 可见性——内容搜索始终仅限公开。
  filter.push('visibility = "PUBLIC"');

  return filter;
}

// ANCHOR: buildPostFilter
// ANCHOR: buildPostFilter（构建帖子筛选器）
// Scope mapping for posts:
//   global → no scope filter
//   book   → targetUnitId = unitId
//   realm  → realmIds = realmId
//   zone   → the zone's pre-compiled `boundary.filters` boundary
//            (ctx.zoneBoundaryPostFilter)
//   user   → authorUserId = userId
// 帖子的作用域映射：
//   global → 无作用域过滤
//   book   → targetUnitId = unitId
//   realm  → realmIds = realmId
//   zone   → 专区预编译的 `boundary.filters` 边界（ctx.zoneBoundaryPostFilter）
//   user   → authorUserId = userId

export function buildPostFilter(
  query: SearchQuery,
  scope: SearchScope,
  _ctx: FilterContext = {},
  opts: PostBuildOpts = {},
): string[] {
  const filter: string[] = [];

  // 1. Kind filter — category-implied wins; otherwise honor query.kind / query.postKind
  // 1. Kind 过滤——category 隐含的优先；否则采用 query.kind / query.postKind
  if (opts.postCategory) {
    filter.push(`kind = "${POST_CATEGORY_TO_KIND[opts.postCategory]}"`);
  } else if (query.kind) {
    filter.push(`kind = "${query.kind}"`);
  } else if (query.postKind?.length) {
    if (query.postKind.length === 1) {
      filter.push(`kind = "${query.postKind[0]}"`);
    } else {
      filter.push(`kind IN [${quoteList(query.postKind)}]`);
    }
  }

  // 2. Scope filter
  // 2. 作用域过滤
  if (scope.kind === "book") {
    filter.push(`targetUnitId = "${scope.unitId}"`);
  } else if (scope.kind === "realm") {
    filter.push(`realmIds = "${scope.realmId}"`);
  } else if (scope.kind === "user") {
    filter.push(`authorUserId = "${scope.userId}"`);
  } else if (scope.kind === "zone") {
    filter.push(...(_ctx.zoneBoundaryPostFilter ?? []));
  } else if (scope.kind === "saved") {
    filter.push('id = "__saved_shelf_scope_requires_shelf_items__"');
  }

  // 3. Locked posts excluded by default (per content-search-api default filters).
  // 3. 默认排除已锁定的帖子（依据 content-search-api 的默认过滤）。
  filter.push("isLocked = false");
  const policyFilter = policyTagUnitIdFilter(_ctx);
  if (policyFilter) filter.push(policyFilter);

  return filter;
}

// ANCHOR: buildCommentFilter
// ANCHOR: buildCommentFilter（构建评论筛选器）
// Scope mapping for comments:
//   global → no scope filter
//   book   → rootUnitId = unitId
//   realm  → realmUnitId = realmId
//   zone   → no comment partition filter unless a later zone config explicitly
//            defines direct-content comment boundaries
//   user   → authorUserId = userId
// 评论的作用域映射：
//   global → 无作用域过滤
//   book   → rootUnitId = unitId
//   realm  → realmUnitId = realmId
//   zone   → 不使用评论分区过滤，除非后续 zone 配置显式定义直接内容评论边界
//   user   → authorUserId = userId

export function buildCommentFilter(
  _query: SearchQuery,
  scope: SearchScope,
  _ctx: FilterContext = {},
  _opts: CommentBuildOpts = {},
): string[] {
  const filter: string[] = [];

  if (scope.kind === "book") {
    const bookScope = resolveBookScope(scope);
    filter.push(`rootUnitId = "${bookScope.unitId}"`);
  } else if (scope.kind === "realm") {
    filter.push(`realmUnitId = "${scope.realmId}"`);
  } else if (scope.kind === "user") {
    filter.push(`authorUserId = "${scope.userId}"`);
  } else if (scope.kind === "saved") {
    filter.push('id = "__saved_shelf_scope_requires_shelf_items__"');
  }

  filter.push("isLocked = false");
  return filter;
}

// ANCHOR: buildRealmFilter
// ANCHOR: buildRealmFilter（构建 realm 筛选器）
// Realm scope is meaningless on the realms index (you don't search for realms
// inside a single realm). Only `global` permits this index per strict membership.
// 在 realms 索引上 realm 作用域没有意义（你不会在单个 realm 内部搜索 realm）。
// 依据严格成员关系，只有 `global` 允许使用该索引。

export function buildRealmFilter(
  query: SearchQuery,
  _scope: SearchScope,
  ctx: FilterContext = {},
): string[] {
  // Default visibility filter for realms: public only.
  // realm 的默认可见性过滤：仅公开。
  void query;
  const filter = ["isPublic = true"];
  const policyFilter = policyTagUnitIdFilter(ctx);
  if (policyFilter) filter.push(policyFilter);
  return filter;
}

// ANCHOR: buildZoneFilter
// ANCHOR: buildZoneFilter（构建专区筛选器）
// Zone search mirrors realm discovery: only global search exposes the directory
// index, while zone-section queries use their own compiled boundary filters.
// 专区搜索与 realm 发现保持一致：只有全局搜索暴露目录索引；专区分区查询
// 使用自身编译后的边界过滤器。

export function buildZoneFilter(
  query: SearchQuery,
  scope: SearchScope,
  ctx: FilterContext = {},
): string[] {
  const filter =
    scope.kind === "zone" ? [...(ctx.zoneBoundaryZoneFilter ?? [])] : [];
  const policyFilter = policyTagUnitIdFilter(ctx);
  if (policyFilter) filter.push(policyFilter);
  filter.push('visibility = "PUBLIC"');
  void query;
  return filter;
}

// ANCHOR: buildUserFilter
// ANCHOR: buildUserFilter（构建用户筛选器）
// User scope is meaningless on the users index. Only `global` permits this
// index per strict membership. User search currently applies no filters.
// 在 users 索引上 user 作用域没有意义。依据严格成员关系，只有 `global`
// 允许使用该索引。用户搜索目前不应用任何过滤。

export function buildUserFilter(
  _query: SearchQuery,
  _scope: SearchScope,
): string[] {
  return [];
}

// ANCHOR: buildShelfItemFilter
// ANCHOR: buildShelfItemFilter（构建书架条目筛选器）
// Shelf-item search is the grouped shelf-match path. Public viewers search only
// public shelf/item text; owners may also search their occurrence-level
// `ShelfItem.searchText` through attributesToSearchOn in the service.
// 书架条目搜索是分组的书架匹配路径。公开查看者只搜索公开的书架/条目
// 文本；所有者还可通过 service 中的 attributesToSearchOn 搜索其出现级别
// 的 `ShelfItem.searchText`。

export function buildShelfItemFilter(
  _query: SearchQuery,
  scope: SearchScope,
  ctx: FilterContext = {},
  _opts: ShelfItemBuildOpts = {},
): string[] {
  const filter: string[] = [];
  const publicShelf =
    '(shelfVisibility = "PUBLIC" AND shelfStatus = "PUBLISHED")';
  const ownerUserId = ctx.viewerUserId ?? null;

  if (scope.kind === "user") {
    filter.push(`shelfOwnerUserId = "${scope.userId}"`);
    if (ownerUserId !== scope.userId) {
      filter.push(publicShelf);
    }
  } else if (scope.kind === "saved") {
    filter.push(`shelfId = "${scope.shelfId}"`);
    filter.push(`shelfOwnerUserId = "${scope.userId}"`);
    filter.push(`itemType = "unit"`);
    filter.push(`kind = "shelf"`);
    if (ownerUserId !== scope.userId) {
      filter.push(publicShelf);
    }
  } else if (ownerUserId) {
    filter.push(`(${publicShelf} OR shelfOwnerUserId = "${ownerUserId}")`);
  } else {
    filter.push(publicShelf);
  }

  if (scope.kind === "book") {
    filter.push(`itemType = "unit"`);
    filter.push(`itemId = "${scope.unitId}"`);
  } else if (scope.kind === "realm") {
    filter.push(`realmUnitId = "${scope.realmId}"`);
  }

  return filter;
}

// ANCHOR: compileZoneSectionQuery
// ANCHOR: compileZoneSectionQuery（编译专区分区查询）
// Compiles a typed `ZoneSectionQuery` (intersected with the zone-level
// `ZoneBoundaryFilter`) into content/posts/realms/zones index filter + sort expressions.
// Only fields the target index can actually filter/sort are accepted —
// `zoneSectionQueryUnsupportedFields` is the shared validation surface used
// both here and by zone config validation. The sync layer indexes PUBLIC
// units only, so UNLISTED zone fragments never appear in query results; the
// explicit content visibility filter below documents that boundary.
// 将类型化的 `ZoneSectionQuery`（与专区级 `ZoneBoundaryFilter` 取交集）
// 编译为 content/posts/realms/zones 索引的过滤 + 排序表达式。只接受目标索引实际可
// 过滤/排序的字段——`zoneSectionQueryUnsupportedFields` 是这里与专区配置
// 校验共用的校验面。同步层只索引 PUBLIC Unit，因此 UNLISTED 专区片段
// 绝不会出现在查询结果中；下方显式的 content 可见性过滤记录了该边界。

export interface ZoneQueryCompileContext {
  // Resolved from `config.context`; null when the zone context is global.
  // 从 `config.context` 解析；专区语境为 global 时为 null。
  contextRealmUnitId?: string | null;
}

export interface CompiledZoneSectionQuery {
  index: "content" | "posts" | "realms" | "zones";
  filter: string[];
  sort: string[];
}

export function zoneSectionQueryUnsupportedFields(
  query: ZoneSectionQuery,
): string[] {
  const filterable: readonly ZoneSectionQueryFilterField[] =
    ZONE_SECTION_QUERY_FILTERABLE_FIELDS[query.target];
  const sortable: readonly ZoneSectionQuerySortField[] =
    ZONE_SECTION_QUERY_SORT_FIELDS[query.target];
  const unsupported: string[] = [];
  for (const key of Object.keys(query) as (keyof ZoneSectionQuery)[]) {
    if (key === "target" || key === "sort") continue;
    if (query[key] === undefined) continue;
    if (!filterable.includes(key as ZoneSectionQueryFilterField)) {
      unsupported.push(key);
    }
  }
  if (!sortable.includes(query.sort.field)) {
    unsupported.push(`sort.${query.sort.field}`);
  }
  return unsupported;
}

// Marker filter that matches nothing: emitted when the boundary ∩ query
// intersection is empty, because the boundary is unremovable.
// 不匹配任何内容的标记过滤：当边界与查询的交集为空时发出，因为边界
// 不可移除。
const ZONE_EMPTY_INTERSECTION_FILTER =
  'id = "__zone_boundary_empty_intersection__"';

function intersectLists(
  a: readonly string[] | undefined,
  b: readonly string[] | undefined,
): string[] | undefined {
  if (!a) return b ? [...b] : undefined;
  if (!b) return [...a];
  const bSet = new Set(b);
  return a.filter((value) => bSet.has(value));
}

function unionLists(
  a: readonly string[] | undefined,
  b: readonly string[] | undefined,
): string[] | undefined {
  if (!a && !b) return undefined;
  return [...new Set([...(a ?? []), ...(b ?? [])])];
}

function resolveZoneRealmIds(
  realm: ZoneSectionQuery["realm"],
  ctx: ZoneQueryCompileContext,
): string[] | undefined {
  if (realm === undefined) return undefined;
  if (realm === "context") {
    // Global-context zones leave "context" unscoped rather than empty.
    // 全局语境的专区将 "context" 视为不限定，而不是空集。
    return ctx.contextRealmUnitId ? [ctx.contextRealmUnitId] : undefined;
  }
  return realm.unitIds;
}

function resolveZoneLanguages(
  languages: ZoneSectionQuery["languages"],
  ctx: ZoneQueryCompileContext,
): string[] | undefined {
  void ctx;
  if (languages === undefined) return undefined;
  if (languages === "viewer") {
    // Viewer language is display preference, not zone-section visibility.
    // Explicit configured language arrays remain real filters.
    // viewer 语言只影响展示解析，不影响专区分区可见性；显式配置的语言数组才是过滤条件。
    return undefined;
  }
  return [...languages];
}

export function compileZoneSectionQuery(
  query: ZoneSectionQuery,
  boundary: ZoneBoundaryFilter | undefined,
  ctx: ZoneQueryCompileContext = {},
): CompiledZoneSectionQuery {
  const unsupported = zoneSectionQueryUnsupportedFields(query);
  if (unsupported.length > 0) {
    throw new Error(
      `ZoneSectionQuery uses fields unsupported on the ${query.target} index: ${unsupported.join(", ")}`,
    );
  }

  const filter: string[] = [];
  let empty = false;
  const pushIntersected = (
    field: string,
    values: string[] | undefined,
    intersected: boolean,
  ) => {
    if (values === undefined) return;
    if (values.length === 0) {
      if (intersected) empty = true;
      return;
    }
    filter.push(
      values.length === 1
        ? `${field} = "${values[0]}"`
        : `${field} IN [${quoteList(values)}]`,
    );
  };

  const types = intersectLists(query.types, boundary?.types);
  const postKinds = intersectLists(query.postKinds, boundary?.postKinds);
  const realmIds = intersectLists(
    resolveZoneRealmIds(query.realm, ctx),
    resolveZoneRealmIds(boundary?.realm, ctx),
  );
  // Tag filters are AND-ed per tag, so boundary tags compose by union.
  // 标签过滤逐个 AND，因此边界标签按并集组合。
  const tagUnitIds = unionLists(
    unionLists(query.tagUnitIds, query.realmTagUnitIds),
    unionLists(boundary?.tagUnitIds, boundary?.realmTagUnitIds),
  );
  const subjectEntityIds = intersectLists(
    query.subjects?.entityUnitIds,
    boundary?.subjects?.entityUnitIds,
  );
  const subjectRoles = intersectLists(
    query.subjects?.roles,
    boundary?.subjects?.roles,
  );
  const ratings = intersectLists(query.ratings, boundary?.ratings);
  const languages = intersectLists(
    resolveZoneLanguages(query.languages, ctx),
    resolveZoneLanguages(boundary?.languages, ctx),
  );

  if (query.target === "unit") {
    pushIntersected("type", types, Boolean(query.types && boundary?.types));
    pushIntersected(
      "postKind",
      postKinds,
      Boolean(query.postKinds && boundary?.postKinds),
    );
    pushIntersected(
      "realmIds",
      realmIds,
      query.realm !== undefined && boundary?.realm !== undefined,
    );
    for (const tagId of tagUnitIds ?? []) {
      filter.push(`tagIds = "${tagId}"`);
    }
    pushIntersected(
      "subjectEntityIds",
      subjectEntityIds,
      Boolean(
        query.subjects?.entityUnitIds && boundary?.subjects?.entityUnitIds,
      ),
    );
    pushIntersected(
      "subjectRoles",
      subjectRoles,
      Boolean(query.subjects?.roles && boundary?.subjects?.roles),
    );
    pushIntersected(
      "rating",
      ratings,
      Boolean(query.ratings && boundary?.ratings),
    );
    filter.push('visibility = "PUBLIC"');
  } else if (query.target === "post") {
    pushIntersected(
      "kind",
      postKinds,
      Boolean(query.postKinds && boundary?.postKinds),
    );
    pushIntersected(
      "realmIds",
      realmIds,
      query.realm !== undefined && boundary?.realm !== undefined,
    );
    filter.push("isLocked = false");
  } else if (query.target === "realm") {
    if (types !== undefined && !types.includes("REALM")) {
      empty = true;
    }
    if (
      postKinds !== undefined ||
      realmIds !== undefined ||
      tagUnitIds !== undefined ||
      subjectEntityIds !== undefined ||
      subjectRoles !== undefined ||
      ratings !== undefined ||
      query.targetUnitId !== undefined ||
      boundary?.targetUnitId !== undefined
    ) {
      empty = true;
    }
    filter.push("isPublic = true");
  } else {
    if (types !== undefined && !types.includes("ZONE")) {
      empty = true;
    }
    if (
      postKinds !== undefined ||
      tagUnitIds !== undefined ||
      subjectEntityIds !== undefined ||
      subjectRoles !== undefined ||
      ratings !== undefined ||
      query.targetUnitId !== undefined ||
      boundary?.targetUnitId !== undefined
    ) {
      empty = true;
    }
    pushIntersected(
      "ownerRealmUnitId",
      realmIds,
      query.realm !== undefined && boundary?.realm !== undefined,
    );
    filter.push('visibility = "PUBLIC"');
  }

  if (
    query.target !== "realm" &&
    query.target !== "zone" &&
    (query.targetUnitId !== undefined || boundary?.targetUnitId !== undefined)
  ) {
    if (
      query.targetUnitId !== undefined &&
      boundary?.targetUnitId !== undefined &&
      query.targetUnitId !== boundary.targetUnitId
    ) {
      empty = true;
    } else {
      filter.push(
        `targetUnitId = "${query.targetUnitId ?? boundary?.targetUnitId}"`,
      );
    }
  }

  if (languages !== undefined) {
    if (languages.length === 0) {
      empty = true;
    } else {
      filter.push(
        `(isLanguageNeutral = true OR languages IN [${quoteList(languages)}])`,
      );
    }
  }

  if (empty) filter.push(ZONE_EMPTY_INTERSECTION_FILTER);

  return {
    index:
      query.target === "unit"
        ? "content"
        : query.target === "post"
          ? "posts"
          : query.target === "realm"
            ? "realms"
            : "zones",
    filter,
    sort: [`${query.sort.field}:${query.sort.direction ?? "desc"}`],
  };
}
