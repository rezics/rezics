## 1. Directive Parser

- [ ] 1.1 TODO — choose directive parser implementation and wire it into the shared markdown renderer.
- [ ] 1.2 TODO — parse block and inline slot directives; expose parsed slot references to the renderer.
- [ ] 1.3 TODO — directive attribute parsing overrides slot `render` intent.

## 2. Slot Renderer Registry

- [ ] 2.1 TODO — registry module with per-`type` renderer registration and unknown-type fallback.
- [ ] 2.2 TODO — implement `unit-ref` slot renderer (card / chip / hover-preview variants).
- [ ] 2.3 TODO — implement `entity-list` slot renderer (horizontal / vertical / grid / table variants, group-by, card sizing).
- [ ] 2.4 TODO — implement `infobox` slot renderer (markdown labels and values, date and link value types, ref value type).

## 3. Hydration

- [ ] 3.1 TODO — hydration provider that calls `scanRefs(doc)` and batch-fetches referenced Units.
- [ ] 3.2 TODO — restricted / deleted / not-found placeholders for refs that cannot be hydrated.
- [ ] 3.3 TODO — caching strategy aligned with TanStack Query keys.

## 4. Layout

- [ ] 4.1 TODO — layout shell renders `main` / `aside` / `before-main` / `after-main` regions.
- [ ] 4.2 TODO — responsive behaviour for aside region on narrow viewports.

## 5. Fallback Presentation

- [ ] 5.1 TODO — unknown-schema / unsupported-version banner with safe markdown rendering underneath.
- [ ] 5.2 TODO — unknown-slot-type placeholder with the slot id surfaced for debugging.

## 6. Editor Surface

- [ ] 6.1 TODO — directive insertion helpers in the wiki editor.
- [ ] 6.2 TODO — slot-aware composer surfaces (infobox / entity-list editing UI). Scope TBD.
- [ ] 6.3 TODO — locked-field error states for slot-level `UnitFieldLock` keys.

## 7. History UI

- [ ] 7.1 TODO — `history-product-ui` compare view renders `ContentDoc` slot diffs.
- [ ] 7.2 TODO — restore flow writes the stored `ContentDoc` back into `Post.content` and re-hydrates refs.

## 8. Validation

- [ ] 8.1 TODO — package-level tests for directive parsing, slot renderer registry, hydration.
- [ ] 8.2 TODO — browser smoke coverage: post timeline, chapter detail, wiki detail with infobox and entity-list, profile description, Unit translation description, history compare.
- [ ] 8.3 TODO — performance check: p50/p99 timeline render and wiki detail render against documented budget.
