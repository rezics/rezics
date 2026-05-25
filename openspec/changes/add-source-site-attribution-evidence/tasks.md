## 1. Contract Schemas

- [ ] 1.1 Add `package/contract/src/source-site.ts` with SourceSite crawl support/status, ref-rule, create/update, DTO, and list response schemas.
- [ ] 1.2 Add `package/contract/src/unit-external-ref.ts` with UnitExternalRef create/update, DTO, and list query schemas.
- [ ] 1.3 Add credit attribution evidence schemas to `package/contract/src/credit-attribution.ts` or a dedicated exported module, keeping evidence fields optional on existing credit DTOs.
- [ ] 1.4 Export all new contract modules from `package/contract/src/index.ts`.
- [ ] 1.5 Add contract tests for valid/invalid SourceSite ref rules, crawl gate inputs, UnitExternalRef identity payloads, and credit evidence DTO shape.

## 2. Database Model

- [ ] 2.1 Add Prisma models `SourceSite`, `UnitExternalRef`, and `CreditAttributionEvidence` to `package/server/prisma/schema.prisma`.
- [ ] 2.2 Add indexes and constraints for unique SourceSite key, unique source-issued UnitExternalRef identity, and strict CreditAttributionEvidence foreign keys.
- [ ] 2.3 Generate a Prisma migration for the three new tables.
- [ ] 2.4 Run Prisma generation for `@rezics/server`.

## 3. Server Domain APIs

- [ ] 3.1 Add `package/server/src/source-site/` service, mapper, types, API, and index modules for admin SourceSite CRUD/list/detail.
- [ ] 3.2 Add `package/server/src/unit-external-ref/` service, mapper, types, API, and index modules for UnitExternalRef create/list/update/delete.
- [ ] 3.3 Extend credit attribution service/mapper reads to include optional evidence summaries and linked source site Entity identity.
- [ ] 3.4 Add server validation that SourceSite writes bind to an existing Entity Unit and never accept duplicated display fields.
- [ ] 3.5 Add server validation that UnitExternalRef writes match the SourceSite ref rules for external kind, id, and URL shape.
- [ ] 3.6 Add server validation that CreditAttributionEvidence writes reference an existing CreditAttribution and UnitExternalRef.
- [ ] 3.7 Mount new server APIs from `package/server/src/index.ts` following existing domain API conventions.
- [ ] 3.8 Add targeted server tests for SourceSite CRUD, crawl gate derivation, UnitExternalRef uniqueness, evidence FK enforcement, and credit read DTO evidence hydration.

## 4. API Client

- [ ] 4.1 Add `package/api/src/source-site/` client, keys, query options, mutations, and exported hooks.
- [ ] 4.2 Add `package/api/src/unit-external-ref/` client, keys, query options, mutations, and exported hooks.
- [ ] 4.3 Update `package/api/src/credit-attribution/` types or query handling if needed for optional evidence fields.
- [ ] 4.4 Export new API modules from package-level API entry points.
- [ ] 4.5 Add API client tests for request paths, mutation invalidation, and evidence-bearing credit DTO parsing.

## 5. Admin UI

- [ ] 5.1 Add admin routes/navigation for SourceSite list/detail/create/edit under the existing admin domain structure.
- [ ] 5.2 Build SourceSite forms that select or create an Entity Unit and edit only SourceSite configuration fields.
- [ ] 5.3 Build ref-rule editing UI with contract-backed validation errors and no duplicated display fields.
- [ ] 5.4 Add admin controls for `crawlSupport`, `crawlEnabled`, and `crawlerAdapterKey`, with derived scheduling eligibility shown as technical metadata.
- [ ] 5.5 Add admin tests or stories for SourceSite list, edit, validation error, and disabled crawl states.

## 6. App Attribution UI

- [ ] 6.1 Identify book/detail credit attribution render surfaces that should expose source-backed previews.
- [ ] 6.2 Add a source evidence preview component using existing shadcn primitives and `SafeLink` for outbound source URLs.
- [ ] 6.3 Preserve direct Entity navigation for credit attributions with no evidence.
- [ ] 6.4 Add hover, focus, tap, and keyboard-accessible interactions for evidence-backed credits.
- [ ] 6.5 Add focused component tests or stories for no-evidence navigation and evidence preview behavior.

## 7. Seeds and Fixtures

- [ ] 7.1 Add a seed/factory fixture for a Qidian SourceSite Entity plus SourceSite extension.
- [ ] 7.2 Add fixture data for a Book UnitExternalRef and publisher CreditAttributionEvidence.
- [ ] 7.3 Ensure fixtures do not store Qidian display identity in SourceSite fields.

## 8. Verification

- [ ] 8.1 Run targeted contract tests for new schemas.
- [ ] 8.2 Run targeted server tests for SourceSite, UnitExternalRef, and credit attribution evidence.
- [ ] 8.3 Run targeted API client tests for new clients and evidence-bearing credit reads.
- [ ] 8.4 Run targeted admin/app UI tests or Storybook checks for changed surfaces.
- [ ] 8.5 Run `bun run check:convention` and relevant package type checks.
