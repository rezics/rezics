## Context

Primary post content is currently stored as `Post.body String?`, while post metadata and wiki-adjacent extensions are stored in `Post.extra Json?`. Long descriptions are also plain strings (`UnitTranslation.description`, `User.description`). This is sufficient for Markdown-only content but splits wiki structure across a body string, `extra`, and frontend conventions, and forces every "the description can be a paragraph" surface to either truncate or render an opaque blob.

The history service already stores editorial payloads as slot-based JSON snapshots, and the search system already uses Meilisearch as the full-text search surface. The main design problem is therefore the canonical write model: Rezics needs one structured content document schema that can represent Markdown text, slots, layout, and cross-Unit references without turning `extra` into a shadow schema or forcing PostgreSQL to become the text-search store.

## Goals / Non-Goals

**Goals:**

- Define a shared `ContentDoc` contract with a composable slot family for long-form editable content.
- Replace `Post.body` with `Post.content` as the canonical post/chapter/wiki content payload.
- Change rich description fields (`UnitTranslation.description`, `User.description`) to the same `ContentDoc` shape while keeping compact summary/bio fields plain strings.
- Define a single declarative reference scanner and a single text extractor that all consumers share.
- Keep text projections such as `contentText` and `descriptionText` in Meilisearch documents, not PostgreSQL.
- Preserve history, authority, and rendering boundaries through typed contracts and consistent field-key sub-paths.
- Keep this change's product runtime intentionally narrow: persist the full `ContentDoc` JSON, but only process the `main` Markdown block in server update semantics, rendering, search, history, and authority.
- Treat stored content as opaque-but-safe at read time: unknown / malformed values render as Markdown rather than throw.

**Non-Goals:**

- Renderer implementation beyond `main` Markdown fallback. This change defines the schema, the inline directive grammar, scanning, and extraction helpers in contract. Markdown-directive parsing in the rendering pipeline, slot component implementations, hydration UI, and unsupported-content presentation polish are deferred to a follow-up rendering change.
- Slot-level editor surfaces. The v1 editor remains markdown-only and writes into `content.main.source`; structured slot editing UI is in the follow-up.
- Runtime support for slots, layout, inline directives, and non-main content fields in server update semantics, search projection, authority locks, history changed-field keys, hydration, or rendering.
- CRDT, collaborative cursor, or block-level real-time editing.
- PostgreSQL JSON-path querying for content slots as a product filter, sort, or permission surface.
- Generic frontend plugin marketplace.
- Persistence of rendered HTML.
- Backwards-compatible `body` API after the internal development cut-over.
- Denormalized `Post.infobox` column. Infobox lives inside `content.slots.infobox`; books typically have no wiki infobox anyway, and the small set of wikis that need one do not justify a separate column.

## Decisions

### Decision: `ContentDoc` is the canonical long-form schema

The contract package exposes a `contentDocSchema` shaped around a versioned document:

```json
{
  "schema": "rezics.content",
  "version": 1,
  "main": { "type": "markdown", "source": "..." },
  "slots": {},
  "layout": []
}
```

`schema` identifies the document family. `version` identifies storage-format semantics and is independent from Unit revision sequence or optimistic-concurrency versioning.

Rationale:

- History snapshots remain interpretable after future schema evolution.
- Markdown remains the first content block type without making the top-level field name Markdown-specific.
- A single envelope serves posts, chapters, wikis, and rich descriptions.

Alternatives considered:

- `md_content` top-level key: rejected because it bakes the initial renderer into the storage model.
- Versionless JSON: rejected because archived history payloads would require shape guessing during migration.
- Fully normalized block rows: deferred until edit frequency or partial-update requirements justify the complexity.
- **Kind-based dispatch (`Post.body` for plain markdown, `Post.content` for structured)**: rejected. Would force every server mapper, history payload, search projection, and authority check to branch on which column is populated; the maintenance cost dwarfs any per-row JSON envelope overhead. Performance concerns are mitigated by the read-trust model (no per-read validation) and by Meilisearch owning text projection.

