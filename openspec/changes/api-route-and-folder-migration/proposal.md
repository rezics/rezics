## Why

Change `api-route-and-folder-convention` (archived 2026-04-17) locked in the singular-resource / `/list`-suffix route convention, the β dual-track folder rule, and the `bun run check:convention` enforcement script — but deliberately migrated no existing code. The script is currently gated on a 151-entry baseline snapshot (`tool/scripts/expected-violations.json`) that blocks **new** violations while tolerating the existing ones. That snapshot is scaffolding, not a long-term artefact: every day it stays in place, contributors read the repo's inconsistent state as normative. This change drives the baseline to zero in a single coordinated pass and removes the snapshot so the spec is the only source of truth.

One-shot migration is the right shape because HTTP route renames (15 prefixes) cannot be rolled out piecemeal without dual-maintaining aliases, which Change 1's design explicitly rejected as more expensive than a coordinated server+client deploy. The folder renames (112 directories) and the `listQueryBase` spread (every `*ListQuerySchema`) are mechanical and benefit from happening in the same PR so that the post-condition — "baseline is empty, snapshot file deleted" — becomes a single reviewable atomic step.

## What Changes

- **Server route renames** (BREAKING, coordinated deploy):
  - 15 plural Elysia `prefix:` values → singular: `/books` → `/book`, `/chapters` → `/chapter`, `/feedbacks` → `/feedback`, `/links` → `/link`, `/notifications` → `/notification`, `/posts` → `/post`, `/reactions` → `/reaction` (both `@rezics/reaction` and `server/src/reaction`), `/realms` → `/realm`, `/shelves` → `/shelf`, `/tags` → `/tag`, `/units` → `/unit`, `/users` → `/user` (both in `server/src/user` and `server/src/notify/user-batch.api.ts`), `/zones` → `/zone`.
  - 12 root list handlers (`.get("/", …)` / `.post("/", …)` returning `items`) gain the `/list` suffix, or are annotated `// @convention:root-list-ok` for narrow pronoun-root exceptions (e.g., `/users/me` style).
  - `/unit` prefix collision: the `translation-group` domain currently mounts at `/unit` — it moves to `/translation-group` (the folder is already `translation-group/`, so only the Elysia prefix changes) so the migrated `/unit` prefix (from `/units`) can own the path cleanly.

- **Contract schema normalization**:
  - Every `*ListQuerySchema` in `@rezics/contract` spreads `...listQueryBase.properties` so it carries the shared `ids: t.Optional(t.Array(t.String(), { maxItems: 200 }))` field. Candidates include `bookListQuerySchema`, `postListQuerySchema`, `realmListQuerySchema`, `shelfListQuerySchema`, `chapterListQuerySchema`, `tagListQuerySchema`, `feedbackListQuerySchema`, `userFilterSchema`, `zoneListQuerySchema`, `notificationListQuerySchema`, `linkListQuerySchema`, `reactionListQuerySchema`, and any others discovered by grep.
  - No behaviour change for callers that omit `ids`; no contract break for callers that already pass filters.

- **Folder renames** (R3 + R4 violations):
  - 112 singular container folders → plural: `component/` → `components/`, `page/` → `pages/`, `section/` → `sections/`, `state/` → `states/`, `model/` → `models/`, `util/` → `utils/`, `hook/` → `hooks/`, `layout/` → `layouts/`, `provider/` → `providers/`, `plugin/` → `plugins/`, `style/` → `styles/`, `mock/` → `mocks/`, `asset/` → `assets/`, `doc/` → `docs/`, `template/` → `templates/`. Applied across `package/admin/**`, `package/app/**`, `package/api/**`, `package/folio/**`, `package/preview/**`, `package/server/**`, `package/ui/**`.
  - 12 non-allowlisted plural folders resolved case-by-case: `charts/`, `realms/`, `shelves/`, `units/`, `users/`, `stats/`, `preferences/`, `settings/`, `adapters/`, `contracts/` — each is either renamed to singular (`chart/`, `adapter/`, `contract/` etc.) when it is a domain folder, or converted via narrow spec amendment when it denotes a legitimate container family not yet allowlisted. Each decision is documented in `tasks.md`.

- **Frontend caller updates**:
  - Every `apiFetch(...)` / `createApiQuery(...)` / `useQuery` invocation in `@rezics/api`, `@rezics/app`, `@rezics/admin` hitting a renamed server prefix has its URL updated to match.
  - TanStack Query keys derived from route paths are adjusted in lockstep so cache hydration still works.
  - Any feature importing from a renamed folder updates its `import` paths (bulk `sed`-able; no logic changes).

