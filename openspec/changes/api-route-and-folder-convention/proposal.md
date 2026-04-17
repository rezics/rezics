## Why

The `@rezics/server` API surface and repo folder structure have drifted into inconsistent patterns: route prefixes are a mix of plural and singular (`/books`, `/posts`, `/tags` vs `/user`, `/shelf`, `/score`), batch-style access is expressed in three incompatible shapes (CSV querystring, repeated query params, POST body), and subfolder naming flips between plural and singular without rule (`hooks/` vs `hook/`, `utils/` vs `util/`). A prior attempt at a `/list` route convention was abandoned because it was never enforced — new endpoints copied whatever was nearest, and the convention decayed.

This proposal establishes a single, enforceable naming convention for HTTP routes and repository folders, and introduces automated checks so the convention survives future growth. It does not migrate any existing code — migration is tracked as a separate follow-up change so the convention can be reviewed independently of the grunt work it will trigger.

## What Changes

- **API route convention** (new):
  - All resource prefixes SHALL be singular (`/book`, `/user`, `/post`, `/tag` …).
  - Collection and batch-by-id access SHALL use a `/list` suffix: `GET /{resource}/list?ids=a,b,c` for small or cacheable queries, `POST /{resource}/list` with a JSON body for large id sets or nested filters.
  - Every `listQuerySchema` in `@rezics/contract` SHALL accept an optional `ids: string[]` field with `maxItems: 200`, mirrored between `GET` querystring (CSV) and `POST` body.
  - Single-resource read: `GET /{resource}/:unitId`. Mutations remain standard REST verbs on the same singular prefix.
  - The `brief` capability (lightweight user cards for hover/mention/actor contexts) remains an independent feature but adopts the same naming shape: `GET /user/brief/:unitId` + `GET/POST /user/brief/list`.

- **Folder naming convention** (new, β dual-track):
  - Domain/feature folders SHALL be singular (`book`, `user`, `shelf`, `translation-group` …).
  - Container folders that hold collections of same-kind files SHALL be plural (`hooks/`, `utils/`, `components/`, `pages/`, `sections/`, `models/`, `types/`, `routes/`, `states/`).
  - The plural container allowlist is fixed; anything outside the allowlist is singular.
  - This supersedes the conflicting example in `package/app/docs/feature standard.md` (which currently shows `hooks/` plural alongside `util/` singular).

- **Automated enforcement** (new):
  - A Node script at `package/scripts/check-convention.ts` SHALL scan Elysia `prefix:` declarations and reject plural resource prefixes, flag list-returning routes missing the `/list` suffix, and reject folder names that violate the domain-singular / container-plural rules.
  - The check SHALL run as a pre-commit hook and as a CI step.

- **CLAUDE.md update**: a new "API Route & Folder Convention" section is added summarizing the rules and linking to the spec.

- **BREAKING (convention-only, no code changes this change)**: this proposal locks the convention in. A subsequent migration change will rename 13 plural route prefixes, collapse three batch-access shapes into one, and normalize subfolder names. No runtime behaviour changes in this change.

- **Non-goals**: this change does NOT migrate any existing routes, folders, or frontend callers; does NOT touch `@rezics/auth` (governed by better-auth); does NOT change DB schemas; does NOT alter pagination, sorting, or cursor contracts beyond adding the optional `ids` field to the base list-query schema.

## Capabilities

### New Capabilities

- `api-route-convention`: Canonical HTTP route shape for `@rezics/server` — singular resource prefixes, `/list` suffix for collection/batch access, shared `ids` field on every list query, GET/POST mirror for the same schema, naming rules for single-resource and sub-resource paths. Governs all new and migrated routes.
- `folder-naming-convention`: β dual-track folder naming across all packages in the monorepo — singular domain folders, plural container folders drawn from a fixed allowlist. Applies to `package/**/src/**` excluding generated code (`prisma/generated/**`).
- `convention-enforcement`: Automated checking script, pre-commit hook integration, and CI step that block route prefixes, list-suffix usage, and folder names violating the two conventions above.

### Modified Capabilities

_None._ `pagination-limit-contract` and `public-list-endpoints` remain untouched — the new `ids` field is additive and composes with existing filters.

## Impact

- **Affected code this change touches**:
  - `openspec/specs/api-route-convention/spec.md` (new)
  - `openspec/specs/folder-naming-convention/spec.md` (new)
  - `openspec/specs/convention-enforcement/spec.md` (new)
  - `CLAUDE.md` (new section)
  - `package/app/docs/feature standard.md` (correct the `hooks/` vs `util/` inconsistency, align with new convention)
  - `package/scripts/check-convention.ts` (new)
  - `.lefthook.yml` or equivalent pre-commit config (wire the script)
  - CI workflow file (wire the script)

- **Affected code the follow-up migration change will touch** (out of scope here, listed for visibility):
  - Server: 13 plural route prefixes, `/unit` prefix collision between `translation-group` and `unit` domains, all list endpoints gaining the `ids` field.
  - Contract: every `*ListQuerySchema` gains `ids` via a shared `listQueryBase` mixin.
  - API client: every `apiFetch` call hitting a migrated prefix.
  - App / Admin: no source folder renames expected beyond `hook/` → `hooks/` alignment in `app/book-edit`, `util/` → `utils/` in several app features, and similar subfolder normalization.

- **Backward compatibility**: this change is docs + tooling only, so nothing breaks at runtime. The follow-up migration will require a coordinated server+client deploy (no HTTP route aliasing is planned — the cost of dual-maintenance outweighs the short migration window).

- **Affected packages**: `@rezics/server`, `@rezics/contract`, `@rezics/api`, `@rezics/app`, `@rezics/admin`, `@rezics/ui` (folder convention), plus the new `package/scripts/` for tooling. `@rezics/auth` is explicitly out of scope.
