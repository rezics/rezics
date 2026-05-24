## Context

The history service now exposes path-snapshot compare data: each changed entry
has a semantic path and base/target effective values. The frontend compare
model turns those entries into product renderers such as scalar before/after,
markdown/text diff, collection diff, or product-safe unknown fallback.

ContentDoc descriptions introduced nested source paths. A description change
may appear as `translations.zh-hant.description.main.source`, and future rich
schemas may have more than one source-bearing leaf under a single rich object.
The compare UI should preserve those paths because they identify the exact
changed leaf, while still rendering textual values with the existing line diff
experience.

Current data flow:

```text
history service path-snapshot compare
  -> [{ path, base.value, target.value }]
  -> app compare model classifies the entry
  -> compare surface renders scalar / text diff / collection / fallback
```

Target data flow:

```text
path-snapshot entry
  -> preserve full path as change identity
  -> classify value + path semantics
       textual source leaf -> text diff
       collection leaf     -> semantic collection diff
       scalar leaf         -> before/after
       unknown object      -> product-safe changed indicator
  -> render selected layout
       unified             -> single-column text diff
       split               -> side-by-side text diff
```

## Goals / Non-Goals

**Goals:**

- Preserve exact nested compare paths in navigation, anchors, headings, and
  testable compare model output.
- Treat textual source leaves as text diff candidates even when the leaf name
  is `source` rather than `description`, `summary`, or `body`.
- Keep unified and split modes as presentation layouts for the same text diff
  model.
- Allow multiple source leaves under the same rich object to be independently
  diffable.
- Keep fallback behavior product-safe for unrecognized object changes.

**Non-Goals:**

- No history service API or database changes.
- No ProseMirror/AST-aware rich document diffing.
- No parent-level merge of multiple source leaves by default.
- No raw JSON diff exposure in the product compare surface.

## Decisions

### 1. Preserve leaf paths as compare identity

The compare model will continue to use the exact path returned by the
path-snapshot compare API as the change identity. For example,
`translations.zh-hant.description.main.source` remains distinct from
`translations.zh-hant.description.slots.cast.title.source`.

Alternative considered: collapse known ContentDoc paths back to the parent
field such as `translations.zh-hant.description`. Rejected because it hides
which source leaf changed and does not scale to richer schemas with multiple
source fields.

### 2. Classify textual source leaves by path shape and value type

A path-snapshot entry is a textual source leaf when both base and target values
are strings and either:

- the terminal field is a known long-text field such as `description`,
  `summary`, `body`, or `content`; or
- the path is a recognized rich content source path, such as a `source` leaf
  under a ContentDoc-style object.

The first rule preserves legacy string payload behavior. The second rule covers
ContentDoc paths without hard-coding a single parent field. A future schema can
add additional source leaves and receive independent diffs as long as the path
classification recognizes them as source content.

Alternative considered: diff every changed string value. Rejected because short
labels, slugs, enum-like strings, and internal structural strings are clearer
as scalar before/after values.

### 3. Keep layout mode separate from diff strategy

The compare model decides whether a change is textual, scalar, collection, or
fallback before rendering. Unified and split modes only affect how a textual
diff is laid out:

```text
same TextDiff parts
  -> unified: old/new lines in one flow
  -> split: old lines on the left, new lines on the right
```

Alternative considered: let unified mode enable diffing while split mode shows
before/after values. Rejected because layout switching should not change the
semantic information available to the viewer.

### 4. Grouping is visual, not semantic

The UI may visually group related nested paths under a nearby readable parent
for scanning, but each changed source leaf remains separately addressable and
independently rendered. Grouping must not merge source values into one diff or
change the path used for anchors/tests.

Alternative considered: render only a flat list of full paths. Kept as a valid
implementation fallback, but grouping can improve readability when rich content
schemas become wider.

## Risks / Trade-offs

- **Risk: source path classification becomes too broad** -> Require both string
  values and recognized source path shapes; keep short string fields as scalar
  unless explicitly classified as long text.
- **Risk: users see overly technical nested paths** -> Use readable labels for
  path segments where available, while still exposing enough path detail to
  distinguish leaves such as `main.source` and `slots.cast.title.source`.
- **Risk: future rich schemas need new source path rules** -> Keep the
  classifier local and table-driven so new path patterns can be added without
  changing history service contracts.
- **Risk: split view overflows on narrow screens** -> Preserve the existing
  responsive behavior that can fall back to a single-column/unified layout for
  normal prose content.

## Rollout Plan

1. Add compare model tests for `description.main.source` and multiple source
   leaves under one rich object.
2. Update the compare model classifier to recognize textual source leaves while
   preserving exact paths.
3. Ensure `BookRevisionComparePage` renders source leaf changes through the
   existing unified/split text diff components.
4. Add focused UI/model assertions that switching layout does not change the
   set of rendered changed paths.
5. Run targeted app tests for history compare.

Rollback is a frontend-only revert. The history service response shape and
stored revision data remain unchanged.

## Open Questions

- Should future admin/debug surfaces expose raw object diffs for unknown rich
  object changes, separate from the product compare surface?
- When rich schemas become much wider, should path grouping become an explicit
  UI control rather than a passive visual grouping?
