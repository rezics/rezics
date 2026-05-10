## ADDED Requirements

### Requirement: SearchScope contract

The `@rezics/contract` package SHALL export a `SearchScope` Typebox union representing the route-derived scope of a search request. The union SHALL be exactly:

| Variant | Shape | Source |
|---|---|---|
| `global` | `{ kind: "global" }` | `/search`, no scope path segment |
| `book` | `{ kind: "book", unitId: string }` | `/book/:bookId/search` (also serves `GAME` and `MEDIA` units) |
| `realm` | `{ kind: "realm", realmId: string }` | `/realm/:realmId/search` |
| `user` | `{ kind: "user", userId: string }` | `/user/:userId/search` and `/u/:userSlug/search` (after slug→id resolution) |

#### Scenario: SearchScope is importable from contract

- **WHEN** a consumer imports `SearchScope` from `@rezics/contract`
- **THEN** it SHALL be a Typebox schema usable for type inference and runtime validation
- **AND** the discriminator SHALL be the `kind` field

#### Scenario: Slug-based user scope resolves to id

- **GIVEN** a request with path `/u/:userSlug/search`
- **WHEN** the route-to-scope resolver runs
- **THEN** the resolver SHALL look up the user by slug
- **AND** the produced `SearchScope` SHALL be `{ kind: "user", userId: <resolvedId> }`
- **AND** SHALL never carry a slug in the contract type

### Requirement: SearchCategory contract

The `@rezics/contract` package SHALL export a `SearchCategory` Typebox union enumerating the result-view categories. The union SHALL be exactly: `"all"`, `"mixed"`, `"books"`, `"reviews"`, `"excerpts"`, `"remarks"`, `"posts"`, `"shelves"`, `"realms"`, `"users"`. The default category for any scope SHALL be `"all"`.

#### Scenario: SearchCategory union is exhaustive

- **WHEN** a consumer imports `SearchCategory`
- **THEN** the type SHALL admit only the listed string literals
- **AND** any other value SHALL fail Typebox validation

#### Scenario: chapters is intentionally excluded

- **WHEN** a request specifies `category = "chapters"`
- **THEN** Typebox validation SHALL reject the request with a 400-class error
- **AND** the federated endpoint SHALL NOT include chapter posts in any category surface

### Requirement: Route-to-scope resolver

The frontend SHALL expose a pure function `resolveScope(pathname: string): SearchScope` that maps the current router pathname to a `SearchScope`. The function SHALL be defined in `package/app/src/search/models/scope.ts` and SHALL be the single source of truth used by `HeaderSearch.submit`, scoped page mounts, and any link composer that builds a search URL.

The matching rules SHALL be, in order:

1. `^/realm/(?<realmId>[^/]+)(?:/|$)` and the captured segment is not `search`/`new` → `{ kind: "realm", realmId }`.
2. `^/user/(?<userId>[^/]+)(?:/|$)` → `{ kind: "user", userId }`.
3. `^/u/(?<userSlug>[^/]+)(?:/|$)` → emits a `{ kind: "userSlug", userSlug }` intermediate that the caller resolves to a user id before constructing the contract `SearchScope`.
4. `^/book/(?<bookId>[^/]+)(?:/|$)` and the captured segment is not `search`/`new` → `{ kind: "book", unitId: bookId }`.
5. otherwise → `{ kind: "global" }`.

#### Scenario: Realm path resolves to realm scope

- **WHEN** `resolveScope("/realm/abc/forum")` is called
- **THEN** it SHALL return `{ kind: "realm", realmId: "abc" }`

#### Scenario: User-by-id path resolves to user scope

- **WHEN** `resolveScope("/user/u-42/content")` is called
- **THEN** it SHALL return `{ kind: "user", userId: "u-42" }`

#### Scenario: Book path resolves to book scope

- **WHEN** `resolveScope("/book/b-7/info")` is called
- **THEN** it SHALL return `{ kind: "book", unitId: "b-7" }`

#### Scenario: Directory path is not a scope

- **WHEN** `resolveScope("/realm/search")` is called
- **THEN** it SHALL return `{ kind: "global" }`
- **AND** SHALL NOT treat the literal segment `search` as a realm id

#### Scenario: Unknown path resolves to global

- **WHEN** `resolveScope("/feedback/admin")` is called
- **THEN** it SHALL return `{ kind: "global" }`

### Requirement: Federated search endpoint

