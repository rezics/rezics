## Context

The predecessor change `api-route-and-folder-convention` (archived 2026-04-17 at `openspec/changes/archive/2026-04-17-api-route-and-folder-convention/`) wrote three capability specs, added the `listQueryBase` mixin to `@rezics/contract`, shipped `tool/scripts/check-convention.ts` + `tool/scripts/expected-violations.json`, wired lefthook and CI, and updated `CLAUDE.md`. That change deliberately migrated no runtime code. The baseline snapshot captured 151 existing violations across four rules:

- **R1** (plural resource prefix): 15 sites. `/books`, `/chapters`, `/feedbacks`, `/links`, `/notifications`, `/posts`, `/reactions` (×2), `/realms`, `/shelves`, `/tags`, `/units`, `/users` (×2), `/zones`.
- **R2** (list handler mounted at prefix root without `/list` suffix): 12 sites across book, chapter, feedback, echokv, jwt-admin, post, realm, shelf, unit.
- **R3** (singular container folder that should be plural): 112 sites. Dominant stems: `component`, `page`, `section`, `state`, `model`, `util`, `hook`, `layout`, `provider`, `plugin`, `style`, `mock`, `asset`, `doc`, `template`.
- **R4** (plural folder not on the container allowlist): 12 sites. Mix of domain folders that happened to be plural (`realms/`, `shelves/`, `units/`, `users/`, `stats/`) and plural domain sub-buckets (`charts/`, `preferences/`, `settings/`, `adapters/`, `contracts/`).

The convention specs under `openspec/specs/{api-route-convention,folder-naming-convention,convention-enforcement}/spec.md` already describe the target state. This change contains no spec-level redesign; its job is to bring the code into conformance and remove the temporary baseline.

Three hard constraints shape the design:

1. **Route renames are HTTP-breaking.** There is no alias layer. Server and client must ship together. This rules out incremental per-domain PRs unless each one owns its frontend callers in the same commit — which in practice means a single PR, because the client changes fan out across `@rezics/api`, `@rezics/app`, and `@rezics/admin`.
2. **Folder renames are import-path-breaking.** Every `import` site referencing a renamed directory updates. Tooling (TypeScript, Vite, Biome/Knip) catches failures, but the blast radius means the work is best batched alongside the route renames to amortize the review cost.
3. **The baseline snapshot must disappear at the end.** Leaving it at `{ total: 0 }` would be dead code; deleting it alters the script's behaviour (no more baseline-filtering), so the script needs a small code change too.

## Goals / Non-Goals

**Goals:**

- Drive `bun run check:convention` to exit 0 with **no baseline file present**, against the full repo.
- Rename the 15 plural HTTP prefixes to singular, update the 12 root list handlers, and relocate the 112+12 folder violations, all in one coordinated PR.
- Spread `...listQueryBase.properties` into every `*ListQuerySchema` in `@rezics/contract` so the `ids` contract becomes universal rather than aspirational.
- Keep the enforcement script (`tool/scripts/check-convention.ts`), the lefthook job, and the CI step running as a permanent guard at zero-tolerance.
- Preserve behaviour for all non-renaming work: no new features, no new deprecations, no DB changes.

**Non-Goals:**

- Dismantling the enforcement infrastructure. The script, hook, and CI step stay. Only the baseline snapshot goes.
- Touching `@rezics/auth` routes or folders. better-auth governs that surface.
- Adding route aliases, redirects, or backward-compatibility layers for the renamed prefixes.
- Changing cursor, pagination, or filter semantics beyond what `listQueryBase` already added.
- Migrating Prisma schemas, DB migrations, or any persistence layer.
- Optimizing the migration into multiple PRs. Proposal rules this out explicitly.

## Decisions

### D1: Single atomic PR, no dual-maintenance aliases

Route renames go out in one PR that also updates every in-repo caller. No alias layer. No parallel `/books` + `/book` window.

**Why:** dual-maintenance has cost proportional to migration duration. With no external consumers of these prefixes (the repo is closed), the cost of breaking one deploy window is near zero. Change 1's design reached the same conclusion; this change only has to honour it.

