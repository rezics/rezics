## Why

Rezics currently stores primary post and chapter content as plain string fields while richer wiki structure is forced into adjacent JSON `extra` fields or frontend-only conventions. As the wiki model grows toward slots, unit references, and structured descriptions, the canonical content payload needs a typed JSON schema instead of a single Markdown body plus informal side channels.

## What Changes

- Introduce a shared `ContentDoc` contract for long-form editable content.
- **BREAKING** Replace `Post.body` as the canonical post/chapter/wiki body with `Post.content` JSON using the `ContentDoc` schema. Because the project is still in development, no long-lived backward-compatible `body` API is required.
- Allow long descriptions to use the same `ContentDoc` schema where rich structure is needed, while short summaries remain plain strings.
- Define slot and layout semantics for cross-unit wiki composition. Content documents store unit references and rendering intent; referenced Unit DTOs are hydrated through existing batch/list APIs rather than embedded as denormalized snapshots.
- Keep plain-text projections such as `contentText` and `descriptionText` out of PostgreSQL. They are derived during Meilisearch sync and stored as search document fields only.
- Update content history and authority semantics so content edits are tracked and locked at content-document fields or slot-level field keys, not at the removed `post.body` field.

## Capabilities

### New Capabilities

- `content-doc-schema`: Defines the canonical JSON schema for long-form content documents, including Markdown main content, slots, layout, unit references, versioning, validation, and projection boundaries.

### Modified Capabilities

- `markdown-post-content`: Replaces `Post.body` Markdown source with `Post.content.main` Markdown source and updates post/chapter rendering and editing expectations.
- `markdown-user-description`: Allows rich descriptions to use `ContentDoc` while keeping short bio/summary fields plain text.
- `content-index`: Adds Meilisearch-only `contentText` and `descriptionText` projections derived from `ContentDoc`; PostgreSQL does not store these projections.
- `content-history-service`: Records `ContentDoc` snapshots in editorial revision slots and compares/restores them as structured content payloads.
- `content-authority`: Replaces `post.body` locking with content document and slot-oriented field keys.

## Impact

- Affected packages: `package/contract`, `package/server`, `package/history`, `package/api`, `package/app`, and Meilisearch sync code under `package/server/src/meili`.
- API contracts change for post, chapter, wiki editing, and rich descriptions. `body` and `description` string write paths are removed or narrowed according to the new schema.
- Existing development data must be migrated by wrapping string bodies as `ContentDoc.main = { type: "markdown", source: <old body> }`.
- Meilisearch documents gain derived `contentText` / `descriptionText` fields generated from content documents during sync and full reindex. These fields are not persisted in PostgreSQL.
- The change is intentionally breaking for internal callsites. All internal readers, mappers, editors, history payloads, and tests should cut over in the same implementation change.
