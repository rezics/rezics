---
title: JSON Evolution Policy — Envelopes, Additive Compatibility, and Backfill Mechanics
status: active
created: 2026-06-10
completed:
supersededBy:
tags: [contract, schema, versioning, migration, convention, tool]
---

## Why

The repository has 35+ persisted JSON columns. Today only two families are
versioned envelopes (`rezics/zone-config` and `rezics.content`), while most
remaining JSON columns have no contract schema at all. Once production data can
no longer be reseeded, stored JSON will need a policy for additive changes,
breaking changes, validation, and backfills before the first incompatible shape
change happens.

This proposal turns the strategy from
`plan/exploration/json-evolution-and-zone-split.md` into executable code:
shared envelope infrastructure, a JSON column classification registry,
convention checks, a backfill command skeleton, and concise policy comments.
The project is still in development, so existing JSON shapes can be cut over
cleanly and reseeded.

## Durable constraints & decisions

- Persisted JSON columns are classified into three categories:
  **enveloped JSON** (configuration/documents, self-describing
  `{ schema, version, ...body }` objects plus an upgrade chain),
  **additive-compatible JSON** (extra/settings/metadata-style JSON with no
  envelope and `@compat additive-only` discipline), and **exempt JSON**
  (external standard formats such as JWK and OAuth client metadata, plus
  intentionally untyped generic KV). The classification axes are backend
  consumption and expected evolution, not table size. (comment -> envelope
  module JSDoc; type -> JSON column registry)
- Add `package/contract/src/envelope/envelope.ts` as the shared home for
  self-describing versioned envelopes. Use "envelope metadata" for `schema` and
  `version`, and "envelope body" for the remaining persisted payload. Avoid
  "header" for envelope metadata because zone already has a business-level
  `header` object. (comment)
- The only strategy for enveloped JSON is: permanent upgrade chain, normalize
  on read, write the latest version only, and run a backfill before retiring an
  old version. Release timeline: ship vN+1 schema plus upgrade chain -> mixed
  version window -> backfill -> verify old rows are gone -> remove vN in a
  later release. (comment)
- Upgrade functions must be pure transformations: no database reads, no IO, and
  no environment access. The same pure function must serve read normalization,
  the backfill transform, and client-side transforms where applicable. If a
  change cannot be expressed as a pure transform, split it into additive steps.
  (comment + test: upgrade signatures accept no context argument)
- Use trust-on-read for enveloped JSON: write paths strictly validate the latest
  version (`additionalProperties: false`); read paths dispatch by `version` and
  do not run full `Value.Check` on every read. Full read validation is enabled
  only in development. (comment + test)
- Forbid read-path writeback and in-database JSON mutation (`jsonb_set`, etc.).
  All writes go through parse -> upgrade -> mutate -> validate -> persist.
  (comment + convention rule)
- Version is visible only at the parse boundary. After `parseXxx`, business code
  sees only the latest type and must not branch on stored JSON versions.
  (comment)
- Content docs are enveloped JSON, but backend read paths mostly store them
  opaquely and derive projections on write. Their upgrade chain can run on the
  client; backfill and version retirement should also shrink client bundle
  weight. (comment -> `content/doc-v1.ts`)
- If additive-compatible JSON eventually needs a breaking redesign, use
  absence-as-v1: "no `version` field means v1", and introduce an envelope from
  v2 onward. This keeps zero upfront cost for simple JSON columns. (comment)
- Expensive data moves do not belong in ordinary Drizzle migrations. Schema
  migrations remain the source of truth and still run; long-running, retryable,
  observable data backfills and stream tasks move to maintenance commands.
  Small bounded DML may stay in a migration. (comment -> backfill command entry)
- Development-stage behavior is unchanged: validation failure means factory
  reseed; upgrade chains are idle until data can no longer be reseeded. (comment)
- IMAGE unit semantics: IMAGE units represent cataloged image works, such as
  Pixiv-like artworks with attribution, tags, and discussion. Ordinary or
  decorative images are plain URL strings. (comment -> DB schema and contract
  UnitType)

## Tasks

## 1. Envelope Infrastructure (`@rezics/contract`)

- [ ] 1.1 Create `package/contract/src/envelope/envelope.ts` with shared
      envelope types and helpers: literal `schema`/`version` metadata, upgrade
      chain signatures, a parse factory that dispatches by version, and a
      dev-only full validation switch. The module JSDoc must define the three
      JSON classes, release timeline, pure-transform constraint, and
      absence-as-v1 fallback.
- [ ] 1.2 Re-express `package/contract/src/zone/upgrade.ts` through the shared
      envelope helper without behavior changes: dispatch by version on read and
      keep full validation dev-only. Add a comment in `content/doc-v1.ts`
      pointing at the envelope module and naming its client-transform role.
- [ ] 1.3 Add tests for upgrade-chain purity and trust-on-read behavior:
      historical versions dispatch correctly, unknown versions are rejected, and
      dev-mode full validation is active.

## 2. JSON Column Registry and Convention Checks (`tool`)

- [ ] 2.1 Add an explicit JSON column classification registry used by
      `check:convention`. Each entry maps a persisted JSON column
      (`database`, `table`, `column`) to one of:
      `enveloped`, `compat`, or `exempt`, plus the owning contract schema or an
      exemption reason. Do not infer this mapping from column names.
- [ ] 2.2 Add a convention rule that scans server and auth DB schemas for JSON
      columns and requires every column to appear in the registry. For
      `enveloped` entries, the referenced contract schema must be a union of
      self-describing objects with literal `schema` and `version` fields. For
      `compat` entries, the schema JSDoc must include `@compat additive-only`.
      For `exempt` entries, the registry must include a reason.
- [ ] 2.3 Add the compatible JSON checks that are mechanically reliable:
      `@compat additive-only` read schemas must not use
      `additionalProperties: false`, and closed discriminated unions must have
      an unknown-kind fallback branch.
- [ ] 2.4 Add a grep-level convention check that forbids in-database JSON
      mutation helpers such as `jsonb_set` in server source.
- [ ] 2.5 Transition: existing unclassified columns may be listed in a
      temporary TODO bucket that points to
      `plan/proposal/compat-schema-audit.md`; new JSON columns must be
      classified immediately.

## 3. Backfill Command Skeleton (`tool`)

- [ ] 3.1 Add `tool/src/commands/backfill/` with a resumable CLI skeleton:
      envelope schema name, target version, stable cursor batching, per-batch
      commits, progress recording, throttling parameters, interruption-safe
      reruns, and reuse of the contract upgrade chain as the transform body.
      The entry JSDoc owns the migration/backfill/stream-task split.
- [ ] 3.2 Expose `task backfill` from the root `Taskfile.yml`; include a
      verification subcommand that reports stored row counts by version.

## 4. Policy Comment Landing Points

- [ ] 4.1 Update `package/server/src/db/schema/columns.ts` `jsonData()` JSDoc
      with a short pointer to the envelope module, JSON column registry, and
      convention rule.
- [ ] 4.2 Update `package/server/src/db/schema/unit.ts` UnitType comments and
      `package/contract/src/unit/unit.ts` with bilingual JSDoc for IMAGE unit
      semantics versus ordinary image URLs.

## Out of scope

- Finalizing additive-compatible JSON discipline and filling schema gaps for
  non-envelope JSON columns (`compat-schema-audit.md`).
- Splitting zone shell/page storage and refactoring zone envelopes
  (`zone-shell-page-split.md`).
- Real v2 upgrade functions; there is no breaking persisted change yet.
- Read-path caches and TypeCompiler precompilation. Trust-on-read removes the
  primary steady-state cost.