**Alternatives considered:**

- *Per-domain PRs with temporary aliases.* Each domain (book, post, tag …) renamed independently, with the old prefix remaining as a forwarding route for a week. Rejected: 13 domains × 2 callers (server alias + client update) = 26 incidental code sites, plus a registry of which aliases are still live. More work than the cost of one coordinated deploy.
- *Server-only rename + client adapter layer that rewrites URLs.* Rejected: adds a moving part whose only purpose is to fake the old convention. The adapter layer itself becomes a new source of drift.

### D2: `/unit` prefix collision resolution

`translation-group/translation-group.api.ts` currently declares `new Elysia({ prefix: "/unit" })`. After renaming `/units` → `/unit` on the actual unit domain, two route trees would claim the same path.

**Decision:** rename translation-group's prefix to `/translation-group`. Only the Elysia `prefix:` string changes; the folder `package/server/src/translation-group/` is already singular so no folder work is needed, and the domain is still young enough that no external caller depends on `/unit` as its path.

**Alternative considered:** keep translation-group at `/unit` and rename unit to something else (e.g., `/entity`). Rejected: `unit` is the canonical domain name — every internal reference, Prisma model, and content-model doc uses "unit". Moving the canonical name to disambiguate a younger sibling is backwards.

### D3: Folder-rename execution strategy — `git mv` + bulk import rewrite

For each folder rename (e.g., `package/app/src/book-edit/component/` → `components/`):

1. `git mv <old> <new>` — preserves history.
2. Bulk-replace imports: any path matching the renamed segment is rewritten. Tooling: a throwaway `bun` script using `Bun.Glob` + string replace, or `rg --files-with-matches | xargs sed`. Scope limited to `.ts`, `.tsx`, barrel `index.ts`, and docs.
3. Run `tsc --noEmit` per package (user preference: per-package, not monorepo-wide — see feedback memory) to catch missed sites.
4. Run `bun test` where applicable and `bun run build` in frontend packages to verify Vite resolves cleanly.

**Why `git mv` + separate import pass:** keeps the rename diff small and reviewable; the import rewrite lands as a second logical commit (can still be one PR) that reviewers can skim since it's mechanical. An all-in-one `codemod` would work but produces a single diff that's hard to split by directory during review.

**Alternatives considered:**

- *`ts-morph` codemod.* More "correct" but pulls in a heavy dep for a one-shot task. The string-replace approach has a well-defined boundary (`/<stem>/` or `'/<stem>/'` in import paths) and fails loudly via `tsc` on misses.
- *Rename + let CI catch the import misses.* Rejected: CI runs on push, the feedback loop is minutes; local tsc is seconds.

### D4: Non-allowlisted plurals (R4) handled case-by-case

The 12 R4 entries are not uniform. Three categories:

- **Domain plurals that should be singular:** `realms/`, `shelves/`, `units/`, `users/`, `charts/` (under `admin/home/component/`) → rename to singular (`realm/`, `shelf/`, `unit/`, `user/`, `chart/`).
- **Plural sub-bucket that signals a container family not yet allowlisted:** `adapters/`, `contracts/` (both under `package/jwt/src/`). These are container folders holding N sibling modules — arguably legitimate plurals. Resolution: amend `folder-naming-convention/spec.md` to add `adapters` and `contracts` to the container allowlist; mirror in `tool/scripts/check-convention.ts`. This is the one case where the change does touch a capability spec — a minor allowlist extension, not a behaviour shift.
- **Ambiguous:** `stats/`, `preferences/`, `settings/`. `stats/` is already on the route-prefix allowlist (`api/src/stats` is a stats-dashboard module) → rename folder to `stat/` OR add `stats` to folder allowlist. Project convention favours singular domain, so rename. `preferences/` and `settings/` are app-level domain folders (user-facing settings pages) → rename to singular (`preference/`, `setting/`). Admin's `routes/_admin/realms` and `routes/_admin/shelves` follow the TanStack Router shape with nested params — these are URL-segment folders that mirror the now-singular route paths, so they become `realm/` and `shelf/` in lockstep with the prefix rename.