The server SHALL expose `POST /meili/search/federated` that accepts a `FederatedSearchOptions` body containing `scope: SearchScope`, `category: SearchCategory`, `query: SearchQuery`, `page?: number` (default 1), `hitsPerPage?: number` (default 20 for single-category, default 5 per index for `all`). It SHALL return a `FederatedSearchResult` whose shape depends on `category`:

- `all` — `{ kind: "grouped", scope, sections: { books, reviews, excerpts, remarks, posts, shelves, realms, users }: { totalHits, items[], processingTimeMs } }`. Each section is present only if `scope` permits its underlying index (per the next requirement).
- `mixed` — `{ kind: "ranked", scope, hits: Array<DocWith_Federation>, totalHits, processingTimeMs, page, hitsPerPage }`. Each hit SHALL carry an `_origin: { indexUid, category }` discriminator that the client uses to render the right card.
- any single category — `{ kind: "single", scope, category, items[], totalHits, processingTimeMs, page, hitsPerPage }`.

#### Scenario: Endpoint exists at the documented path

- **WHEN** the server is running and the contract is deployed
- **THEN** `POST /meili/search/federated` SHALL accept a `FederatedSearchOptions` body
- **AND** SHALL respond with a `FederatedSearchResult` matching the requested category's variant

#### Scenario: All category returns per-section totals

- **GIVEN** `{ scope: { kind: "global" }, category: "all", query: { keyword: "magic" } }`
- **WHEN** the endpoint is called
- **THEN** the response SHALL include `sections.books.totalHits`, `sections.reviews.totalHits`, etc., for every section the scope permits
- **AND** `sections.<name>.items` SHALL be capped at the configured per-section limit (default 5)

#### Scenario: Mixed category uses Meilisearch federation

- **GIVEN** `{ scope: { kind: "global" }, category: "mixed", query: { keyword: "magic" }, page: 1, hitsPerPage: 20 }`
- **WHEN** the endpoint is called
- **THEN** the server SHALL invoke Meilisearch `multiSearch` with `federation: { page, hitsPerPage }`
- **AND** each sub-query SHALL be assigned a `federationOptions.weight` from the configured weights
- **AND** the response SHALL contain a single `hits` array sorted by federated relevance

#### Scenario: Single category drills down

- **GIVEN** `{ scope: { kind: "realm", realmId: "r-1" }, category: "reviews", query: { keyword: "epic" }, page: 2, hitsPerPage: 20 }`
- **WHEN** the endpoint is called
- **THEN** the server SHALL query the `posts` index with filter `kind = "REVIEW" AND realmIds = "r-1"` plus the keyword
- **AND** the response SHALL be a single-variant `FederatedSearchResult` with full `items` for page 2

### Requirement: Strict-membership scope-to-filter mapping

The server SHALL apply scope filters according to the table below. Other indexes for a given scope SHALL be excluded from the request rather than queried with no filter.

| Scope | content (BOOK/GAME/MEDIA/LINK) | content (SHELF) | posts | realms | users |
|---|---|---|---|---|---|
| `global` | (no filter) | (no filter) | (no filter) | (no filter) | (no filter) |
| `book {unitId}` | excluded | `containedUnitIds = unitId` | `rootTargetUnitId = unitId` | excluded | excluded |
| `realm {realmId}` | `realmIds = realmId` | `realmIds = realmId` | `realmIds = realmId` | excluded | excluded |
| `user {userId}` | `userId = userId` | `userId = userId` | `authorUserId = userId` | excluded | excluded |

The orchestrator SHALL NOT execute sub-queries against excluded indexes. Indirect-mention semantics (e.g., posts whose body text references a different book) SHALL NOT be expanded; if a scope doesn't permit an index, results from that index SHALL NOT appear in any category.

#### Scenario: Book scope omits the books and realms indexes

- **GIVEN** `{ scope: { kind: "book", unitId: "b-9" }, category: "all", query: { keyword: "epic" } }`
- **WHEN** the endpoint orchestrates sub-queries
- **THEN** it SHALL NOT issue a Meilisearch query for `realms` or `users`
- **AND** it SHALL issue queries for `posts` (filter `rootTargetUnitId = "b-9"`) and `content` SHELF subset (filter `type = "SHELF" AND containedUnitIds = "b-9"`)
- **AND** the response `sections` SHALL only contain `posts`-derived sections (`reviews`/`excerpts`/`remarks`/`posts`) and the `shelves` section

#### Scenario: Realm scope filters every queried index by realmIds

- **GIVEN** `{ scope: { kind: "realm", realmId: "r-1" }, category: "books", query: {} }`
- **WHEN** the endpoint queries the content index
- **THEN** the filter SHALL include `type = "BOOK" AND realmIds = "r-1"`

