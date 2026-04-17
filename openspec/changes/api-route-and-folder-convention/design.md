## Context

Today `@rezics/server` exposes 28 Elysia route trees. Their prefixes are a mix of plural (`/books`, `/posts`, `/users`, `/tags`, `/zones`, `/shelves`, `/chapters`, `/feedbacks`, `/links`, `/realms`, `/reactions`, `/units`) and singular (`/user`, `/user/brief`, `/score`, `/shelf`, `/collect`, `/token`, `/session`, `/dm`, `/upload`, `/dispatch`, `/echokv`, `/internal`, `/meili`, `/.well-known`). Batch-by-id access exists in three incompatible shapes: `GET /users/batch?ids=a,b,c` (CSV), `GET /users/follow/status?targetIds=a&targetIds=b` (repeated params), and `POST /user/brief` with `{unitIds: [...]}` (JSON body). Seven domains (post, book, chapter, shelf, realm, reaction, score) have no batch hydration endpoint at all, forcing the frontend to either issue N+1 requests or to filter a list response client-side.

Folder naming tells a parallel story. All 29 domain folders under `package/server/src/` and `package/api/src/` are already singular, as are all 20+ feature folders under `package/app/src/`. But container folders — `hooks`, `utils`, `components`, `types`, `routes` — appear plural in 24 places and singular in 5, with no rule distinguishing the two. The project's own `package/app/docs/feature standard.md` ships this inconsistency baked in (`hooks/` plural, `util/` singular, on the same page).

A previous attempt at a `/list` convention was abandoned because enforcement never happened: as new endpoints were added without `/list`, later authors copied the nearest example, and the convention decayed within a dozen commits. That failure mode is the primary design constraint for this change — any convention introduced here that relies on author memory will fail the same way.

## Goals / Non-Goals

**Goals:**
- Establish a single, unambiguous route shape for `@rezics/server` covering resource, single-item, list/batch, and nested-resource cases.
- Establish a single, unambiguous folder naming rule that covers both domain and container folders without carve-outs per package.
- Make both conventions machine-checkable, so violations fail a pre-commit hook and CI step rather than waiting on reviewer vigilance.
- Consolidate the three existing batch-access shapes into one (GET-querystring for small / POST-body for large), with identical schemas on both transports.
- Preserve HTTP cacheability for simple reads (GET stays a first-class transport).

**Non-Goals:**
- Migrating any existing route, folder, or caller. This change is spec + tooling only. A follow-up migration change will handle the grunt work.
- Touching `@rezics/auth` — it inherits better-auth's route shape and is out of scope.
- Redesigning pagination, sorting, cursor, or filter semantics beyond adding the `ids` field to the shared list-query base.
- Routing-level aliasing or gradual deprecation of old paths. The migration change will flip atomically per domain.
- Prisma-generated folders (`prisma/generated/**`) — these are tool output, outside the convention.

## Decisions

### D1: Singular resource prefix + `/list` suffix for collection access

Route shape:

```
GET    /{resource}/:unitId       single item
GET    /{resource}/list          list / batch (querystring filters + ?ids=a,b,c)
POST   /{resource}/list          list / batch (JSON body, same schema)
POST   /{resource}               create
PUT    /{resource}/:unitId       update
DELETE /{resource}/:unitId       delete
GET    /{resource}/:unitId/{sub}/list   nested collection
GET    /{resource}/:unitId/{sub}/:id    nested single
```

**Why singular resource:** folder layer is already 100% singular, and the stronger signal is that a noun prefix like `/book` reads naturally as "book namespace", whereas `/books` reads as "list of books" — which contradicts `GET /books/:id` returning one book. Singular aligns path semantics with Elysia's `prefix:` being a namespace, not a collection.

**Why `/list` suffix:** with singular resource, `GET /book` is awkward — is it "the book" or "all books"? The `/list` suffix resolves it cleanly and parallels the single-item path (`/book/:unitId` vs `/book/list`). It also gives the POST-body transport a natural home (`POST /book/list`) without colliding with create (`POST /book`).

