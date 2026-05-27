## Why

Rezics has the primitives for realms, wiki posts, entities, work domains, translation groups, and zones, but it does not yet define how they combine into a Fandom-like wiki experience. Users need to browse wiki content from library release/work contexts, communities need realm-scoped wiki organization and governance, and fandom-style navigation/theme customization needs a bounded model that does not turn release pages or wiki posts into ad hoc CMS pages.

This change defines the product and data boundary for realm wiki aggregation, work-based official realm selection, themed wiki zones, multilingual wiki navigation/home pages, and reusable label Units.

## What Changes

- Define realm wiki membership through existing `UnitRealm` semantics: sending a wiki Unit to a realm makes it part of that realm's content set; reposting/forwarding remains a separate discussion post that references the original content.
- Define `PostKind.WIKI` pages as parallel translated Units grouped by `TranslationGroup`; wiki page language variants SHALL NOT be modeled as `UnitTranslation` rows on one wiki Unit.
- Add work-to-realm context configuration so a release can resolve its work's official or community realm for wiki discovery.
- Define the realm Wiki tab as a uniform Rezics-themed list/search/entry surface with a prominent link into the themed wiki Zone.
- Define the wiki Zone as the Fandom-like surface: custom theme tokens, built-in wiki templates, navigation, entity/tag/translation-group sections, and homepage modules.
- Extend Zone configuration for wiki-specific filters, theme tokens, navigation, and homepage section schemas while preserving the existing Zone model as the frontend template/filter container.
- Add `UnitType.LABEL` as a minimal Unit-only type for multilingual navigation labels and section headings that need `UnitTranslation` but no domain extension table.
- Define i18n rules for wiki navigation and home pages: store Entity, Tag, TranslationGroup, and LABEL Unit ids where possible; manual labels must use explicit translation maps.
- Define built-in wiki templates and homepage section kinds so implementation is feature-complete without supporting arbitrary CSS or free-form CMS layouts.
- Keep wiki content ownership/editing, content authority, field locks, realm moderation, and zone route mechanics aligned with existing specs rather than introducing parallel governance models.

## Capabilities

### New Capabilities

- `generic-label-unit`: Introduces `UnitType.LABEL` as a Unit-only, translatable label/navigation node with strict non-catalog semantics.
- `work-realm-context`: Defines how work domains select official/community/language/archive realms used by release detail wiki discovery.
- `realm-wiki-entry`: Defines realm wiki membership, the uniform realm Wiki tab, wiki sending vs reposting semantics, and Zone entry behavior.
- `wiki-zone-navigation`: Defines multilingual Fandom-style navigation using Entity, Tag, TranslationGroup, LABEL, and manual translated links.
- `wiki-zone-homepage`: Defines built-in wiki homepage templates and controlled section schemas for entity, tag, translation group, recent, updated, stub, and manual areas.
- `wiki-zone-theme`: Defines restricted theme tokens and built-in wiki Zone templates; arbitrary CSS is out of scope.

### Modified Capabilities

- `zone-model`: Extend Zone configuration to support wiki-specific filters, navigation, homepage, and theme configuration.
- `zone-frontend`: Extend Zone rendering so wiki templates can render Fandom-like pages from Zone configuration.
- `realm-frontend`: Add a Wiki tab that stays on the uniform app theme and links to the configured wiki Zone.
- `realm-post-junction`: Clarify that wiki Units use `UnitRealm` for sent realm membership and that reposting is a separate referencing post.
- `wiki-post-editing`: Clarify parallel translation via `TranslationGroup` and realm wiki usage.
- `subject-attribution`: Clarify that wiki pages describe Entities through subject attribution and that work/release character lists come from subject relations, not wiki ownership.
- `unit-work-domain`: Define how release pages resolve work realm context for wiki discovery.

## Impact

- Affected packages: `package/contract`, `package/server`, `package/api`, `package/app`, `package/search`, `package/job-runner`, and seed fixtures.
- Database impact:
  - Add a Unit type enum value for `LABEL` without an extension table.
  - Add normalized work-realm context data or an equivalent typed configuration table for `workUnitId -> realmUnitId` context roles.
  - Extend Zone JSON contracts for wiki navigation, homepage, and theme configuration.
  - No separate `RealmWikiPage` ownership table is introduced.
- API impact:
  - Add or extend work realm context CRUD/read endpoints.
  - Extend Zone DTO/create/update schemas with wiki configuration.
  - Ensure realm detail/wiki DTOs expose the configured wiki Zone and resolved work realm context where needed.
- Frontend impact:
  - Realm detail gains a uniform Wiki tab.
  - Zone pages gain wiki templates, navigation, home modules, and token-based theming.
  - Release detail wiki surfaces resolve official/community realms through work realm context.
- Search/index impact:
  - Wiki Zone lists and sections query wiki Units by realm membership, wiki post kind, entity subject attribution, tags, and translation group ids.
  - Search should continue to treat wiki content as descriptive content, not canonical product metadata.
- Backward compatibility:
  - Existing realm feeds and `UnitRealm` memberships remain valid.
  - Existing wiki posts remain valid; translation grouping is used when present.
  - Existing Zones continue to render through existing templates unless their `template` and wiki configuration opt into wiki behavior.
  - Existing realm pages keep their uniform theme; custom wiki theming is only applied inside Zone pages.
