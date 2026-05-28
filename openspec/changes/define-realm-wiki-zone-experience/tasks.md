## 1. Contract And Shared Types

- [x] 1.1 Add `UnitType.LABEL` to `@rezics/contract` Unit type schemas and exported type unions.
- [x] 1.2 Add contract tests proving LABEL is accepted as a Unit type and rejected where a domain-specific type is required.
- [x] 1.3 Add work realm context role schemas for `official`, `community`, `language`, and `archive`.
- [x] 1.4 Add WorkRealmContext DTO, create/update request schemas, list response schemas, and conflict/error DTOs.
- [x] 1.5 Add wiki Zone filter schemas covering realm id, post kind WIKI, tags, entity subject filters, languages, and translation group references.
- [x] 1.6 Add wiki Zone navigation schemas for entity, tag, translation group, Unit link, external link, LABEL-backed heading, and manual translated label items.
- [x] 1.7 Add wiki Zone homepage schemas for `entityCollection`, `tagCollection`, `translationGroupCollection`, `recentWiki`, `updatedWiki`, `stubWiki`, and `manualLinks`.
- [x] 1.8 Add wiki Zone theme schemas for palette, media, chrome, wiki layout, built-in template slugs, and homepage template slugs.
- [x] 1.9 Add schema tests rejecting arbitrary CSS, raw single-language manual labels, unknown wiki config fields, and unsupported template slugs where strict validation applies.
- [x] 1.10 Export all new contract schemas from `package/contract/src/index.ts` and verify public imports compile.

## 2. Database And Prisma Model

- [x] 2.1 Add LABEL to the Prisma Unit type enum or equivalent persisted Unit type definition.
- [x] 2.2 Add a work realm context model/table keyed by work Unit and realm Unit with role, priority, optional locale, optional release override, and audit timestamps.
- [x] 2.3 Add database constraints or service-level validation ensuring `workUnitId` resolves to a hidden work-capable Unit and `realmUnitId` resolves to a REALM Unit.
- [x] 2.4 Add uniqueness constraints for deterministic work realm context rows, including role/locale/release override dimensions.
- [x] 2.5 Extend Zone persistence to store typed wiki config without breaking existing Zone rows.
- [x] 2.6 Generate Prisma client for server package and verify existing model imports compile.
- [x] 2.7 Add migration notes or seed-safe defaults so existing Zones and realms do not require immediate wiki config.

## 3. Server Services

- [x] 3.1 Implement a LABEL-aware Unit creation/update path that allows UnitTranslation but no extension table.
- [x] 3.2 Ensure LABEL Units are excluded from ordinary catalog/content queries unless explicitly requested by label management or picker code.
- [x] 3.3 Implement WorkRealmContext service create, update, delete, get, and list operations.
- [x] 3.4 Implement validation that ordinary users cannot create official work realm context rows.
- [x] 3.5 Implement deterministic work realm context resolution by release Unit through UnitWork.
- [x] 3.6 Implement conflict detection for equal-priority official work realm contexts.
- [x] 3.7 Extend Zone service validation to parse and persist wiki filters, navigation, homepage, and theme config.
- [x] 3.8 Add validation that wiki Zone config references valid realm, Entity, Tag, TranslationGroup, Unit, and LABEL ids where applicable.
- [x] 3.9 Add validation that wiki Zone manual labels include explicit translations when no LABEL/Entity/Tag/Unit reference supplies display text.
- [x] 3.10 Add helper service for best-language WIKI Post selection from TranslationGroup ids.
- [x] 3.11 Add helper queries for wiki Zone section hydration: entity collections, tag collections, translation group collections, recent wiki, updated wiki, and stub wiki.
- [x] 3.12 Ensure wiki section queries respect Unit visibility, realm membership, realm moderation lifecycle, and viewer permissions.

## 4. Server APIs

- [x] 4.1 Add WorkRealmContext Elysia routes with request/response schemas from `@rezics/contract`.
- [x] 4.2 Add read route for resolving a release Unit's wiki realm context through UnitWork.
- [x] 4.3 Extend Zone create/update/read routes to include wiki config fields.
- [x] 4.4 Add or extend realm detail API output to expose configured wiki Zone id and viewer capability metadata.
- [x] 4.5 Add wiki Zone homepage data endpoint or extend Zone resolution to include enough typed section hydration data.
- [x] 4.6 Add tests for forbidden work realm context writes, invalid realm targets, invalid label references, and malformed wiki config.
- [x] 4.7 Add tests proving repost/reference behavior does not create UnitRealm membership for the original wiki Unit.

## 5. API Client And Query Keys

- [x] 5.1 Add typed API client methods for WorkRealmContext CRUD/list/resolve operations.
- [x] 5.2 Add TanStack Query keys and hooks for work realm context resolution from release pages.
- [x] 5.3 Extend Zone API client methods and hooks to include wiki config and wiki homepage data.
- [x] 5.4 Add realm wiki list query helpers scoped by realm Unit id and PostKind.WIKI.
- [x] 5.5 Add mutation invalidation for Zone wiki config updates, realm detail wiki Zone updates, and work realm context updates.

## 6. Search And Indexing

- [x] 6.1 Ensure content search/index documents can filter WIKI Post Units by realm membership through UnitRealm.
- [x] 6.2 Ensure content search/index documents expose or can join translation group identifiers needed by wiki Zone sections.
- [x] 6.3 Add entity subject filters needed for wiki Zone entity collection sections.
- [x] 6.4 Add tag and realm tag filters needed for tag collection sections.
- [x] 6.5 Add bounded repair jobs or sync hooks when work realm context, UnitRealm membership, wiki tags, subject attribution, or translation groups change.
- [x] 6.6 Add search tests for realm-scoped wiki listing, translation group filtering, and permission-safe hidden/private wiki exclusion.

