## Context

This change picks up where `introduce-content-doc-schema` ends. The schema, slot family, inline directive grammar, `scanRefs`, `extractText`, renderer trust model, and storage / history / authority cut-over are already in place. The remaining work is the actual rendering and editing surface.

## Goals / Non-Goals

**Goals:**

- TODO

**Non-Goals:**

- TODO

## Decisions

### Decision: Directive parser library and integration point

TODO — pick between `remark-directive`, a custom CommonMark extension, or an alternative; document the integration point in the shared renderer.

### Decision: Slot renderer registry shape

TODO — module API, registration timing, fallback handling for unknown `type`.

### Decision: Hydration provider boundary

TODO — where `scanRefs` runs, how batch fetch is dispatched, how the rendered tree consumes hydrated data.

### Decision: Layout-region styling responsibility

TODO — which package owns the `main` / `aside` / `before-main` / `after-main` CSS; how the design system tokens are applied.

### Decision: Editor surface for slots

TODO — incremental approach (Markdown-only v1.x with directive insertion helpers) vs full structured editor.

## Risks / Trade-offs

- TODO

## Migration Plan

- N/A — this change does not migrate storage; it adds rendering and editing.

## Open Questions

- TODO
