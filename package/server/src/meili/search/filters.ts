import type {
  ContentRating,
  ListLanguageMode,
  PostKind,
  SearchCategory,
  SearchQuery,
  SearchScope,
} from "@rezics/contract";
import { normalizeLanguage } from "@rezics/contract";

// ANCHOR: shared filter builders for federated search
//
// These builders are pure functions that accept a `SearchQuery` plus the
// route-derived `SearchScope` (and pre-resolved tag/realm ids when relevant)
// and return a Meilisearch filter expression as a string array.
//
// The federated endpoint (`POST /meili/search/federated`) is the single
// caller; each sub-query for a permitted index is built via one of these.
// They are pure so they can be unit-tested without a database client or live
// Meilisearch instance.

export interface FilterContext {
  // Tag ids resolved upstream from `query.tags` (SlugRef[]).
  resolvedTagIds?: string[];
  // Realm unitId resolved upstream from `query.realm` (SlugRef).
  resolvedRealmId?: string | null;
  // Allowed ratings derived from the caller session (already intersected
  // with `query.ratings` if provided). Pass null/undefined for "no rating
  // restriction" (e.g., admin contexts); pass an empty array for "no
  // ratings allowed" — the builder will reject all content.
  allowedRatings?: ContentRating[] | null;
}

export interface ContentBuildOpts {
  // Hint that scopes the content sub-query to either the BOOK-side
  // surfaces or the SHELF subset. Drives `type =` filters and the book
  // scope's `containedUnitIds` join.
  contentSubtype?: "books" | "shelves";
  // Top-level category hint passed by the federated orchestrator.
  categoryHint?: SearchCategory;
}

export interface PostBuildOpts {
  // Maps category to a `kind =` literal; supersedes `query.kind`/`postKind`.
  postCategory?: "reviews" | "excerpts" | "remarks" | "posts";
  categoryHint?: SearchCategory;
}