**Why not auto-handle R4:** the decisions are semantic, not mechanical. Tasks.md enumerates each and the rationale; allowlist extensions are one per spec amendment.

### D5: Script simplification — baseline becomes optional

The current `tool/scripts/check-convention.ts` loads `expected-violations.json`, subtracts baseline keys from found violations, and fails only on *new* violations. Post-migration, the baseline file is deleted.

**Decision:** the script treats a missing baseline as an empty set. The code path already handles `{ total: 0, keys: [] }`; we change the file-load step to `try { read } catch (ENOENT) { return { total: 0, keys: [] } }`. No other script logic changes.

**Why:** keeps the script's output format stable, keeps the `--snapshot` flag usable (developers can still regenerate a baseline if a future migration needs one), and avoids a second "script rewrite" change.

**Alternative considered:** rip out baseline support entirely. Rejected: the snapshot mechanism is genuinely useful as a *ratchet* during future multi-step migrations. Keeping it dormant but functional is cheap.

### D6: Contract mixin split — CSV for GET, array for POST

Change 1 exported a single `listQueryBase` with `ids: t.Array(t.String())`, but that schema silently fails on `GET ?ids=a,b,c` because Elysia hands the querystring value through as the raw `string` `"a,b,c"` without splitting. Rather than paper over the transport difference with a `t.Union` or a hidden transform, the contract now exports two honest mixins:

```ts
// package/contract/src/list-query-base.ts
export const listGetQueryBase = t.Object({
  ids: t.Optional(t.String()),                       // CSV, split by the handler
});

export const listPostBodyBase = t.Object({
  ids: t.Optional(t.Array(t.String(), { maxItems: 200 })),
});

export function parseIdsCsv(raw: string | undefined): string[] | undefined {
  // trim + dedupe + throw over 200
}
```

Spreading:

```ts
// before
export const bookListQuerySchema = t.Object({
  kind: t.Optional(t.String()),
  limit: paginationLimitSchema,
});

// after (GET querystring schema)
export const bookListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  kind: t.Optional(t.String()),
  limit: paginationLimitSchema,
});

// POST body schema — created only when a domain adds POST /list
export const bookListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  kind: t.Optional(t.String()),
  limit: paginationLimitSchema,
});
```

Handlers:

```ts
.get("/list", async ({ query }) => {
  const idList = parseIdsCsv(query.ids);
  return service.list({ ...query, ids: idList });
})
.post("/list", async ({ body }) => {
  return service.list({ ...body });   // body.ids is already string[]
})
```

**Why two bases instead of one union:** a `t.Union([t.String(), t.Array(t.String())])` works on paper but leaks transport concerns into every handler and makes typed use awkward (`typeof query.ids === "string" ? …`). Two mixins keep each handler's type narrow and make the CSV/array choice an explicit authoring decision.

**Why remove `listQueryBase` instead of aliasing:** Change 1 task 3.3 explicitly said "do NOT modify any existing `*ListQuerySchema`". Nothing consumes the old export. Keeping it as a deprecated alias would just invite accidental misuse.

**Scope of this change's spread:** all 12 existing `*ListQuerySchema` (GET querystring today) get `listGetQueryBase`. POST body schemas are created only per-domain when a POST `/list` endpoint is actually added — not speculatively. Server handlers that need to act on `ids` gain `const idList = parseIdsCsv(query.ids); if (idList?.length) where.unitId = { in: idList };` in their Prisma query builder. Scope remains small — 12 list endpoints, each gets ~3 lines in its service layer.

**Why include the `ids` handler logic in this change:** otherwise the contract advertises an `ids` field that doesn't work. The spec's "Universal batch-hydration" requirement would be false on paper. Shipping the schema without the handler would be a lie.

### D7: Frontend caller sweep

Three categories of caller update:

