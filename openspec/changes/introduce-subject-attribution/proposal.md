## Why

The platform needs Unit-based indexes for wiki and derivative-work subjects such as characters, factions, families, locations, artifacts, events, and concepts without creating a second Entity-like identity system. The existing `Entity` model already provides Unit identity, translations, slug scope, verification, and detail surfaces, so subject indexing should reuse Entity identity while separating creator credits from wiki/subject relations.

## What Changes

- Introduce `SubjectAttribution`, a Unit-to-ENTITY relation for subject indexing across books, fan fiction, wiki posts, chapters, media, and other Units.
- Keep `SubjectAttribution.role` as a free-form string, matching the existing flexible role strategy used by attribution credits.
- Broaden the contract-level Entity kind vocabulary to include wiki subject kinds such as `character`, `faction`, `family`, `location`, `artifact`, `event`, and `concept`.
- Re-scope the current `Attribution` concept as creator/production credits. In implementation this should become `CreditAttribution` in code/API naming, with a clear migration plan from the existing table/API names.
- Add subject indexing fields to content search, separate from `creditNames`, so character/faction search does not pollute author, translator, publisher, studio, or cast search.
- Preserve Entity i18n through `UnitTranslation`; do not add display-name fields or a parallel `Subject` table.

## Capabilities

### New Capabilities

- `subject-attribution`: Unit-to-ENTITY subject indexing for characters, factions, families, locations, artifacts, events, concepts, and other wiki subjects.

### Modified Capabilities

- `entity-unit-type`: Entity is clarified as the platform's abstract referent / wiki subject identity, not only a credited party, and gains contract-level subject kind constants.
- `attribution`: Existing Attribution semantics are narrowed to credit attribution and prepared for a `CreditAttribution` naming cutover.
- `content-index`: Search indexing gains subject-specific fields independent from credit indexing.

## Impact

- Affected packages: `package/server`, `package/contract`, `package/api`, `package/search`, `package/admin`, and `package/app`.
- Database impact: add a new `SubjectAttribution` table. Rename or alias existing Attribution surfaces to `CreditAttribution` in a development-stage cutover.
- API impact: add subject attribution link/unlink/list endpoints and contract DTOs; rename or migrate existing attribution credit DTOs and APIs if the cutover is accepted.
- Search impact: add `subjectEntityIds`, `subjectNames`, `subjectKinds`, and `subjectRoles` fields to the content index while keeping `creditNames` credit-only.
- Backward compatibility: this development-stage project prefers clear internal cutovers. Existing internal callsites should be updated in the same change; data migration should preserve current Attribution rows as credit attribution rows.
- Non-goals: do not create a standalone `Subject` table, do not model every character/faction/family as a new Unit type, and do not replace `TAG` or `UnitTag` for lightweight classification.