export interface CommentBuildOpts {
  categoryHint?: SearchCategory;
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

export type ReadLanguageFilterInput = {
  languages?: readonly (string | null | undefined)[] | null;
  appLocale?: string | null;
  languageMode?: ListLanguageMode | null;
};

export function readLanguageFilterCandidates(
  input: ReadLanguageFilterInput,
): string[] {
  return [
    ...new Set(
      [...(input.languages ?? []), input.appLocale]
        .map((language) =>
          typeof language === "string" ? normalizeLanguage(language) : null,
        )
        .filter((language): language is string => !!language),
    ),
  ];
}

export function buildPreferredLanguageFilter(
  input: ReadLanguageFilterInput,
): string | null {
  if (input.languageMode === "all") return null;
  const candidates = readLanguageFilterCandidates(input);
  if (candidates.length === 0) return null;
  return `(isLanguageNeutral = true OR languages IN [${quoteList(candidates)}])`;
}

const BOOK_CONTENT_TYPES = ["BOOK", "GAME", "MEDIA", "LINK", "SERIES"];

const BOOK_CONTENT_CATALOG_FILTER = [
  '(type = "BOOK" AND catalogEntryKind = "MAIN")',
  '(type = "GAME" AND catalogEntryKind = "MAIN")',
  '(type = "MEDIA" AND catalogEntryKind = "MAIN")',
  'type = "LINK"',
  'type = "SERIES"',
].join(" OR ");

function resolveBookScope(scope: SearchScope): {
  mode: "exact";
  unitId: string;
} {
  if (scope.kind === "book") return { mode: "exact", unitId: scope.unitId };
  throw new Error("resolveBookScope requires a book scope");
}

// ANCHOR: buildContentFilter
// Maps SearchScope onto the content index per the strict-membership table:
//   global → no scope filter
//   book   → contentSubtype must be "shelves" (BOOK/GAME/MEDIA/LINK excluded)
//          → containedUnitIds = unitId AND type = "SHELF"
//   realm  → realmIds = realmId
//   user   → userId = userId

export function buildContentFilter(
  query: SearchQuery,
  scope: SearchScope,
  ctx: FilterContext = {},
  opts: ContentBuildOpts = {},
): string[] {
  const filter: string[] = [];

  // 1. Type filter
  if (opts.contentSubtype === "shelves") {
    filter.push(`type = "SHELF"`);
  } else if (opts.contentSubtype === "books") {
    // BOOK-side content surfaces (BOOK | GAME | MEDIA | LINK)
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
  if (scope.kind === "book") {
    const bookScope = resolveBookScope(scope);
    filter.push(`containedUnitIds = "${bookScope.unitId}"`);
  } else if (scope.kind === "realm") {
    filter.push(`realmIds = "${scope.realmId}"`);
  } else if (scope.kind === "user") {
    filter.push(`userId = "${scope.userId}"`);
  }

  // 3. Resolved realm tag (from query.realm SlugRef)
  if (ctx.resolvedRealmId && scope.kind !== "realm") {
    filter.push(`realmIds = "${ctx.resolvedRealmId}"`);
  }

  // 4. Tag IDs (already resolved from SlugRefs)
  for (const tagId of ctx.resolvedTagIds ?? []) {
    filter.push(`tagIds = "${tagId}"`);
  }

  // 5. Preferred read languages. Visibility filtering is separate from
  // resolved-display selection, which happens after each hit is returned.
  const languageFilter = buildPreferredLanguageFilter(query);
  if (languageFilter) {
    filter.push(languageFilter);
  }

  // 6. Ratings — intersect query.ratings with allowedRatings if both provided
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
  if (query.aiDisclosureModes?.length) {
    filter.push(`aiDisclosureMode IN [${quoteList(query.aiDisclosureModes)}]`);
  }

  // 8. License
  if (query.isLicensed === true) filter.push("isLicensed = true");
  else if (query.isLicensed === false) filter.push("isLicensed = false");

  // 9. Text length
  if (query.textLength) {
    if (typeof query.textLength.min === "number") {
      filter.push(`textLength >= ${query.textLength.min}`);
    }
    if (typeof query.textLength.max === "number") {
      filter.push(`textLength <= ${query.textLength.max}`);
    }
  }

  // 10. Visibility — content search is always public-only.
  filter.push('visibility = "PUBLIC"');

  return filter;
}

// ANCHOR: buildPostFilter
// Scope mapping for posts:
//   global → no scope filter
//   book   → targetUnitId = unitId
//   realm  → realmIds = realmId
//   user   → authorUserId = userId

export function buildPostFilter(
  query: SearchQuery,
  scope: SearchScope,
  _ctx: FilterContext = {},
  opts: PostBuildOpts = {},
): string[] {
  const filter: string[] = [];

  // 1. Kind filter — category-implied wins; otherwise honor query.kind / query.postKind
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
  if (scope.kind === "book") {
    filter.push(`targetUnitId = "${scope.unitId}"`);
  } else if (scope.kind === "realm") {
    filter.push(`realmIds = "${scope.realmId}"`);
  } else if (scope.kind === "user") {
    filter.push(`authorUserId = "${scope.userId}"`);
  }

  // 3. Locked posts excluded by default (per content-search-api default filters).
  filter.push("isLocked = false");

  const languageFilter = buildPreferredLanguageFilter(query);
  if (languageFilter) {
    filter.push(languageFilter);
  }

  return filter;
}

// ANCHOR: buildCommentFilter
// Scope mapping for comments:
//   global → no scope filter
//   book   → rootUnitId = unitId
//   realm  → realmUnitId = realmId
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
  }

  filter.push("isLocked = false");
  return filter;
}

// ANCHOR: buildRealmFilter
// Realm scope is meaningless on the realms index (you don't search for realms
// inside a single realm). Only `global` permits this index per strict membership.

export function buildRealmFilter(
  query: SearchQuery,
  _scope: SearchScope,
): string[] {
  // Default visibility filter for realms: public only.
  const filter = ["isPublic = true"];
  const languageFilter = buildPreferredLanguageFilter(query);
  if (languageFilter) {
    filter.push(languageFilter);
  }
  return filter;
}

// ANCHOR: buildUserFilter
// User scope is meaningless on the users index. Only `global` permits this
// index per strict membership. User search currently applies no filters.

export function buildUserFilter(
  _query: SearchQuery,
  _scope: SearchScope,
): string[] {
  return [];
}
