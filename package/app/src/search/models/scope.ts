import type { SearchScope } from "@rezics/contract";

// ANCHOR: resolveScope
// ANCHOR: resolveScope（路由解析为作用域）
//
// Pure route-to-scope resolver. Single source of truth used by HeaderSearch,
// scoped page mounts, and any link composer that builds a search URL.
//
// The slug-based `/u/:userSlug/...` and `/z/:zoneSlug/...` forms do not produce
// contract `SearchScope` values directly (that requires resolving slug → Unit id
// at the caller site). Instead they return intermediate shapes that callers
// turn into `{ kind: "user", userId }` or `{ kind: "zone", zoneUnitId }`.
//
// 基于 slug 的 `/u/:userSlug/...` 与 `/z/:zoneSlug/...` 形式不会直接产出
// 契约中的 `SearchScope`（那需要在调用方处解析 slug → Unit id）。相反，它们
// 返回中间结构，由调用方转换为 `{ kind: "user", userId }` 或
// `{ kind: "zone", zoneUnitId }`。
//
// The slug-based `/u/:userSlug/...` form does not produce a contract
// `SearchScope` directly (that requires resolving slug → userId at the
// caller site). Instead it returns an intermediate `userSlug` shape that
// callers turn into `{ kind: "user", userId }`.
//
// 纯粹的路由到 scope 的解析器。作为单一可信源，供 HeaderSearch、
// scoped 页面挂载点，以及任何构建搜索 URL 的链接组装器使用。
//
// 基于 slug 的 `/u/:userSlug/...` 形式不会直接产出契约中的
// `SearchScope`（那需要在调用方处解析 slug → userId）。相反，它返回
// 一个中间的 `userSlug` 结构，由调用方转换为 `{ kind: "user", userId }`。

export type ResolvedScope =
  | SearchScope
  | { kind: "userSlug"; userSlug: string }
  | { kind: "zoneSlug"; zoneSlug: string };

const REALM_RE = /^\/realm\/([^/]+)(?:\/|$)/;
const USER_BY_ID_RE = /^\/user\/([^/]+)(?:\/|$)/;
const USER_BY_SLUG_RE = /^\/u\/([^/]+)(?:\/|$)/;
const BOOK_RE = /^\/book\/([^/]+)(?:\/|$)/;
const ZONE_BY_ID_RE = /^\/zone\/([^/]+)(?:\/|$)/;
const ZONE_RE = /^\/z\/([^/]+)(?:\/|$)/;

const RESERVED_SEGMENTS = new Set(["search", "new"]);

export function resolveScope(pathname: string): ResolvedScope {
  const realm = REALM_RE.exec(pathname);
  if (realm && !RESERVED_SEGMENTS.has(realm[1]!)) {
    return { kind: "realm", realmId: realm[1]! };
  }

  const userById = USER_BY_ID_RE.exec(pathname);
  if (userById) {
    return { kind: "user", userId: userById[1]! };
  }

  const userBySlug = USER_BY_SLUG_RE.exec(pathname);
  if (userBySlug) {
    return { kind: "userSlug", userSlug: userBySlug[1]! };
  }

  const book = BOOK_RE.exec(pathname);
  if (book && !RESERVED_SEGMENTS.has(book[1]!)) {
    return { kind: "book", unitId: book[1]! };
  }

  const zoneById = ZONE_BY_ID_RE.exec(pathname);
  if (zoneById && !RESERVED_SEGMENTS.has(zoneById[1]!)) {
    return { kind: "zone", zoneUnitId: zoneById[1]! };
  }

  const zone = ZONE_RE.exec(pathname);
  if (zone && !RESERVED_SEGMENTS.has(zone[1]!)) {
    return { kind: "zoneSlug", zoneSlug: zone[1]! };
  }

  return { kind: "global" };
}

// ANCHOR: isContractScope
// ANCHOR: isContractScope（判断是否为契约作用域）
// Type guard that narrows out the slug intermediate. Useful when callers
// have already resolved the slug to an id and want to treat both forms
// uniformly.
// 类型守卫，用于排除 slug 中间形态。当调用方已将 slug 解析为 id 并希望
// 统一处理两种形态时很有用。

export function isContractScope(scope: ResolvedScope): scope is SearchScope {
  return scope.kind !== "userSlug" && scope.kind !== "zoneSlug";
}