### Decision: `Post.body` is removed instead of retained as compatibility

Because the project is still in development, `Post.body` is removed during the cut-over. Existing development rows are migrated into `Post.content.main.source` with `type = "markdown"`. Empty strings migrate to `null` JSON.

Rationale:

- A dual `body` + `content` model creates drift and permanent mapper ambiguity.
- Internal callsites cut over in one change.
- Text projection remains available through Meilisearch, so keeping `body` as a cache column is unnecessary.

### Decision: Description fields become `ContentDoc`

`UnitTranslation.description` and `User.description` change column type from `String?` to `Json?` and store `ContentDoc`. No new `descriptionContent` column is introduced; the existing columns change shape. Compact identity fields (`UnitTranslation.summary`, `User.bio`) remain `String?` and are not affected.

Rationale:

- Long descriptions can carry references, lists of related works, and structure; the schema is the same one used for post bodies, so renderer, history, and search pipelines reuse one implementation.
- Adding a parallel `descriptionContent` column while keeping the old `description String` produces the same dual-write drift problem rejected for `Post.body`.
- `summary` and `bio` are compact card-line fields; structured content there would be misuse.

### Decision: Server writes treat content as opaque JSON

Server write paths SHALL NOT recursively validate `ContentDoc` semantics. They SHALL NOT reject a write because `schema`, `version`, `main`, `slots`, `layout`, directive placement, slot shape, or slot type is unknown or malformed. Create/update APIs persist the full submitted JSON value in `Post.content` / rich `description` fields. The server boundary is persistence and the supported v1 product behavior: read/write the full JSON, but interpret only `content.main` for rendering, search, history, and authority in this change.

Rationale:

- Keeps the server from becoming the owner of content semantics while the editor and renderer evolve.
- Preserves unknown future schema versions and experimental slot payloads.
- Avoids turning lock checks into schema validation.

### Decision: Renderer trust model — no read validation, Markdown fallback

Read paths SHALL NOT re-validate stored documents. If a renderer receives a value it cannot interpret — unknown `schema`, unsupported `version`, malformed JSON, or a raw string accidentally stored — it SHALL render the raw value as Markdown rather than throw.

Concretely, the renderer fallback sequence is:

1. If the value is a string → render it as Markdown.
2. Else if `content.main.source` is a non-empty string → render that as Markdown.
3. Else → render `JSON.stringify(content)` as Markdown (typically displays as a code-block-ish blob, never crashes).

Rationale:

- Eliminates the timeline-hot-path validation cost that would otherwise scale linearly with reply count.
- Treats stored content as opaque-but-safe input. Unknown future versions, partial migrations, manual edits, or data corruption never crash a render.
- Keeps the user's stored content visible (lossless degradation), even when the renderer cannot interpret the structure.

### Decision: Runtime v1 supports only `main` Markdown

The full `ContentDoc` schema enters `@rezics/contract` in this change, including slots, layout, inline directive grammar, `scanRefs`, and `extractText`. Product services, however, only support the `main` Markdown block in this first cut-over.

Server create/update persists the full submitted JSON value. Non-main parts (`slots`, `layout`, inline directive references, unknown future fields) are preserved in storage and DTOs, but this change does not interpret or mutate them. Specifically, runtime services SHALL NOT:

- render slot/layout content;
- hydrate references from slots;
- index slot/layout text into Meilisearch;
- emit slot/layout changed-field history keys;
- enforce slot/layout field locks;
- parse inline directives inside `main`;
- validate slot/layout shape on write.

Supported v1 behavior:

- `content.main.source` replaces the legacy `Post.body` Markdown source.
- Rich descriptions use the same `main.source` convention.
- If a full-content update changes `main`, history emits `post.content.main` and stores the full submitted `ContentDoc` snapshot.
- If a full-content update changes only non-main JSON parts, those parts are persisted, but no content history/authority/search behavior is produced by this change.

