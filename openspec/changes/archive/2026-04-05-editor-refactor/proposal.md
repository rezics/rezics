## Why

The editor system is split across two implementations: the legacy EasyMDE-based editors in `@rezics/ui` (`package/ui/src/editor/`) and the new CodeMirror 6-based `@rezics/editor` package. The new package already has full feature parity (markdown, JSON, mention, emoji, preview, toolbar) but consumers still import the old components. Meanwhile, there is no image upload capability — the markdown image command inserts a placeholder URL — and no consistent action panel pattern for submit/cancel across editor consumers.

This change completes the migration to `@rezics/editor`, introduces a panel system in `@rezics/ui` for editor actions (submit, image upload), and adds image upload to Cloudflare R2 with client-side compression.

## What Changes

- **Remove legacy editors from `@rezics/ui`**: Delete `package/ui/src/editor/easyeditor/`, `jsoneditor/`, `nanojson/`, and `component/EditorMention.tsx` / `EmojiMart.tsx`. These are fully superseded by `@rezics/editor`.
- **Add `insertImageUrl` command to `@rezics/editor`**: A new exported command that accepts a URL string and inserts `![alt](url)` at the cursor. Unlike the existing `insertImage` (which inserts a placeholder), this is callable from external code with a concrete URL.
- **New panel system in `@rezics/ui`**: A composable `EditorPanel` component that sits below the editor. Left side holds action buttons (e.g. image upload trigger), right side holds primary actions (submit, cancel, or format+submit for JSON).
- **New image upload modal in `@rezics/ui`**: A tabbed modal with image providers — Rezics Upload (R2), and guided flows for ImgBB, Postimages, and Imgbox. Each provider tab produces a URL that gets inserted into the editor.
- **New upload endpoint in `@rezics/server`**: `POST /api/upload/image` — accepts multipart image, stores in Cloudflare R2, returns the public URL. Auth-gated via JWT. 5MB limit.
- **Client-side image compression**: Using `browser-image-compression` before upload to R2.
- **Migrate all consumers**: Update `ChapterPage`, `BookEditInfoSection`, `ReplyDrawer`, `QuoteEditPage`, `ReviewEditPage`, `BookExtraEditor`, `ChapterTreeJsonEditor`, and `EchokvEdit` to use `@rezics/editor` components + `EditorPanel`.

## Capabilities

### New Capabilities
- `editor-image-insert`: Editor plugin command for inserting an image URL at cursor position in CodeMirror
- `image-upload-modal`: Tabbed image modal with R2 upload provider and third-party guided flow providers (ImgBB, Postimages, Imgbox)
- `image-upload-api`: Server-side image upload endpoint storing to Cloudflare R2 with JWT auth and 5MB limit
- `editor-panel`: Composable action panel component for editor controls (submit, cancel, image button, format button)

### Modified Capabilities
- `composed-editors`: Consumers migrate from legacy `@rezics/ui` editors to `@rezics/editor` composed editors. No spec-level behavior change — same editor capabilities, different implementation.

## Impact

**Affected packages:**
- `package/ui` — Remove legacy editor code, add panel system + image modal
- `package/editor` — Add `insertImageUrl` command export
- `package/server` — New upload domain (api, service)
- `package/app` — Migrate 5 consumer pages/sections to new editors + panel
- `package/admin` — Migrate EchokvEdit to React-based JsonEditor + panel
- `package/api` — New upload mutation hook (if using TanStack Query pattern)
- `package/contract` — New upload endpoint contract types

**New dependencies:**
- `browser-image-compression` (client, `@rezics/ui`)
- `@aws-sdk/client-s3` (server, `@rezics/server`)

**Backward compatibility:**
- **BREAKING** for internal consumers: `@rezics/ui` editor exports are removed. All consumers must migrate to `@rezics/editor` + `EditorPanel`. Since this is an internal monorepo, migration is done atomically in this change.
- No external API breaking changes.