#### Scenario: User scope filters content by userId and posts by authorUserId

- **GIVEN** `{ scope: { kind: "user", userId: "u-3" }, category: "all", query: {} }`
- **WHEN** the endpoint orchestrates sub-queries
- **THEN** the content sub-queries SHALL include filter `userId = "u-3"`
- **AND** the posts sub-queries SHALL include filter `authorUserId = "u-3"`

### Requirement: Federation weights are config-driven

The server SHALL read federation weights from a single configuration object (e.g., `package/server/src/meili/search/federation.config.ts`) keyed by index name. The default values SHALL be documented but tunable without a code change to call sites. Changing a weight SHALL NOT require any contract or client update.

#### Scenario: Default weights are documented

- **WHEN** the server starts
- **THEN** the federation weights config SHALL expose values for at least `content`, `posts`, `realms`, `users`
- **AND** a reasonable starting value SHALL be in place (defaults not contractually fixed)

#### Scenario: Weight change is internal

- **GIVEN** a redeploy that only changes the federation weights file
- **WHEN** the server starts
- **THEN** clients SHALL observe the new ranking
- **AND** no API contract SHALL have changed

### Requirement: Default filters are applied to every sub-query

Every content sub-query in the federated orchestrator SHALL apply the default filters required by `content-search-api`: `visibility = "PUBLIC"` and a ratings filter derived from the caller's allowed-ratings set. Post sub-queries SHALL apply `isLocked = false` and exclude soft-deleted posts (per `post-search-index`).

#### Scenario: Rating exclusion applies in federated path

- **GIVEN** `{ scope: { kind: "global" }, category: "all", query: { keyword: "test" } }` with no `ratings` field
- **WHEN** the endpoint orchestrates the content sub-query
- **THEN** the filter SHALL include the caller's allowed `rating IN [...]` set

#### Scenario: Locked posts are excluded

- **GIVEN** the posts index contains a locked post matching the keyword
- **WHEN** any federated category that surfaces posts is queried
- **THEN** the locked post SHALL NOT appear in results

### Requirement: Frontend `useFederatedSearch` query

The `@rezics/api` package SHALL export a `useFederatedSearch(options: FederatedSearchOptions)` TanStack Query hook that calls `POST /meili/search/federated`. The query key SHALL be `["federated-search", options]` deep-equal-keyed; cache time SHALL match other search endpoints.

#### Scenario: Hook returns category-discriminated result

- **GIVEN** `useFederatedSearch({ scope, category: "all", query })`
- **WHEN** the query resolves
- **THEN** `data.kind` SHALL equal `"grouped"`
- **AND** TypeScript SHALL narrow `data` to the grouped variant inside a `data.kind === "grouped"` branch

#### Scenario: Switching category produces a new query

- **GIVEN** the same scope and keyword
- **WHEN** the user changes `category` from `"all"` to `"reviews"`
- **THEN** a new query SHALL fire (different cache key)
- **AND** `data.kind` SHALL equal `"single"` after resolution

### Requirement: `buildSearchPath` accepts scope and category

The `buildSearchPath` helper exported from `@/search` SHALL accept `{ scope: SearchScope, category?: SearchCategory, keyword?: string, tags?: SlugRef[], … }` and return a fully-qualified path with the right base segment per scope and `?q=…&category=…` query params. When `category` is `"all"`, the helper SHALL omit the `category` query param to keep `?q=foo` as the canonical URL.

#### Scenario: Global scope produces /search

- **WHEN** `buildSearchPath({ scope: { kind: "global" }, keyword: "magic" })` is called
- **THEN** the result SHALL be `/search?q=magic`

#### Scenario: Realm scope produces /realm/:id/search

- **WHEN** `buildSearchPath({ scope: { kind: "realm", realmId: "r-1" }, keyword: "epic" })` is called
- **THEN** the result SHALL be `/realm/r-1/search?q=epic`

#### Scenario: Book scope produces /book/:id/search

- **WHEN** `buildSearchPath({ scope: { kind: "book", unitId: "b-7" }, category: "reviews", keyword: "deep" })` is called
- **THEN** the result SHALL be `/book/b-7/search?q=deep&category=reviews`

#### Scenario: All category does not appear in the URL

- **WHEN** `buildSearchPath({ scope: { kind: "global" }, category: "all", keyword: "x" })` is called
- **THEN** the result SHALL be `/search?q=x` with no `category` parameter
