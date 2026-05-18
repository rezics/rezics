## Context

Rezics already models durable catalog identity through `Unit` plus type-extension tables. `Entity` is a `Unit(type=ENTITY)` extension and already inherits slug scope, ownership, status, visibility, translations, support-language behavior, and public detail pages. The current `Attribution` relation links a content Unit to an Entity Unit with a free-form role and is used for creator/production credits such as author, translator, illustrator, publisher, studio, developer, cast, and voice actor.

Wiki and derivative-work indexing need a related but different relation: a fan fiction can feature a character, a chapter can mention a faction, a wiki post can be the canonical page for a family, and a book can define a location. These are subject relations, not credits. Reusing the existing credit relation would blur search, display, and moderation semantics; creating a new `Subject` table would duplicate the Entity/i18n/slug/wiki surface.

## Goals / Non-Goals

**Goals:**

- Reuse Entity as the abstract referent identity for people, organizations, characters, factions, families, locations, artifacts, events, and concepts.
- Add `SubjectAttribution` as a separate Unit-to-Entity relation for subject indexing.
- Keep `SubjectAttribution.role` flexible with a free-form string, mirroring the current attribution role strategy.
- Keep credit search and subject search separate.
- Support Unit-based indexing for books, fan fiction, wiki posts, chapters, media, and future Unit types.
- Preserve multilingual behavior through `UnitTranslation` and existing translation resolution mechanisms.

**Non-Goals:**

- Do not add a standalone `Subject` table.
- Do not add `CHARACTER`, `FACTION`, `LOCATION`, or similar values to `UnitType`.
- Do not replace `TAG`, `UnitTag`, or `RealmTagUnit`; tags remain lightweight classification.
- Do not design the full wiki authoring/history/lock system in this change.
- Do not require a database enum for subject roles or Entity kinds.

## Decisions

### Decision: Entity is the subject identity

`Entity` remains the single durable identity table for abstract referents. The contract-level `entityKinds` list expands to include subject kinds, but the database field remains `String?`.

Alternatives considered:

- New `Subject` table: rejected because it duplicates Unit identity, UnitTranslation, slug scope, verification, detail pages, and translation-group linkage needs.
- New Unit types per subject class: rejected because it would make `UnitType` explode and require separate extension tables for categories with similar behavior.
- Tags as subjects: rejected because tags are lightweight classifiers and do not carry the stronger identity, i18n, slug, and wiki-page semantics required for characters and setting objects.

### Decision: SubjectAttribution is separate from credit attribution

`SubjectAttribution` links any target Unit to an Entity Unit with a free-form `role`, ordered display metadata, and optional weight. It is not used for creator credits. Existing `Attribution` semantics are narrowed to credits and should be renamed in code/API surfaces to `CreditAttribution` during implementation.

Alternatives considered:

- Extend current `Attribution`: rejected because current indexing and display treat it as credits (`creditNames`). Adding characters and factions would pollute author/publisher/cast search.
- Use `UnitTag`: rejected because subject links need Entity resolution, i18n names, kind filters, and potentially canonical wiki pages.

### Decision: role is a free-form string

`SubjectAttribution.role` uses `String @db.VarChar(64)` without a database enum. Contract constants provide recommended roles such as `primary_character`, `featured_character`, `appears`, `about`, `setting`, `source_work`, `canonical_wiki_page`, and `related_subject`.

Alternatives considered:

- Database enum: rejected because derivative-work communities invent roles quickly and schema migrations should not be required for new relation semantics.
- JSON-only relation metadata: rejected because the primary role needs to be indexed, filtered, and constrained by composite uniqueness.

### Decision: Search gets subject-specific fields

The content index gains subject fields such as `subjectEntityIds`, `subjectNames`, `subjectKinds`, and `subjectRoles`. `creditNames` remains credit-only.

Alternatives considered:

- Merge subject names into `creditNames`: rejected because it makes character/faction hits indistinguishable from author/publisher hits.
- Rely on relational DB queries only: rejected because subject-based browsing and search should participate in the same content search stack.

### Decision: Wiki pages link through SubjectAttribution, not special columns

A wiki POST or translated wiki POST can be connected to its subject with `SubjectAttribution(role = "canonical_wiki_page")` or `role = "about"`. Parallel translations continue to use `TranslationGroup`.

Alternatives considered:

- Add `Entity.wikiUnitId`: rejected because wiki pages can have multiple language Units and multiple relevant relation roles.
- Add a separate wiki-subject mapping table: rejected because it is a specialized subset of `SubjectAttribution`.

## Risks / Trade-offs

- [Risk] Entity row count grows as communities add characters and setting objects. → Mitigation: product policy distinguishes durable subjects from lightweight tags; only reusable, index-worthy subjects become Entities.
- [Risk] Free-form roles can drift. → Mitigation: export recommended contract constants and use admin/editor UI defaults while keeping storage flexible.
- [Risk] Renaming Attribution to CreditAttribution touches many packages. → Mitigation: perform a development-stage cutover in one OpenSpec apply pass, preserve database data, and keep the migration mechanical.
- [Risk] Search documents grow with subject names. → Mitigation: keep fields denormalized but scoped, use partial sync on SubjectAttribution mutations, and avoid embedding full Entity DTOs in Meili documents.
- [Risk] Users may confuse tags with subjects. → Mitigation: UI copy and picker affordances should distinguish lightweight tags from indexed subjects.

## Rollout Plan

1. Add Prisma schema for `SubjectAttribution` with indexes for target-unit and subject-centric queries.
2. Add contract schemas and role constants for subject attribution.
3. Add server service/API for linking, unlinking, and listing subject attributions.
4. Rename or alias current Attribution surfaces to `CreditAttribution`, updating internal callsites in the same change.
5. Extend Entity kind constants and admin/entity-picker UI options.
6. Extend content search document building and partial sync for subject fields.
7. Add admin/app UI surfaces only where needed for initial management and browsing.
8. Run Prisma migration/generation, unit tests, contract checks, and search sync tests.

Rollback is schema-migration dependent. Before production data exists, rollback can drop the new table and revert the code cutover. With production data, rollback should first export or preserve `SubjectAttribution` rows because they are new user/catalog data.

## Open Questions

- Should the physical Prisma model for current credits be renamed from `Attribution` to `CreditAttribution`, or should only contract/API/service names change first?
- Which initial subject roles should appear in UI pickers versus remain hidden as advanced/manual roles?
- Should `SubjectAttribution` include `createdByUnitId` in v1, or defer authorship/audit to the future history infrastructure?
