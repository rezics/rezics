## Why

`introduce-content-doc-schema` defines the canonical `ContentDoc` schema, the slot family, the inline directive grammar, `scanRefs`, and `extractText`. It deliberately ships no renderer: read paths today either bypass the structured slots or fall back to rendering raw Markdown. This follow-up change builds the rendering layer on top of that frozen schema so wikis, rich descriptions, and structured posts actually display their slots, references, and layouts.

## What Changes

- TODO: Markdown directive parser integration in the shared renderer. Parses `:::slot{id="..."}` block and `:slot[...]{...}` inline directives, dispatches to the slot renderer registry.
- TODO: Slot renderer registry — per-`type` renderer registration with a fallback for unknown types.
- TODO: Slot components — `EntityList` (horizontal / vertical / grid / table variants), `Infobox`, `UnitRefCard` / chip / hover preview.
- TODO: Hydration provider — calls `scanRefs(doc)` and batch-hydrates referenced Units through the existing Unit read paths.
- TODO: Layout rendering — places non-inline slots into `main` / `aside` / `before-main` / `after-main` regions.
- TODO: Fallback UI for unsupported `schema` / `version` / unknown slot types — visible but graceful (per `content-doc-schema` renderer trust model).
- TODO: Slot-aware editor surface for wiki posts and rich descriptions, allowing structured slot composition (infobox, entity list, layout) beyond plain Markdown.
- TODO: History compare / restore UI for `ContentDoc` snapshots (`history-product-ui` updates).
- TODO: Browser smoke coverage across post / chapter / wiki / profile description / Unit translation description surfaces.

## Capabilities

### New Capabilities

- `content-doc-rendering`: Defines how `ContentDoc` is parsed, hydrated, and rendered across post / chapter / wiki / description surfaces, including the directive parser, slot renderer registry, layout placement, hydration provider, and fallback presentation.

### Modified Capabilities

- TODO: `markdown-post-content` — integrate the directive parser and slot registry into the post body renderer.
- TODO: `markdown-user-description` — integrate slot rendering into description surfaces.
- TODO: `post-presentation-architecture` — `PostBodyMarkdown` composes the directive parser and slot registry.
- TODO: `wiki-post-editing` — wiki editor gains slot-level surfaces.
- TODO: `history-product-ui` — compare / restore visualises `ContentDoc` slot deltas.

## Out of Scope

- Schema changes to `ContentDoc`, slot family, `scanRefs`, or `extractText` — those are owned by `introduce-content-doc-schema` and are frozen for v1.
- New slot types beyond `unit-ref` / `entity-list` / `infobox` / `unknown` — add in a separate change.
- Slot-level partial-update / patch APIs — v1 stays with whole-document replace.

## Impact

- Affected packages: TODO.
- Performance budget: rendering must batch-hydrate refs via `scanRefs`; TODO add explicit p50/p99 targets for a representative timeline and a representative wiki detail page.
- Schema cut-over has already shipped via `introduce-content-doc-schema`; this change does not migrate storage.
