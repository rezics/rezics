## ADDED Requirements

### Requirement: ExcerptSourcePicker editor field

The editor surface for Excerpt posts SHALL provide an `<ExcerptSourcePicker>` field that produces a value matching `excerptSourceSchema` (`mode: 'unit' | 'url'` discriminated union; see `type-extension-post`). The field SHALL be URL-first: a single text input is the primary affordance, accepting any URL the author types or pastes.

The field SHALL also expose a collapsed disclosure "Pick from this work" that, when expanded, shows a tree of units rooted at the post's `targetUnitId` from which the author can select. The disclosure SHALL remain collapsed by default.

The field SHALL produce one of:
- `{ mode: 'unit', unitId, title }` when the author picks from the tree, or when the URL input auto-classifies as an internal unit reference (see next requirement).
- `{ mode: 'url', url, title }` for any other URL.
- `undefined` when the author leaves the field blank.

#### Scenario: Default state is empty URL field

- WHEN an author opens the Excerpt editor
- THEN the source picker shows an empty URL input and a collapsed "Pick from this work" disclosure

#### Scenario: Tree picker disclosure starts collapsed

- WHEN an author opens the Excerpt editor
- THEN the unit tree under `targetUnitId` is NOT visible until the disclosure is expanded

#### Scenario: Picking from tree produces unit-mode value

- GIVEN the author expands "Pick from this work" and selects a chapter unit
- WHEN the form value is read
- THEN it equals `{ mode: 'unit', unitId: <chapter id>, title: <prefilled display name> }`

#### Scenario: Plain external URL produces url-mode value

- GIVEN the author types `https://example.com/article` into the URL input
- WHEN the form value is read
- THEN it equals `{ mode: 'url', url: 'https://example.com/article', title: <author-entered title> }`

#### Scenario: Empty input produces undefined

- WHEN the author leaves the source field blank
- THEN the form value is `undefined` and the post saves without an `extra.source`

### Requirement: Auto-classification upgrades pasted unit URLs to unit mode

When the URL input contains a string that classifies as an in-app `/unit/:id` route or a typed-page route mappable back to a unit (e.g., `/book/:id`, `/chapter/:id`, `/excerpt/:id`), the picker SHALL extract the unit id and store the value as `{ mode: 'unit', unitId, title }` rather than `{ mode: 'url', url, title }`.

This auto-upgrade SHALL be reversible: if the author edits the URL away from a recognizable in-app form, the value SHALL switch back to `{ mode: 'url', url, title }`.

When the auto-upgrade fires, the picker SHALL surface a single-line affordance (e.g., "Linked to: Chapter 3") so the author understands that the source was upgraded. The affordance SHALL NOT be modal or interrupting.

#### Scenario: Pasting /unit/:id upgrades to unit mode

- GIVEN the URL input is empty
- WHEN the author pastes `/unit/u-1`
- THEN the stored value becomes `{ mode: 'unit', unitId: 'u-1', title: <prefilled> }`
- AND a "Linked to: <unit name>" affordance appears once

#### Scenario: Pasting typed-page URL upgrades to unit mode

- WHEN the author pastes `/book/book-1`
- THEN the picker reverses the route to a unit id and stores `{ mode: 'unit', unitId: 'book-1', title: <prefilled> }`

#### Scenario: Editing away from in-app form reverts to url mode

- GIVEN a value of `{ mode: 'unit', unitId: 'u-1', title: 'Chapter 3' }`
- WHEN the author edits the URL field to `https://example.com/article`
- THEN the stored value becomes `{ mode: 'url', url: 'https://example.com/article', title: 'Chapter 3' }`

#### Scenario: Unrecognized in-app path falls back to url mode

- WHEN the author pastes `/something/not-a-route/abc`
- THEN no auto-upgrade fires and the value remains `{ mode: 'url', url: '/something/not-a-route/abc', title: <author-entered> }`

### Requirement: Title pre-fill is editable

When auto-classification upgrades a URL to `mode: 'unit'`, the picker SHALL pre-fill `title` with the linked unit's display name (translated into the viewer's language using the existing translation helpers). The author SHALL be able to overwrite the pre-filled title freely; subsequent edits SHALL NOT be re-overwritten by the picker.

When the author manually picks from the unit tree, the same pre-fill behavior SHALL apply.

When the author enters a non-internal URL, the title field SHALL remain empty and the author SHALL fill it in.

#### Scenario: Pre-fill on unit selection

- GIVEN the unit named "第三章 第一節" is selected from the tree
- WHEN the form value is read
- THEN `title` equals "第三章 第一節" (or the appropriate translation)

#### Scenario: Author edit is preserved

- GIVEN `title` was pre-filled as "Chapter 3"
- WHEN the author edits it to "《指環王》第三章，第一節" and continues editing other fields
- THEN the title remains "《指環王》第三章，第一節" and is never silently overwritten

#### Scenario: Url-only source has empty title initially

- WHEN the author pastes `https://example.com/article` (no auto-upgrade)
- THEN the title field is empty and the author types it in

### Requirement: ExcerptSourcePicker integrates with composed editor toolbar

The `<ExcerptSourcePicker>` SHALL be a composed editor field (consistent with the existing composed-editors pattern). It SHALL accept standard form-field props (`value`, `onChange`, `disabled`, `error`) and SHALL be usable inside the larger Excerpt post editor without prop drilling.

#### Scenario: Controlled usage

- GIVEN a parent form holding `[value, setValue]` state
- WHEN `<ExcerptSourcePicker value={value} onChange={setValue} />` is rendered
- THEN the picker reflects `value` and emits updated values via `onChange`, matching the controlled-component convention used by other composed-editor fields

#### Scenario: Disabled state

- WHEN `<ExcerptSourcePicker disabled />` is rendered
- THEN the URL input and the tree disclosure are both inert and visibly indicate the disabled state

#### Scenario: Error display

- WHEN `<ExcerptSourcePicker error="URL too long" />` is rendered
- THEN the error message is displayed beneath the URL input using the same error styling as other composed-editor fields