Rationale:

- The storage and contract cut-over can proceed without over-designing slot update/history semantics.
- Future rendering/editing work can support slots/layout without another database migration.
- Existing body-like behavior remains easy to reason about: the platform only treats `main` as content today.

### Decision: `extra` and `ContentDoc` have disjoint responsibilities

`Post.extra` and `UnitTranslation.extra` are non-rendered side channels for feature-specific metadata (cover URLs, excerpt source citations, pinboard keys, etc.). They SHALL NOT carry renderable content.

`ContentDoc` is the only home for renderable structured content (markdown text, slots, layout).

Rationale:

- Existing `extra` keys (`extra.coverUrl`, `extra.source`, realm pinboard keys) keep working unchanged.
- Future contributors have a clear rule: "is it rendered?" → ContentDoc; "is it metadata for a feature?" → extra.
- Prevents `extra` from drifting into a shadow content schema.

### Decision: Slot family with composable typed slots

`ContentDoc.slots` is an object keyed by stable slot ids. Every slot value carries a `type` discriminator. The v1 slot family is:

| Type | Purpose |
|------|---------|
| `unit-ref` | Single reference to a Unit (book, entity, chapter, ...) |
| `entity-list` | Ordered list of unit references with display intent |
| `infobox` | Structured key/value rows whose values may be content, refs, dates, or links |
| `unknown` | Forward-compatible preservation slot for any other `type` |

Composition primitives:

- `UnitRef = { unitId: string; unitType?: UnitType }` — the atomic cross-Unit reference used everywhere.
- `ContentBlock = { type: "markdown"; source: string }` — the atomic renderable text fragment; future block types extend this union.

Slot shape sketches:

```ts
type UnitRefSlot = {
  type: "unit-ref";
  ref: UnitRef;
  render?: { view?: "card" | "chip" | "hover-preview"; cardSize?: "compact" | "regular" | "rich" };
};

type EntityListSlot = {
  type: "entity-list";
  refs: UnitRef[];
  title?: ContentBlock;
  render?: {
    layout?: "horizontal" | "vertical" | "grid" | "table";
    cardSize?: "compact" | "regular" | "rich";
    groupBy?: "unitType" | "none";
  };
};

type InfoboxSlot = {
  type: "infobox";
  rows: Array<{
    label: ContentBlock;
    value:
      | ContentBlock
      | UnitRef
      | UnitRef[]
      | { type: "date"; iso: string }
      | { type: "link"; url: string; label?: string };
  }>;
};

type UnknownSlot = { type: string; [key: string]: unknown };
```

Rationale:

- `UnitRef` is the universal compose primitive; every "points to something" path goes through it. Renderer, search, and history all batch-hydrate by walking `UnitRef` shapes.
- `render` is intentionally separated from data. Display intent (horizontal vs vertical cards) is a hint; the data field (`refs`, `rows`) is the source of truth and is portable across renderers.
- `InfoboxSlot.rows[].value` is a tagged union, not a markdown string. Dates, links, and unit references are first-class so that search and hydration treat them correctly instead of relying on parsing markdown.
- `UnknownSlot` preserves any unrecognized slot type verbatim. Renderers may fall back to a placeholder for unknown types in a follow-up; this change requires only that the slot value survive a read/write round-trip.

### Decision: Inline directive grammar inside `main` markdown

Slots may be embedded inline in `content.main.source` using CommonMark directive syntax:

```
::: slot { id="character-list" }
:::

inline mention :slot[author]{ view=chip }
```

The parser is implemented in the follow-up rendering change. The grammar is fixed by this change:

- Block-level directive: `:::slot { id="<slotId>" [render attrs...] }` ... `:::`.
- Inline directive: `:slot[<slotId>]{ [render attrs...] }`.
- Attributes inside the directive MAY override the slot's stored `render` intent (e.g. `display=horizontal`).
- The slot's data (`ref` / `refs` / `rows`) is always read from `content.slots[slotId]`, never from directive body content.

### Decision: Inline directive and `layout` are mutually exclusive per slot

Each `slotId` defined in `content.slots` MUST appear in exactly one of:

1. An inline directive inside `content.main.source`.
2. A `layout` entry.
3. Neither (stored but not currently rendered — reserved for forward compatibility).

A slot SHALL NOT appear in both an inline directive and a `layout` entry within the same document. This keeps placement unambiguous and avoids double rendering.

### Decision: `layout` is semantic, not pixel-level styling

`ContentDoc.layout` is an array of `{ region: "main" | "aside" | "after-main" | "before-main"; slotId: string }` entries. It SHALL NOT persist arbitrary CSS, pixel coordinates, breakpoints, or renderer-specific styling.

### Decision: References are scanned declaratively, not declared as a manifest

The contract exposes a single function:

```ts
function scanRefs(doc: ContentDoc): UnitRef[];
```

`scanRefs` walks the entire document (slots, infobox rows, future block types) and returns a deduplicated list of all `UnitRef`-shaped values. It is a contract helper for future structured-content support. This change SHALL NOT wire `scanRefs` into runtime rendering, Meilisearch sync, history, or API hydration because runtime v1 only supports `main` Markdown.

Rationale:

- A top-level `refs: UnitRef[]` manifest would have to be maintained on every edit and would drift from reality the first time a slot was updated outside the manifest writer's awareness.
- The scanner is the single source of truth and the single place to add new ref-bearing shapes when the slot family grows.
- Performance: walking a single small document on render is negligible compared to the hydration RTT it enables.

### Decision: Text extraction for search is centralized

The contract exposes:

```ts
function extractText(doc: ContentDoc): string;
```

`extractText` walks `main` (markdown source as-is), every slot type's text-bearing fields (infobox labels and content values, entity-list titles, etc.), and concatenates them into a single search string. Every slot type added in the future MUST register a text-extraction contribution.

The contract exposes `extractText` for the full document shape, but Meilisearch sync in this change derives `contentText` and `descriptionText` only from the supported `main` Markdown source. PostgreSQL never stores these projections.

### Decision: Lock and history semantics are delegated to `replace-field-key-with-patch-paths`

This change does not define lock keys, history payload shape, `changedFieldKeys`, or revision slot vocabulary for `Post.content` or rich descriptions. Those concerns are owned by the dependency change `replace-field-key-with-patch-paths`, which lands first and migrates the editorial regime to free-form PATCH paths with bidirectional prefix matching.

After both changes land, `Post.content` is reached by ordinary editorial PATCH paths:

- `post.content` — the whole `ContentDoc`
- `post.content.main` — the main content block
- `post.content.main.source` — the main markdown source
- `post.content.slots.<slotId>` — a specific slot (whenever the rendering follow-up activates slot editing)
- `post.content.layout` — the layout list

Lock targets on these paths use the bidirectional prefix matching defined in `editorial-patch-protocol`; history payloads contain whatever sparse PATCH sub-tree was submitted. No content-specific lock or history semantics are added in this change. Rich description PATCH paths follow the same model (`unitTranslation.description.main.source`, etc.).

Rationale:

- The contract-reserved field-key approach that earlier drafts of this change considered (`post.content.slots.<slotId>`, `post.content.layout` as reserved enum values) was a compatibility hack against a closed enum; with the enum removed, the reservation is unnecessary.
- Restore semantics are inherited from the editorial PATCH protocol: restoring a revision re-submits its stored PATCH sub-tree.
- No editorial regime work specific to `ContentDoc` remains.

### Decision: Infobox stays inside `ContentDoc`, no separate column