## 7. Frontend Realm Surfaces

- [x] 7.1 Add a Wiki tab to the realm detail tab model when wiki functionality is enabled.
- [x] 7.2 Implement the realm Wiki tab as a uniform app-themed list/search surface for WIKI Post Units sent to the realm.
- [x] 7.3 Add top-of-tab localized action linking to the configured wiki Zone when present.
- [x] 7.4 Add moderator/owner setup state when the realm has no configured wiki Zone and the viewer can manage it.
- [x] 7.5 Ensure the realm Wiki tab does not apply Zone theme tokens.
- [x] 7.6 Add empty, loading, error, and permission states for the realm Wiki tab.

## 8. Frontend Zone Templates

- [x] 8.1 Add wiki Zone template components for `wiki-classic`, `wiki-media`, `wiki-database`, and `wiki-minimal`.
- [x] 8.2 Add homepage templates for `wiki-classic-home`, `wiki-media-home`, `wiki-database-home`, and `wiki-minimal-home`.
- [x] 8.3 Implement safe fallback behavior for unknown or missing wiki templates.
- [x] 8.4 Implement token application scoped to the Zone page boundary.
- [x] 8.5 Implement banner/logo/background media fallbacks for missing or invalid media.
- [x] 8.6 Implement accessible navigation controls for desktop and mobile.
- [x] 8.7 Verify Zone templates import feature sections through public feature exports rather than private paths.

## 9. Frontend Wiki Navigation And Homepage Sections

- [x] 9.1 Implement navigation rendering for Entity, Tag, TranslationGroup, Unit link, external link, LABEL heading, and manual translated label items.
- [x] 9.2 Implement i18n resolution for Entity, Tag, LABEL Unit, Unit, and manual translation map labels.
- [x] 9.3 Implement best-language link resolution for TranslationGroup navigation items.
- [x] 9.4 Implement `entityCollection` homepage section with entity kind, subject role, work context, realm context, sort, and limit options.
- [x] 9.5 Implement `tagCollection` homepage section using Tag Unit translations and realm tag visibility.
- [x] 9.6 Implement `translationGroupCollection` homepage section using best-language WIKI Post selection.
- [x] 9.7 Implement `recentWiki`, `updatedWiki`, and `stubWiki` homepage sections.
- [x] 9.8 Implement `manualLinks` homepage section with validated translated labels.
- [x] 9.9 Add section-level empty-state policies so one empty section does not break the homepage.
- [ ] 9.10 Add responsive layout checks for navigation, cards, tables, and infobox-heavy sections.

## 10. Release And Work Integration

- [x] 10.1 Extend release detail wiki data loading to resolve work realm context through UnitWork.
- [x] 10.2 Add release wiki UI state for official realm, community realm choices, no-context fallback, and conflict diagnostics where applicable.
- [x] 10.3 Ensure release wiki UI links to the resolved realm Wiki tab and configured Zone page.
- [x] 10.4 Add tests or stories for release with official realm, release with multiple community realms, and standalone release with no work context.

## 11. Management UI

- [x] 11.1 Add realm/Zone management controls for assigning a wiki Zone to a realm.
- [x] 11.2 Add Zone editor controls for wiki template, homepage template, theme tokens, navigation config, and homepage sections.
- [x] 11.3 Add LABEL Unit picker/creator flow for navigation headings and homepage labels.
- [x] 11.4 Add WorkRealmContext management surface or admin operation for linking works to official/community/language/archive realms.
- [x] 11.5 Add validation messages for raw manual labels, invalid references, low-contrast theme tokens, and conflicting official contexts.
- [x] 11.6 Ensure management controls follow existing app feature layering and import from public feature indexes.

## 12. Seeds And Fixtures

- [x] 12.1 Add seed data for a work with visible releases and an official realm context.
- [x] 12.2 Add seed data for a realm with WIKI Post Units sent through UnitRealm.
- [x] 12.3 Add seed data for wiki TranslationGroups with at least two language variants.
- [x] 12.4 Add seed data for character/location/faction Entities and work/release SubjectAttribution rows.
- [x] 12.5 Add seed data for LABEL Units used by wiki navigation and homepage sections.
- [x] 12.6 Add seed wiki Zones for `wiki-classic`, `wiki-media`, `wiki-database`, and `wiki-minimal` theme presets.
- [x] 12.7 Add seed scenarios for empty/stub/recent/updated wiki sections.

## 13. Tests And Verification

- [x] 13.1 Run contract tests for UnitType, WorkRealmContext, Zone wiki config, navigation, homepage, and theme schemas.
- [x] 13.2 Run server tests for LABEL creation, WorkRealmContext permissions, Zone config validation, TranslationGroup best-language resolution, and realm wiki queries.
- [x] 13.3 Run API client tests or type checks for new query/mutation surfaces.
- [ ] 13.4 Run frontend component tests or stories for Realm Wiki tab, wiki Zone templates, navigation, homepage sections, and management forms.
- [x] 13.5 Run search/index tests for realm-scoped wiki listing and subject/tag/translation group filters.
- [x] 13.6 Run `bun run format:check`.
- [x] 13.7 Run `bun run check:convention`.
- [x] 13.8 Run affected package tests with Bun filters where available.
- [x] 13.9 Run `openspec validate define-realm-wiki-zone-experience --strict`.
- [ ] 13.10 Document manual verification URLs for realm Wiki tab, wiki Zone homepage, release wiki context, and Zone management after `bun run dev`.