- **Enforcement tooling decommission** (partial):
  - `tool/scripts/expected-violations.json` is deleted — the baseline is empty, and the script no longer needs a snapshot file to compare against.
  - `tool/scripts/check-convention.ts` is simplified (baseline-loading code removed; script now exits non-zero on ANY violation — zero-tolerance). The script, the `bun run check:convention` package.json entry, the `lefthook.yml` pre-commit job, and the CI step all remain in place as ongoing guards.
  - The `convention-enforcement` spec is unchanged: its scenarios already describe zero-tolerance behaviour ("script prints summary ... exits with status 0" requires "no violations"); the baseline snapshot was scaffolding below the spec level.

- **Documentation**:
  - `CLAUDE.md` "API Route & Folder Convention" section is unchanged — it already describes the post-migration steady state. A single sentence is added noting that the baseline snapshot is gone.
  - `package/app/docs/feature standard.md` already points at the spec; no further edits needed.

- **BREAKING** (HTTP surface):
  - All 15 plural prefixes stop responding in the same deploy that rolls out the migration. No alias layer. Any external caller not updated to the new prefix receives 404s. Callers inside this monorepo are updated in the same PR.

- **Non-goals**:
  - Does NOT modify `@rezics/auth` (better-auth governed).
  - Does NOT touch Prisma schemas or DB migrations.
  - Does NOT introduce new capabilities. Does NOT amend `api-route-convention/spec.md` or `folder-naming-convention/spec.md` (their requirements are already correct).
  - Does NOT change pagination, sorting, or cursor semantics beyond the `ids` field already introduced in Change 1.
  - Does NOT dismantle the enforcement script itself — only the baseline snapshot. The pre-commit hook and CI step remain long-term guards.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `convention-enforcement`: one requirement's implementation expectations shift — the check script runs without a baseline snapshot post-migration, enforcing zero violations. The requirement text in the spec already implies this; a clarifying scenario is added that locks it in explicitly so future contributors don't re-introduce a tolerate-existing pattern.

## Impact

- **Affected code**:
  - Server prefixes: `package/server/src/{book,chapter,feedback,link,post,reaction,realm,shelf,tag,unit,user,zone}/*.api.ts`, `package/server/src/notify/user-batch.api.ts`, `package/server/src/translation-group/*.api.ts`, `package/notify/src/notification/notification.api.ts`, `package/reaction/src/reaction/reaction.api.ts`.
  - Root list handlers: 12 `.get("/", …)` / `.post("/", …)` sites inside the above domain `.api.ts` files.
  - Contract: every `*ListQuerySchema` file under `package/contract/src/**`.
  - API client: `package/api/src/**` — every `apiFetch` path and query-key factory touching a renamed prefix.
  - App / Admin: `package/app/src/**`, `package/admin/src/**` — import-path updates from renamed folders and URL updates from renamed routes.
  - Folder renames (R3 + R4): see `tool/scripts/expected-violations.json` (pre-deletion) for the canonical 124-entry list.
  - Tooling: `tool/scripts/check-convention.ts`, `tool/scripts/expected-violations.json` (deleted), root `package.json` (no changes to the `check:convention` entry).

- **Affected packages**: `@rezics/server`, `@rezics/notify`, `@rezics/reaction`, `@rezics/contract`, `@rezics/api`, `@rezics/app`, `@rezics/admin`, `@rezics/ui`, `@rezics/folio`, `@rezics/preview`. `@rezics/auth` is explicitly out of scope.

- **Backward compatibility**: HTTP routes rename without aliases — external callers break on the deploy. All in-repo callers are updated in the same PR. Database and auth surfaces are untouched. Frontend cache keys change with route paths, triggering expected cold re-fetches on first load after deploy; no user-visible regression.

- **Coordination**: server and client deploy together. The PR is atomic; there is no partial-rollout mode. Release notes and any external-facing docs get a one-line call-out.

- **Post-migration verification**:
  1. `bun run check:convention` exits 0 with no baseline file present.
  2. `openspec validate api-route-and-folder-migration --strict` passes.
  3. Spot-check: `grep -r "/books\|/users\|/posts" package/{api,app,admin}/src` returns no HTTP path matches (import paths and prose are fine).
  4. Manual smoke test: hit the five highest-traffic renamed endpoints (`/book/list`, `/post/list`, `/user/brief/list`, `/tag/list`, `/realm/list`) against a running `@rezics/server` and confirm 200 responses.