Earlier in design discussion a denormalized `Post.infobox` column was considered to avoid TOAST cost on wiki-card lists. It is rejected because:

- Books — the dominant Post target — typically have no wiki infobox; card-level book facts come from the Unit / Translation schema, not from the wiki post.
- The narrow case (entity / game / media wikis whose card lists show infobox summary) is small, and those wiki bodies are usually below the TOAST threshold.
- A separate column duplicates state, requires write-side sync, and complicates history payload assembly. The cost is permanent; the benefit is conditional.

If a future workload demonstrably needs cheap infobox-only fetches across many large wiki rows, a follow-up change may introduce a projection column or a functional index without changing this canonical schema.

## Risks / Trade-offs

- [Risk] Large JSON updates rewrite the full `content` value. -> Mitigation: runtime v1 only depends on `main`, and wiki edits are low frequency in this development-stage cut-over. Slot-level patch/update semantics are deferred until slot UI and history semantics are designed.
- [Risk] Renderers encounter unsupported versions or malformed values. -> Mitigation: read-trust model with Markdown fallback (Decision: Renderer trust model).
- [Risk] Slot references are stored but not hydrated. -> Mitigation: runtime v1 does not render slots; follow-up rendering work wires `scanRefs` into batch hydration.
- [Risk] Search text extraction misses slot content. -> Mitigation: intentional v1 boundary. Only `main` is searchable until slot rendering/search support is designed.
- [Risk] Content JSON becomes accidental product metadata. -> Mitigation: specs state PostgreSQL product filtering MUST use typed columns/relations; Meilisearch projection MAY include descriptive content for full-text search only; `extra` is the side channel for non-rendered feature metadata.
- [Risk] Removing `body` and changing description columns breaks broad callsites. -> Mitigation: this is a development-stage clear cut-over; contract, server mappers, app components, tests, sync code, and seed factories update in the same change. Spec deltas for `wiki-post-editing`, `post-presentation-architecture`, `work-discussion`, and `type-extension-post` are included so no existing requirement contradicts the new shape. Editorial PATCH/lock/history semantics for `post.content` come from the dependency change `replace-field-key-with-patch-paths`, not from this change.
- [Risk] Opaque writes can persist malformed or unsupported non-main content. -> Mitigation: runtime ignores non-main content in this change; renderers and search stay main-only and tolerant.

## Migration Plan

1. Add `ContentDoc`, slot family types, `scanRefs`, and `extractText` to `package/contract`.
2. Add canonical content / description JSON columns: change `Post.body` → `Post.content Json?`, `UnitTranslation.description String?` → `Json?`, `User.description String?` → `Json?`.
3. Write a development migration that wraps existing string values as `ContentDoc.main = { type: "markdown", source: <old string> }`; empty strings become `null` JSON.
4. Remove `Post.body` and string `description` columns from Prisma after migration data is copied.
5. Update contract DTOs, server mappers, post / chapter / wiki / description APIs, app forms and renderers, and seed factories in the same cut-over. Create/update APIs persist full JSON while runtime services only interpret `main`.
6. Update Meilisearch sync to derive `contentText` and `descriptionText` from supported `main` Markdown content only.
7. Confirm `replace-field-key-with-patch-paths` is archived; rely on its editorial PATCH protocol for `post.content` lock and history. No additional history outbox or authority field-key work is performed in this change.
8. Run Prisma generation, affected package tests, convention checks, and full reindex smoke tests.

Rollback strategy:

- Before any durable environment data exists: reverse migration unwraps `content.main.source` back into `body` and `description` strings; any non-Markdown main type or any populated `slots` / `layout` is dropped (lossy, accepted because rollback only applies before structured content is written).
- After any durable environment adopts the schema: rollback preserves `content` and `description` JSON and only reintroduces compatibility reads if necessary.

## Open Questions

- How slot/layout update, history, authority, search, and rendering should behave is deferred to the follow-up structured rendering/editing change.