**Alternatives considered:**
- *Plural resource + no suffix* (current mixed state): status quo, rejected because batch/create verbs have to share `POST /books` which is semantically muddled, and because the current mix already confuses contributors.
- *Singular resource + `/search` suffix* (Algolia/Notion style): "search" implies text query semantics; our list endpoints also serve pure-id hydration where "search" is a lie.
- *Singular resource + no suffix, method-overload* (`GET /book` lists, `POST /book` can be create or batch-query depending on body shape): failed Postel's principle, and TanStack Query key design becomes error-prone.

### D2: `ids` as a first-class field on every list query

Every `*ListQuerySchema` in `@rezics/contract` gains an optional `ids: t.Array(t.String(), { maxItems: 200 })` field. The field is mirrored between GET (CSV string parsed server-side) and POST (array directly). `ids` composes with other filters via intersection — if both `ids` and `status` are present, only items matching both are returned. Server response shape is unchanged: `{ items: T[], total?: number }` or cursor-paginated equivalent; ordering follows normal sort rules, not input-id order.

**Why 200:** balances typical frontend needs (a page of posts with 30 actor avatars, a notification page with 50–100 actors) against DB `IN` performance. 200 is large enough to cover every real use case surfaced in current code, small enough that a single `findMany({ where: { unitId: { in: ids } } })` stays fast.

**Why intersection semantics:** it's the only rule that makes `ids` composable with `status`, `kind`, or `realmUnitId` without special-casing. "Hydrate these 50 ids, but only if published" is a real use case.

**Why not preserve input order:** server-side `ORDER BY FIELD(id, ...)` is dialect-specific and defeats Prisma's query planner; ordering is cheap to restore client-side via a `Map` lookup.

### D3: Single shared `listQueryBase` mixin in `@rezics/contract`

Introduce one place:

```ts
// package/contract/src/list-query-base.ts
export const listQueryBase = t.Object({
  ids: t.Optional(t.Array(t.String(), { maxItems: 200 })),
});

/** When ids.length > 30 or filters contain nested objects, prefer POST /{resource}/list. */
```

Every `*ListQuerySchema` spreads `...listQueryBase.properties`. The comment above is the canonical guidance for when to switch transport; the check script (D6) can later warn on call sites passing >30 ids to a GET.

**Why one place:** a single edit propagates; JSDoc lives where it's visible; and the migration change can enforce "every list schema MUST import listQueryBase" as a mechanical check.

**Alternative considered:** per-domain duplication of the `ids` field. Rejected — that's how we got three incompatible batch shapes in the first place.

### D4: Folder naming — β dual-track (singular domain, plural container allowlist)

```
<feature>/
  hooks/         container → plural
  utils/         container → plural
  components/    container → plural
  pages/         container → plural
  sections/      container → plural
  states/        container → plural
  models/        container → plural
  types/         container → plural
  routes/        container → plural (also TanStack Router's shape)
  <subfeature>/  domain    → singular
```

**Plural container allowlist (fixed):** `hooks, utils, components, pages, sections, states, models, types, routes, handlers, providers, plugins, styles, helpers, constants, fixtures, mocks`.

Anything not on the allowlist is singular. Adding to the allowlist requires amending this spec.

**Why β over α (everything singular):** container folders are semantically "bags of N same-kind files". English (and Chinese) default to plural for such bags. `hooks/` follows React/community idiom; renaming it to `hook/` optimizes for a one-sentence rule at the cost of readability in ~50 import sites. The prior `/list` failure shows that reversals-of-habit don't stick — β rides with habit instead of against it.

**Why β over γ (tolerate existing `hooks` plural, `util` singular split):** γ leaves the `util`/`utils` inconsistency unresolved forever. β normalizes by picking plural for both, matching the larger cohort of `utils/` sites.

**Why a fixed allowlist and not "any folder with N files":** file count varies over time; a fuzzy rule is unenforceable. An explicit list is grep-able, lint-able, and reviewable.

### D5: Brief stays independent but adopts the same naming

`/user/brief/:unitId` and `/user/brief/list` follow the convention without merging into a generic batch framework. Brief is a separate capability (lightweight user cards for hover/mention/actor contexts) with its own projection (`name, slug, bio, avatar`) — not every resource needs a brief, and brief has different access semantics (usually public) than the full resource. The naming convention applies to its routes; the feature stays its own module.