- `package/api/src/**` — `apiFetch`, `createApiQuery`, and TanStack Query `queryKey` factories referencing a renamed path. Renames here cascade to every consumer via the typed API layer, so the compile error surface is informative.
- `package/app/src/**` and `package/admin/src/**` — direct `apiFetch` calls bypassing the `@rezics/api` layer (grep first; these should be rare). Any survivors gain direct path updates.
- Test fixtures or MSW handlers referencing old paths. `grep -r "'/books\|'/users\|'/posts" package/` should be empty after the sweep.

**Validation gate:** every package's `tsc --noEmit` passes, and `bun run build` in `@rezics/app` and `@rezics/admin` produces a Vite bundle.

## Risks / Trade-offs

- **[Coordinated deploy risk — a partial rollout breaks all callers]** → Mitigation: single PR, single deploy. Document in release notes. No partial mode exists; the PR body carries a "deploy checklist" linking server and client readiness.

- **[Frontend caller miss — a stray `apiFetch("/posts")` survives the sweep]** → Mitigation: the enforcement script is routes-only; it doesn't see client paths. TypeScript catches it only when the caller uses the typed `@rezics/api` layer. Safety net: post-migration grep for string-literal old prefixes in `.ts/.tsx` files under `package/{api,app,admin}/src/**`. Any match is a bug.

- **[`ids` handler integration misses an endpoint]** → Mitigation: per-endpoint service-layer edit is explicit in tasks.md, and an integration test per domain (where one exists) verifies `GET /book/list?ids=a,b` returns only those ids. Where no test exists, manual smoke.

- **[R4 case-by-case decisions disagreed at review]** → Mitigation: tasks.md explicitly enumerates each of the 12 with rationale. If a reviewer dissents on `adapters`/`contracts` allowlist extension, fall back to renaming them singular — pure code change, no spec amendment needed.

- **[Import-rewrite script corrupts an unrelated string literal containing the old folder name]** → Mitigation: the rewrite pattern anchors on path separators (`/component/` not `component`), and the rewrite runs under git so `git diff` shows every affected line for review. Any unexpected edit gets reverted.

- **[Snapshot file deletion pre-empts a future need for a baseline]** → Acknowledged. Script's missing-file tolerance (D5) means a future change that wants a baseline can regenerate with `--snapshot` and commit the file fresh. No mechanism is lost.

