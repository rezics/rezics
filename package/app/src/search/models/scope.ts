import type { SearchScope } from "@rezics/contract";

// ANCHOR: resolveScope
//
// Pure route-to-scope resolver. Single source of truth used by HeaderSearch,
// scoped page mounts, and any link composer that builds a search URL.
//
// The slug-based `/u/:userSlug/...` form does not produce a contract
// `SearchScope` directly (that requires resolving slug → userId at the
// caller site). Instead it returns an intermediate `userSlug` shape that
// callers turn into `{ kind: "user", userId }`.

export type ResolvedScope =
  | SearchScope
  | { kind: "userSlug"; userSlug: string };

const REALM_RE = /^\/realm\/([^/]+)(?:\/|$)/;
const USER_BY_ID_RE = /^\/user\/([^/]+)(?:\/|$)/;
const USER_BY_SLUG_RE = /^\/u\/([^/]+)(?:\/|$)/;
const BOOK_RE = /^\/book\/([^/]+)(?:\/|$)/;

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

  return { kind: "global" };
}

// ANCHOR: isContractScope
// Type guard that narrows out the slug intermediate. Useful when callers
// have already resolved the slug to an id and want to treat both forms
// uniformly.

export function isContractScope(scope: ResolvedScope): scope is SearchScope {
  return scope.kind !== "userSlug";
}
