## 1. Contract Schemas

- [x] 1.1 Add `package/contract/src/source-site.ts` with SourceSite crawl support/status, ref-rule, create/update, DTO, and list response schemas.
- [x] 1.2 Add `package/contract/src/unit-external-ref.ts` with UnitExternalRef create/update, DTO, and list query schemas, using the `externalKind` closed-union schema.
- [x] 1.3 Add credit attribution evidence schemas to `package/contract/src/credit-attribution.ts` or a dedicated exported module, keeping evidence fields optional on existing credit DTOs.
- [x] 1.4 Export all new contract modules from `package/contract/src/index.ts`.
- [x] 1.5 Add contract tests for valid/invalid SourceSite ref rules, crawl gate inputs, UnitExternalRef identity payloads, and credit evidence DTO shape.
- [x] 1.6 Add an `externalKind` registry (closed union, labels, advisory `suggestExternalKinds(unitKind, availableKinds)` helper) and pure URL helpers (`buildCanonicalUrl(template, externalId)`, `parseSourceUrl(url, refRules)`) in `@rezics/contract`, with tests covering forward derivation and reverse parse.

## 2. Database Model

- [x] 2.1 Add Prisma models `SourceSite`, `UnitExternalRef`, and `CreditAttributionEvidence` to `package/server/prisma/schema.prisma`.
- [x] 2.2 Add indexes and constraints for unique SourceSite key, unique source-issued UnitExternalRef identity, and strict CreditAttributionEvidence foreign keys.
- [x] 2.3 Generate a Prisma migration for the three new tables.
- [x] 2.4 Run Prisma generation for `@rezics/server`.

## 3. Server Domain APIs

- [x] 3.1 Add `package/server/src/source-site/` service, mapper, types, API, and index modules for admin SourceSite CRUD/list/detail.
- [x] 3.2 Add `package/server/src/unit-external-ref/` service, mapper, types, API, and index modules for UnitExternalRef create/list/update/delete.
- [x] 3.3 Extend credit attribution service/mapper reads to include optional evidence summaries and linked source site Entity identity.
- [x] 3.4 Add server validation that SourceSite writes bind to an existing Entity Unit and never accept duplicated display fields.
- [x] 3.5 Add server validation that UnitExternalRef writes validate `externalKind` in two layers (contract union + presence in the SourceSite ref rules), derive and cache `canonicalUrl` from the matching rule at write time, and keep `externalKind`/`externalId` authoritative.
- [x] 3.6 Add server validation that CreditAttributionEvidence writes reference an existing CreditAttribution and UnitExternalRef.
- [x] 3.7 Mount new server APIs from `package/server/src/index.ts` following existing domain API conventions.
- [x] 3.8 Add targeted server tests for SourceSite CRUD, crawl gate derivation, UnitExternalRef uniqueness, evidence FK enforcement, and credit read DTO evidence hydration.
- [x] 3.9 Add reverse URL parsing (paste URL -> `externalKind` + `externalId` via ref-rule patterns) in the unit-external-ref service, plus a test asserting an `externalKind`/`Unit.kind` mismatch is accepted (soft-compatibility lock).

## 4. API Client

- [x] 4.1 Add `package/api/src/source-site/` client, keys, query options, mutations, and exported hooks.
- [x] 4.2 Add `package/api/src/unit-external-ref/` client, keys, query options, mutations, and exported hooks.
- [x] 4.3 Update `package/api/src/credit-attribution/` types or query handling if needed for optional evidence fields.
- [x] 4.4 Export new API modules from package-level API entry points.
- [x] 4.5 Add API client tests for request paths, mutation invalidation, and evidence-bearing credit DTO parsing.

## 5. Admin UI

- [x] 5.1 Add admin routes/navigation for SourceSite list/detail/create/edit under the existing admin domain structure.
- [x] 5.2 Build SourceSite forms that select or create an Entity Unit and edit only SourceSite configuration fields.
- [x] 5.3 Build ref-rule editing UI with contract-backed validation errors and no duplicated display fields.
- [x] 5.4 Add admin controls for `crawlSupport`, `crawlEnabled`, and `crawlerAdapterKey`, with derived scheduling eligibility shown as technical metadata.
- [x] 5.5 Add admin tests or stories for SourceSite list, edit, validation error, and disabled crawl states.
- [x] 5.6 Add a UnitExternalRef authoring control that accepts a pasted source URL and reverse-parses kind/id, falling back to explicit `externalKind` selection ordered by `suggestExternalKinds`; never filter or disable declared kinds.

## 6. App Attribution UI

- [x] 6.1 Identify book/detail credit attribution render surfaces that should expose source-backed previews.
- [x] 6.2 Add a source evidence preview component using existing shadcn primitives and `SafeLink` for outbound source URLs.
- [x] 6.3 Preserve direct Entity navigation for credit attributions with no evidence.
- [x] 6.4 Add hover, focus, tap, and keyboard-accessible interactions for evidence-backed credits.
- [x] 6.5 Add focused component tests or stories for no-evidence navigation and evidence preview behavior.

## 7. Seeds and Fixtures

- [x] 7.1 Add a seed/factory fixture for a Qidian SourceSite Entity plus SourceSite extension.
- [x] 7.2 Add fixture data for a Book UnitExternalRef and publisher CreditAttributionEvidence.
- [x] 7.3 Ensure fixtures do not store Qidian display identity in SourceSite fields.

## 8. Verification

- [x] 8.1 Run targeted contract tests for new schemas.
- [x] 8.2 Run targeted server tests for SourceSite, UnitExternalRef, and credit attribution evidence.
- [x] 8.3 Run targeted API client tests for new clients and evidence-bearing credit reads.
- [x] 8.4 Run targeted admin/app UI tests or Storybook checks for changed surfaces.
- [x] 8.5 Run `bun run check:convention` and relevant package type checks.