### D6: Enforcement — pre-commit script + CI step

`tool/scripts/check-convention.ts` performs three scans:

1. **Route prefix scan:** parse `new Elysia({ prefix: "..." })` call sites across `package/*/src`. Reject `prefix` values ending in common plural markers (`s`, `es`) unless the bare stem is itself a valid singular English noun that happens to end in `s` (e.g., `stats` — handled via explicit allowlist). Flag prefixes that contain known plural resource names from a fixed denylist derived from this change's migration scope.
2. **List-suffix scan:** parse `.get("/", …)` and `.post("/", …)` handlers whose return type contains `items` or resembles a list response, and require the route path to end in `/list`.
3. **Folder-name scan:** walk `package/*/src/**` (excluding `prisma/generated/**`). Reject plural folder names not on the container allowlist. Reject singular folder names that equal any entry on the plural container allowlist.

Integration:
- Pre-commit: `lefthook.yml` adds a pre-commit step running `bun run check:convention -- --staged`.
- CI: the existing CI workflow gains a `bun run check:convention` step before tests.
- Local: `bun run check:convention` available as a package.json script.

**Why a custom script over ESLint custom rule:** route-prefix parsing requires reading Elysia chain calls across files, which ESLint AST rules handle poorly; folder scanning isn't an ESLint concern at all. A single Bun script is ~100 lines and covers all three checks uniformly. ESLint can be layered later if editor-time feedback becomes valuable.

### D7: CLAUDE.md update is canonical summary, spec is canonical source

`CLAUDE.md` gains a short "API Route & Folder Convention" section — two or three paragraphs plus a pointer to `openspec/specs/api-route-convention/spec.md` and `openspec/specs/folder-naming-convention/spec.md`. `package/app/docs/feature standard.md` is edited to align its `util/` example with the new `utils/` container plural rule and to link upward to the spec instead of redefining.

**Why two touchpoints:** CLAUDE.md is always loaded into Claude's context; a spec alone wouldn't be read during casual coding. The spec is the durable source of truth and supports `openspec validate`; CLAUDE.md is the quick-reference pointer.

## Risks / Trade-offs

- **[Enforcement script false positives on edge cases like `/stats`, `/meili`, `/.well-known`]** → Mitigation: ship the script with an explicit allowlist for these four names baked in (`stats`, `meili`, `well-known`, `jwt-services` under `/admin/`). Any future additions require amending the spec, which is a reviewable event.

- **[Folder allowlist drift — someone introduces `foos/` that isn't on the list]** → Mitigation: the script rejects unknown plural folders, forcing the author to either rename to singular or propose a spec amendment. The rejection is visible at pre-commit, not review.

- **[`ids` field abused as primary query path instead of typed filters]** → Mitigation: the JSDoc on `listQueryBase` explicitly guides usage ("`ids` is for hydration / batch-by-id, not for smuggling filter logic"); the 200 cap makes abuse costly. No further mitigation needed — this is a code-review concern, not a tooling one.

- **[Convention adopted on paper but ignored in practice — repeat of the prior `/list` failure]** → Mitigation: the entire D6 block exists to prevent this. Pre-commit + CI means a violating PR cannot land. This is the single most important mitigation in the design; without it the proposal is worthless.

- **[TanStack Router's `routes/` plural is a hard dependency]** → Acknowledged and handled by the β allowlist — `routes` is on the plural allowlist. No conflict.

- **[`/units` → `/unit` route rename collides with translation-group's current `/unit` prefix]** → Out of scope for this change (spec-only); flagged here so the follow-up migration addresses it by renaming translation-group's prefix to `/translation-group`. Translation-group's folder is already `translation-group/` (singular), so only the Elysia prefix moves.

- **[Cost of the follow-up migration change]** → Acknowledged, not mitigated here. Estimate: ~13 server prefix renames + ~10 frontend `apiFetch` call sites + 1 prefix collision resolution + subfolder normalization in `app/book-edit/hook` and a few `util/` → `utils/` sites. All mechanical; no business logic touched.
