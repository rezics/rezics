## Why

Realm and entity metadata are stored as UnitTranslation rows, but their editing
surfaces do not yet support managing multiple languages consistently. Realm
management only edits the resolved fallback translation, entity has no edit
route, and entity detail renders language choices as chip-like buttons instead
of a selection control.

This change standardizes UnitTranslation editing for realm and entity metadata
while keeping the scope clear: it applies to unit-backed metadata objects such
as book, realm, entity, and future game-like catalog units. It does not apply to
chapter, review, excerpt, or post body translation workflows.

## What Changes

- Add a shared Select-based UnitTranslation language control for metadata edit
  surfaces.
- Update the book edit translation language control to use Select instead of
  chip-like badges.
- Extend realm management so editors can select and add UnitTranslation
  languages before saving title and description.
- Add an entity edit route for admins/root users, supporting entity fields and
  UnitTranslation title/subtitle/summary/description editing.
- Update entity detail language switching to use Select, matching the book
  detail language selector.
- Render an entity edit entry for admins/root users on entity detail pages.

## Capabilities

### Modified Capabilities

- `unit-translation`: Clarifies metadata-edit UI scope and Select-based
  language controls.
- `realm-frontend`: Extends realm management with multi-language metadata
  editing.
- `entity-detail-page`: Replaces chip language switching with Select and adds
  the admin edit entry.

## Impact

- Affected packages:
  - `package/app`: shared unit translation control, book edit, realm manage,
    entity detail, and entity edit route/page.
- Backend/API:
  - No new endpoint required. Realm can use the existing UnitTranslation upsert
    API. Entity can use the existing entity update API that accepts
    translations.
- Compatibility:
  - Existing book, realm, and entity reads continue to resolve translations via
    the current fallback helpers.
  - Chapter/review/excerpt/post translation behavior is intentionally unchanged.
