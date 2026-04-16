## Context

The platform already has a full markdown pipeline: `markdown-it` renders content, `github-markdown-css` styles it, and `RezicsMarkdownEditor` (wrapping the Novel/Tiptap editor) provides rich editing. This pipeline is used for chapters, reviews, and quotes — but user descriptions and post/comment bodies are still plain text.

Current state:
- `createNovelRenderer()` in `@rezics/editor/markdown` — the single rendering function, misnamed after the upstream library
- `MarkdownContent` in `@rezics/ui` — wrapper component, calls `createNovelRenderer()`
- `RezicsMarkdownEditor` in `@rezics/ui` — rich editor with image upload, emoji, mentions
- `User.description` — `String?` in Prisma, edited via plain TextField, not rendered on profile
- `Post.body` — `String?`, rendered as `whitespace-pre-wrap`, entered via plain TextField
- `UserDTO` — full user object fetched even for card/mention contexts

## Goals / Non-Goals

**Goals:**
- Unify all content rendering under a single, correctly-named renderer (`createRezicsRenderer`)
- Enable markdown editing and rendering for user descriptions and post/comment content
- Render user description on the profile Overview tab in a GitHub README-style box
- Provide a lightweight user brief endpoint for card/mention contexts

**Non-Goals:**
- Changing the `bio` field — it remains plain text (one-liner tagline for compact contexts)
- Adding new markdown features (custom syntax, plugins) — use the existing `markdown-it` configuration as-is
- Real-time collaborative editing
- Sanitization changes — the existing renderer configuration (`html: false` by default) is sufficient
- Full user search/discovery — the brief API is for known-unitId lookups only

## Decisions

### 1. Rename `createNovelRenderer` → `createRezicsRenderer`

Straightforward find-and-replace across 4 call sites + the definition. No re-export alias — the old name is internal only (not in any public contract), so a clean rename is sufficient.

**Files affected:**
- `package/editor/src/markdown/preview/preserveFormatting.ts` (definition)
- `package/editor/src/markdown/preview/index.ts` (re-export)
- `package/editor/src/editor/MarkdownEditor.tsx` (call site)
- `package/ui/src/composite/content/MarkdownContent.tsx` (call site)
- `package/app/src/book-read/section/BookReadChapterSection.tsx` (call site)
- `package/folio/src/plugin/txt/TxtRenderer.tsx` (call site)

### 2. `MarkdownContent` as the universal rendering component

`MarkdownContent` in `@rezics/ui` already wraps `createRezicsRenderer`. All markdown rendering in the app should go through this component rather than calling the renderer directly. This gives a single point to add `github-markdown-css` class wrapping, sanitization, or other rendering concerns.

The component should accept an optional `className` prop for styling contexts (e.g., the DESCRIPTION.md box may need padding/sizing different from inline post content).

### 3. Profile DESCRIPTION.md box

Rendered in the Overview tab's main column, above the Pinned section. Uses a bordered container with a top-left label chip showing "DESCRIPTION.md" — matching GitHub's profile README pattern.

```
┌─ Overview main column ─────────────────────────────────┐
│                                                         │
│  ┌─ DESCRIPTION.md ─────────────────────────────────┐  │
│  │                                                   │  │
│  │  <MarkdownContent content={user.description} />   │  │
│  │                                                   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ Pinned ─────────────────────────────────────────┐  │
│  │  ...                                              │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ Recent Activity ────────────────────────────────┐  │
│  │  ...                                              │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

If the user has no description, the box is not rendered (no empty state).

### 4. Post/comment markdown rendering

Replace `whitespace-pre-wrap` rendering in `PostCard` with `<MarkdownContent />`. Replace `TextField` in `InlinePostForm` with `RezicsMarkdownEditor` (compact configuration — reduced height, no image upload unless needed).

**Alternative considered:** Keeping comments as plain text for simplicity. Rejected because the editor infrastructure already exists and comments benefit from formatting (code blocks, links, lists).

### 5. User brief API design

```
GET  /user/brief/:unitId       →  { name, slug, bio, avatar }
POST /user/brief               →  { users: [{ name, slug, bio, avatar }, ...] }
     body: { unitIds: string[] }
```

- GET for single lookups (hover cards, single mentions)
- POST for batch (comment threads, search results with multiple authors)
- Returns only the 4 fields needed for card/mention rendering — no description, no counts, no settings
- `UserBrief` schema defined in `@rezics/contract`

**Alternative considered:** GraphQL-style field selection on existing endpoints. Rejected — adds complexity for a simple, well-defined use case. A dedicated lightweight endpoint is cleaner.

### 6. Settings page description editor

Replace the 4-row plain TextField with `RezicsMarkdownEditor`. The editor should use the standard resize config and support the same features available in other editing contexts (formatting, links, code blocks). No image upload for descriptions initially — keep it text-focused.

## Risks / Trade-offs

**[Existing plain text content]** → No risk. Plain text is valid markdown and renders identically through `markdown-it` (as a paragraph). No migration needed.

**[Post body storage]** → Post bodies are stored as markdown source text, not as editor JSON. This is consistent with how `description` and chapter content work. The `RezicsMarkdownEditor` outputs markdown strings.

**[Performance of markdown rendering in lists]** → Comment/post lists render many `MarkdownContent` components. `createRezicsRenderer()` creates a new `MarkdownIt` instance each call. Mitigation: the instance is lightweight and `markdown-it` is fast. If profiling shows issues, memoize the instance at module level (it's stateless).

**[Brief API cache]** → The brief endpoint returns rarely-changing data (name, slug, bio, avatar). Good candidate for HTTP caching headers or frontend query stale time. Not in scope for initial implementation but worth noting.
