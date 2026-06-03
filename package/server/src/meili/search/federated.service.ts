import type {
  CommentSearchDocument,
  ContentSearchDocument,
  EntitySearchDocument,
  FederatedSearchOptions,
  FederatedSearchResult,
  PostSearchDocument,
  RealmSearchDocument,
  SearchCategory,
  SearchScope,
  UserSearchDocument,
} from "@rezics/contract";
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
  buildUserFilter,
} from "./filters";
import {
  resolveContentHitDisplay,
  resolvePostHitDisplay,
  resolveRealmHitDisplay,
} from "./read-language";

// ANCHOR: federatedSearch
// Single entry point used by `POST /meili/search/federated`. Branches on the
// requested `category` and computes the scope-permitted index allowlist.

const POST_KIND_BY_CATEGORY: Record<
  "reviews" | "excerpts" | "remarks" | "posts",
  string
> = {
  reviews: "REVIEW",
  excerpts: "EXCERPT",
  remarks: "REMARK",
  posts: "POST",
};

interface PermittedIndexes {
  // BOOK | GAME | MEDIA | LINK content surface
  contentBooks: boolean;
  // SHELF content surface
  contentShelves: boolean;
  posts: boolean;
  comments: boolean;
  realms: boolean;
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
        users: true,
        entities: true,
      };
    case "book":
      // BOOK-side excluded; SHELF allowed via containedUnitIds; posts via
      // targetUnitId. Realms & users excluded.
      return {
        contentBooks: false,
        contentShelves: true,
        posts: true,
        comments: true,
        realms: false,
        users: false,
        entities: false,
      };
    case "realm":
      return {
        contentBooks: true,
        contentShelves: true,
        posts: true,
        comments: true,
        realms: false,
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
        users: false,
        entities: true,
      };
  }
}

function resolveFederatedHitDisplay(
  indexUid: string,
  hit: unknown,
  query: FederatedSearchOptions["query"],
): unknown {
  if (indexUid === "content") {
    return resolveContentHitDisplay(hit as ContentSearchDocument, query as any);
  }
  if (indexUid === "posts") {
    return resolvePostHitDisplay(hit as PostSearchDocument, query as any);
  }
  if (indexUid === "realms") {
    return resolveRealmHitDisplay(hit as RealmSearchDocument, query as any);
  }
  return hit;
}

interface BuiltQuery {
  indexUid: string;
  q: string;
  filter: string[];
  // Optional weight key for federation-mode multi-search.
  weightKey?: keyof typeof federationWeights;
}

function joinFilter(filters: string[]): string | undefined {
  return filters.length > 0 ? filters.join(" AND ") : undefined;
}

export async function federatedSearch(
  client: SearchClient,
  opts: FederatedSearchOptions,
  ctx: FilterContext = {},
): Promise<FederatedSearchResult> {
  const { scope, category, query } = opts;
  const q = query.keyword ?? "";
  const page = opts.page ?? 1;
  const hitsPerPage = opts.hitsPerPage ?? DEFAULT_PAGE_HITS_PER_PAGE;

  // ANCHOR: single category → one-element drill-down
  if (category !== "all" && category !== "mixed") {
    return federatedSingle(client, opts, ctx, q, page, hitsPerPage);
  }

  // ANCHOR: mixed → federated multi-search with weights
  if (category === "mixed") {
    return federatedRanked(client, opts, ctx, q, page, hitsPerPage);
  }

  // ANCHOR: all → grouped sections (per-index totals + capped items)
  return federatedGrouped(client, opts, ctx, q);
}

// ANCHOR: single
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
        resolveContentHitDisplay(hit, query as any),
      );
      totalHits = resp.estimatedTotalHits ?? resp.hits.length;
      processingTimeMs = resp.processingTimeMs;
      break;
    }
    case "shelves": {
      if (!permitted.contentShelves) break;
      const filter = buildContentFilter(query, scope, ctx, {
        contentSubtype: "shelves",
        categoryHint: category,
      });
      const resp = await client.contentIndex.search<ContentSearchDocument>(q, {
        filter: joinFilter(filter),
        offset,
        limit: hitsPerPage,
      });
      items = resp.hits.map((hit) =>
        resolveContentHitDisplay(hit, query as any),
      );
      totalHits = resp.estimatedTotalHits ?? resp.hits.length;
      processingTimeMs = resp.processingTimeMs;
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
      items = resp.hits.map((hit) => resolvePostHitDisplay(hit, query as any));
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
      items = resp.hits.map((hit) => resolveRealmHitDisplay(hit, query as any));
      totalHits = resp.estimatedTotalHits ?? resp.hits.length;
      processingTimeMs = resp.processingTimeMs;
      break;
    }
    case "realms": {
      if (!permitted.realms) break;
      const filter = buildRealmFilter(query, scope);
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

  const hits = (resp.hits ?? []).map((h: any) => {
    const indexUid: string = h._federation?.indexUid ?? "";
    const category = mapIndexToCategory(indexUid, h);
    const resolved = resolveFederatedHitDisplay(indexUid, h, query) as any;
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
    totalHits: (resp as any).estimatedTotalHits ?? hits.length,
    processingTimeMs: resp.processingTimeMs ?? 0,
    page,
    hitsPerPage,
  };
}

// ANCHOR: grouped (all)
async function federatedGrouped(
  client: SearchClient,
  opts: FederatedSearchOptions,
  ctx: FilterContext,
  q: string,
): Promise<FederatedSearchResult> {
  const { scope, query } = opts;
  const limit = DEFAULT_GROUPED_SECTION_LIMIT;
  const built = buildAllSubQueries(query, scope, ctx, "all");
  if (built.length === 0) {
    return { kind: "grouped", scope, sections: {} };
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

  const sections: any = {};
  resp.results.forEach((r: any, idx: number) => {
    const meta = built[idx]!;
    const sectionKey = meta.sectionKey;
    if (!sectionKey) return;
    sections[sectionKey] = {
      totalHits: r.totalHits ?? r.estimatedTotalHits ?? r.hits.length,
      items: r.hits.map((hit: unknown) =>
        resolveFederatedHitDisplay(meta.indexUid, hit, query),
      ),
      processingTimeMs: r.processingTimeMs,
    };
  });

  return { kind: "grouped", scope, sections };
}

// ANCHOR: buildAllSubQueries
// Constructs the full set of permitted sub-queries for grouped/ranked modes.
// For `all` (grouped), each post-kind becomes its own section.
// For `mixed` (ranked), posts are queried as one bucket with no kind filter.

interface BuiltSubQuery extends BuiltQuery {
  // Section name in the grouped variant (`books`, `reviews`, ...).
  sectionKey?:
    | "books"
    | "reviews"
    | "excerpts"
    | "remarks"
    | "posts"
    | "comments"
    | "shelves"
    | "realms"
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

  if (permitted.contentShelves) {
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
    const filter = buildRealmFilter(query, scope);
    out.push({
      indexUid: "realms",
      q: query.keyword ?? "",
      filter,
      weightKey: "realms",
      sectionKey: "realms",
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
// In ranked (federated multi-search) the response is a flat hits[] without
// per-query metadata for posts kinds. Map index → coarse category; for
// post-index hits, refine by document.kind when available.

function mapIndexToCategory(indexUid: string, hit: any): SearchCategory {
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
  if (indexUid === "users") return "users";
  if (indexUid === "entities") return "entities";
  // Fallback for unmapped index uids — treat as posts so the union resolves.
  return "posts";
}
