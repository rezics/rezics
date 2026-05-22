## Why

Rezics currently stores primary post and chapter content as a plain string `Post.body` while richer wiki structure is forced into adjacent `Post.extra` JSON or frontend-only conventions. Long descriptions are also plain strings even though they can grow long and benefit from rich structure and references. As the wiki model grows toward typed slots, unit references, and structured infoboxes, the canonical content payload needs a typed JSON schema instead of a single Markdown body plus informal side channels.

This change introduces that schema and migrates storage, history, authority, and search projection to it. Renderer work (markdown directive parsing, slot component registry, hydration UI) is intentionally split into a follow-up change so this one stays schema-only.

## What Changes

- Introduce a shared `ContentDoc` contract for long-form editable content with a composable slot family (`unit-ref`, `entity-list`, `infobox`, plus forward-compatible unknown slots).
- **BREAKING** Replace `Post.body String?` with `Post.content Json?` storing a `ContentDoc`. Because the project is still in development, no long-lived backward-compatible `body` API is retained.
- **BREAKING** Change `UnitTranslation.description` and `User.description` from `String?` to `Json?` storing `ContentDoc`. Compact `UnitTranslation.summary` and `User.bio` remain plain strings.
- Define a single inline directive grammar so slots can be embedded at specific positions in the `main` markdown, and a `layout` array for slots placed outside the inline flow.
- Define a single declarative reference scanner (`scanRefs`) that walks any `ContentDoc` and returns deduplicated, type-grouped `UnitRef` lists; renderers, search, and history all use it.
- Define a single text extractor (`extractText`) for Meilisearch sync. Plain-text projections (`contentText`, `descriptionText`) are derived during sync and stored in Meilisearch documents only, never as PostgreSQL columns.
- Renderer trust model: read paths do not re-validate stored `ContentDoc`. Renderers that cannot interpret a document (unknown `schema`, unsupported `version`, malformed value, or a raw string accidentally stored) SHALL render it as Markdown rather than throw. Write paths remain the validation boundary.
- Reposition `Post.extra` explicitly as a non-rendered side-channel for feature metadata (e.g. `extra.coverUrl`, `extra.source`, pinboard keys). It SHALL NOT carry renderable content; that lives in `ContentDoc`.
- Reposition the wiki **infobox** as a first-class `Slot` inside `ContentDoc.slots.infobox`. It is not denormalized into a separate PostgreSQL column. Books typically have no wiki infobox because their card-level facts come from the Unit / Translation schema; only wikis that genuinely need an infobox carry one.
- Replace authority and history field keys based on `post.body` with content document sub-path keys (`post.content`, `post.content.main`, `post.content.slots.<slotId>`, `post.content.layout`).
- Update history outbox payloads so the `post` slot directly carries the full `ContentDoc`. The legacy body string SHALL NOT appear in any new revision payload.

## Capabilities

### New Capabilities

- `content-doc-schema`: Defines the canonical JSON schema for long-form content documents, including the slot family, inline directive grammar, layout, versioning, renderer trust model, reference scanning, and text extraction.

### Modified Capabilities

- `markdown-post-content`: Replaces `Post.body` Markdown source with `Post.content.main` Markdown source and updates post/chapter rendering and editing expectations.
- `markdown-user-description`: Broadens scope from user profile description to all rich descriptions (user profile + Unit translation) using `ContentDoc`. Compact bio and summary fields remain plain strings.
- `content-index`: Adds Meilisearch-only `contentText` and `descriptionText` projections derived from `ContentDoc`; PostgreSQL does not store these projections.
- `content-history-service`: Records `ContentDoc` snapshots in the `post` editorial revision slot, uses content sub-path field keys, and removes any dependency on the legacy `post.body` string.
- `content-authority`: Replaces `post.body` locking with content document sub-path field keys.
- `wiki-post-editing`: Edits, locks, and history payloads target `ContentDoc` sub-paths instead of `post.body`.
- `post-presentation-architecture`: The shared `PostBodyMarkdown` atom reads from `Post.content` instead of `post.body`. Wording is updated to remove `post.body` from requirements.
- `work-discussion`: Post-card body rendering reads from `Post.content`. Plaintext rendering remains disallowed.
- `type-extension-post`: Chapter `Post` carries `content: ContentDoc` instead of `body: string`. Chapter creation and listing semantics are otherwise unchanged.

## Out of Scope (Follow-up Change)

The following are intentionally deferred to a follow-up rendering change so this change can ship a stable schema and storage cut-over without coupling to UI work:

- Markdown directive parser implementation in the rendering pipeline.
- Slot renderer registry, hydration provider, and per-slot components (`EntityList`, `Infobox`, `UnitRefCard`, etc.).
- Unsupported-schema / unsupported-version fallback UI presentation polish.
- Slot-level editor surfaces (the v1 editor only writes `content.main.source`).
- Slot-level history compare/restore UI in `history-product-ui`.

This change defines the schema, scanning, extraction, and storage cut-over that those follow-ups depend on.

## Impact

- Affected packages: `package/contract`, `package/server`, `package/history`, `package/api`, `package/app`, and Meilisearch sync code under `package/server/src/meili`.
- API contracts change for post, chapter, wiki editing, and rich descriptions. `body` and `description` string write paths are removed.
- Existing development data is migrated by wrapping string bodies and descriptions as `ContentDoc.main = { type: "markdown", source: <old string> }`. Empty strings migrate to `null` JSON.
- Meilisearch documents gain derived `contentText` / `descriptionText` fields generated from `extractText(content)` during sync and full reindex. These fields are not persisted in PostgreSQL.
- History outbox writers stop emitting `post.body` field keys. New revisions carry `ContentDoc` payloads under the `post` slot and use content sub-path field keys.
- The change is intentionally breaking for internal callsites. All internal readers, mappers, editors, history payloads, seed factories, fixtures, and tests cut over in the same change.