- **[`convention-enforcement` spec's "Check script reflects spec allowlists" requirement means the allowlist extension for `adapters`/`contracts` triggers a same-change script update]** → Mitigation: tasks.md pairs the spec amendment and the script edit as adjacent tasks under the same section so the requirement is trivially satisfied.

- **[CI fails mid-migration PR on some unrelated transient]** → Standard PR risk; not migration-specific. Normal retry flow applies.

### D8: POST `/list` handler pattern — shared service input, transport-level normalize

Every domain that exposes `GET /list` also exposes `POST /list`. Both handlers converge on the same service call:

```ts
// contract: book.ts
export const bookListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  kind: t.Optional(t.String()),
  limit: paginationLimitSchema,
});

export const bookListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  kind: t.Optional(t.String()),
  limit: paginationLimitSchema,
});

// server: book.api.ts
.get("/list", async ({ headers, query }) => {
  const idList = parseIdsCsv(query.ids);
  return service.list({ ...query, ids: idList });
}, { query: bookListQuerySchema })
.post("/list", async ({ headers, body }) => {
  return service.list(body);  // body.ids is already string[]
}, { body: bookListBodySchema })
```

The service layer's `list(input)` method accepts a unified shape where `ids` is always `string[] | undefined`. GET handlers normalize CSV → array via `parseIdsCsv`; POST handlers pass `body` directly. No business logic duplication.

**Why not a shared handler factory:** each domain's handler has slightly different concerns (auth checks, admin overrides, response mapping). A factory would need so many options that it would be harder to read than the ~5-line handler. Keep it explicit.

**Scope:** all 11 domains with existing `GET /list` endpoints — book, chapter, echokv, feedback, jwt (admin), notification, post, realm, shelf, tag, unit, user.

### D9: CONTRIBUTING.md as convention single source of truth

The route and folder convention rules are currently restated in `CLAUDE.md` (§ "API Route & Folder Convention"), which duplicates `openspec/specs/*/spec.md`. This creates a drift risk — when a spec updates, `CLAUDE.md` may lag behind.

**Decision:** create `CONTRIBUTING.md` at the repository root as the canonical contributor-facing guide. It contains:
- Short convention summary (singular routes, `/list` suffix, GET+POST, folder dual-track)
- Links to `openspec/specs/{api-route-convention,folder-naming-convention,convention-enforcement}/spec.md` for full details
- Development workflow basics (branch from `dev`, run `check:convention`, etc.)

`CLAUDE.md` § "API Route & Folder Convention" is replaced with a 2-line pointer to `CONTRIBUTING.md` and the specs directory. No rule text remains duplicated.

**Why `CONTRIBUTING.md`:** GitHub surfaces it automatically when contributors open issues/PRs. It's the standard OSS file for coding conventions. The OpenSpec specs are too detailed for a quick-reference; `CONTRIBUTING.md` bridges the gap between "I just cloned this repo" and "I need the full spec".

**Why not `docs/conventions.md`:** a nested `docs/` file is invisible unless you know to look for it. `CONTRIBUTING.md` at the root is discoverable by convention.

## Migration Plan

1. **Branch:** `dev → migrate/convention` or equivalent.
2. **Contract sweep** (low risk, first): spread `listQueryBase` into every `*ListQuerySchema`; per-service `ids` handling. Verify `tsc` passes in `@rezics/contract`, `@rezics/server`.
3. **Server prefix renames** (15 domains): one-by-one, each accompanied by its root-handler `/list` move where applicable. Resolve `/unit` collision early. Verify route list via a quick `bun run server` boot — Elysia logs routes.
4. **Frontend caller updates**: run `grep -rE "(\"|')/[a-z-]+s(/|\"|')" package/{api,app,admin}/src` against the renamed set; update every match.
5. **Folder renames** (domain + container): batch by package (`package/app`, `package/admin`, `package/ui`, etc.). `git mv` + import rewrite per package. `tsc --noEmit` per package.
6. **Allowlist extensions** (if D4 opts in): edit `folder-naming-convention/spec.md` and `tool/scripts/check-convention.ts` in a single commit inside the PR.
7. **Snapshot deletion**: `rm tool/scripts/expected-violations.json`. Patch `check-convention.ts` to tolerate missing baseline.
8. **POST `/list` coverage** (D8): for each of the 11 domains, create `*ListBodySchema` in contract, add `.post("/list", ...)` handler in server, verify `tsc --noEmit` per package.
9. **CONTRIBUTING.md + CLAUDE.md slim-down** (D9): create `CONTRIBUTING.md` with convention summary + spec links. Replace `CLAUDE.md` convention section with a pointer.
10. **Verification**: `bun run check:convention` exits 0 with no file present. `bun run build` in every frontend package. `bun test` where applicable. Smoke test POST `/list` endpoints.
11. **PR description** includes: list of affected endpoints, deploy checklist (server and client staged together), post-deploy smoke-test targets.
12. **Rollback**: `git revert` the PR. Route renames are path-only; reverting restores the old paths without data loss. Folder renames revert cleanly via `git mv` history. No DB state is touched.

## Open Questions

- **Q1:** Do `adapters/` and `contracts/` join the container allowlist, or get renamed to `adapter/` / `contract/`? Tasks.md defaults to rename-singular; flip to allowlist if the JWT package's authors prefer the container reading. Decision can land in review.
- **Q2:** Should Change 2 also enforce the `ids` field propagation via a new script scan (e.g., R5 "list query schema missing `ids`")? Current plan: no — the spread is mechanical and one-shot; a scan adds long-term complexity for a one-time check. If propagation misses survive review, a future change can add the scan.
- **Q3:** Does the `/list` suffix apply to sub-resources like `GET /book/:id/chapter/list`? Change 1's spec says yes for collection access; verify with the reviewer when the first nested list endpoint comes up in code.
