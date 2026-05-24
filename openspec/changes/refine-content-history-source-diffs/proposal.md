## Why

History compare currently has a gap between path-snapshot data and user-facing
diff rendering. Rich description values now store ContentDoc-shaped objects, so
text changes can arrive as precise nested leaf paths such as
`translations.zh-hant.description.main.source`; those paths should remain
visible and independently diffable instead of collapsing into a parent field or
falling back to scalar before/after rendering.

This matters now because content history is becoming a primary review and audit
surface. Users need to understand exactly which source leaf changed, while the
UI still needs a clear unified/split text diff experience.

## Problem

- The compare UI's text-diff classification is tied to field names such as
  `description`, `summary`, and `body`, which does not naturally cover nested
  source leaves like `description.main.source`.
- Unified and split compare modes are display layouts, but the current behavior
  can make it feel like only some fields receive real diff treatment.
- Rich content schemas may grow additional source-bearing leaves under the
  same object, and collapsing them into one parent-level diff would hide useful
  structure.

## Goals

- Preserve full semantic leaf paths returned by the path-snapshot compare API,
  including nested paths such as `*.main.source`.
- Render textual source leaves as line-level text diffs in both unified and
  split modes.
- Treat unified and split modes as layout choices only; they must not decide
  whether a changed value is diffed.
- Allow multiple source leaves under the same rich object to remain
  independently diffable.
- Keep scalar, collection, and product-safe unknown fallback behavior for
  non-source fields.
- Keep public compare output product-safe and avoid raw JSON exposure for
  unrecognized object changes.

## Non-goals

- Do not change the history service path-snapshot compare API or storage model.
- Do not introduce document-aware ProseMirror/AST diffing in this change.
- Do not merge multiple source leaves into a single parent-level diff by
  default.
- Do not expose raw revision payload JSON in the product compare surface.
- Do not change restore, timeline ingestion, or changed-field derivation
  semantics.

## Scope

This change is limited to frontend compare semantics and specs for content
history source diff rendering. It covers Book history compare today, and should
be written so the same model can support Entity and other editorial Unit
compare surfaces when they use the same path-snapshot compare response.

## What Changes

- Define textual source leaf classification for path-snapshot compare entries.
- Preserve full nested paths in changed-field navigation and section headings,
  while allowing the UI to group related paths for readability.
- Render any recognized textual source leaf with the existing text diff engine
  in both unified and split layouts.
- Add regression coverage for `description.main.source` and multiple source
  leaves under one rich object.
- Clarify that rich object structural leaves and unknown object changes use
  scalar or product-safe fallback rendering rather than raw JSON diff exposure.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `content-history-compare-ui`: Clarifies that path-snapshot compare output
  preserves full nested leaf paths and that textual source leaves render with
  text diffs.
- `history-product-ui`: Clarifies that unified and split compare modes are
  layout choices for text diffs, not the decision point for whether text
  diffing applies.
- `revision-compare`: Aligns the generic frontend compare model with rich
  source leaf paths and independently diffable source leaves.

## Impact

- Affected packages:
  - `package/app`: compare model classification, compare rendering, and
    focused tests for source leaf diff behavior.
- APIs:
  - No API changes. The existing history service path-snapshot compare response
    remains the source of base and target values.
- Backward compatibility:
  - Existing scalar, collection, markdown string, and product-safe fallback
    behavior remains compatible.
  - Existing full paths remain valid; this change makes more nested text paths
    render as text diffs instead of less-informative before/after values.
- Migration needs:
  - No database or data migration.
  - No history backfill changes.
