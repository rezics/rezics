# Content Contracts

`content/` owns Rezics contracts for content representation and editorial
metadata. These contracts are shared by Units, posts, books, realms, shelves,
search documents, and history consumers, so they intentionally do not belong to
one concrete feature.

## Boundaries

- `doc-v1.ts` and `doc-v2.ts` define rich content document shapes.
- `authority.ts` defines collaborative content authority, locks, and creation
  mode vocabulary.
- `history.ts` defines editorial revision, structure event, and history display
  payloads.
- `structure.ts` defines generic content tree contracts for Units with nested
  content parts.

Do not move concrete feature DTOs here just because they contain user-visible
content. `post/`, `book/`, `unit/`, `realm/`, and `shelf/` should keep owning
their own resource contracts and import content vocabulary from this folder.
