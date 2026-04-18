## Why

Content across the platform (user descriptions, comments/posts) is stored and rendered as plain text, limiting expressiveness. Meanwhile, the markdown rendering infrastructure (`markdown-it`, `github-markdown-css`, `RezicsMarkdownEditor`) already exists and is used for chapters, reviews, and quotes — but not universally. Additionally, lightweight user contexts (cards, mentions, search results) fetch the full `UserDTO` when only a handful of fields are needed, wasting bandwidth and query time.

## What Changes

- **Rename `createNovelRenderer` → `createRezicsRenderer`**: Align the renderer name with the platform identity. All content uses the same rendering strategy — the name should reflect that.
- **User description as markdown**: The `User.description` field becomes markdown content. The settings page swaps its plain `TextField` for `RezicsMarkdownEditor`. The profile Overview tab renders it in a GitHub-style bordered box labeled `DESCRIPTION.md`, positioned above the pinned section.
- **Comments/posts as markdown**: `Post.body` is rendered via `createRezicsRenderer` instead of `whitespace-pre-wrap`. The `InlinePostForm` input swaps from `TextField` to `RezicsMarkdownEditor`.
- **User brief API**: A lightweight endpoint returning only `{ name, slug, bio, avatar }` for card/mention contexts. Supports single fetch by `unitId` (GET) and batch fetch (POST).

## Capabilities

### New Capabilities

- `rezics-renderer`: Rename `createNovelRenderer` to `createRezicsRenderer` as the universal markdown rendering function, update all call sites
- `markdown-user-description`: User description field becomes markdown — editor in settings, GitHub-style `DESCRIPTION.md` rendering on profile Overview tab
- `markdown-post-content`: Post/comment body rendered and edited as markdown using the shared editor and renderer
- `user-brief-api`: Lightweight user endpoint (GET single by unitId, POST batch) returning only name, slug, bio, avatar

### Modified Capabilities

- `settings-profile`: Settings profile section replaces description TextField with RezicsMarkdownEditor
- `profile-overview`: Profile Overview tab adds DESCRIPTION.md rendered box above pinned content

## Impact

- **Affected packages**: `@rezics/editor`, `@rezics/ui`, `@rezics/app`, `@rezics/server`, `@rezics/contract`
- **API additions**: New `/user/brief/:unitId` (GET) and `/user/brief` (POST) endpoints in `@rezics/server`
- **Contract additions**: `UserBrief` schema in `@rezics/contract`
- **No breaking changes**: Existing `UserDTO` and endpoints remain unchanged. The renderer rename is internal — no public API changes.
- **No migration needed**: `User.description` and `Post.body` are already `String?` fields; no schema changes required. Existing plain text content renders correctly through markdown-it (treated as paragraphs).
- **Backward compatibility**: Plain text previously stored in description/post body fields will render identically through the markdown renderer (plain text is valid markdown).
