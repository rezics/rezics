## 1. Rename createNovelRenderer → createRezicsRenderer

- [ ] 1.1 Rename function definition in `package/editor/src/markdown/preview/preserveFormatting.ts` and update the type name `NovelRendererOptions` → `RezicsRendererOptions`
- [ ] 1.2 Update re-export in `package/editor/src/markdown/preview/index.ts`
- [ ] 1.3 Update re-export in `package/editor/src/markdown/index.ts`
- [ ] 1.4 Update call site in `package/editor/src/editor/MarkdownEditor.tsx`
- [ ] 1.5 Update call site in `package/ui/src/composite/content/MarkdownContent.tsx`
- [ ] 1.6 Update call site in `package/app/src/book-read/section/BookReadChapterSection.tsx`
- [ ] 1.7 Update call site in `package/folio/src/plugin/txt/TxtRenderer.tsx`
- [ ] 1.8 Verify no remaining references to `createNovelRenderer` or `NovelRendererOptions` via grep

## 2. User Brief API — Contract

- [ ] 2.1 Define `UserBrief` Typebox schema in `package/contract/src/user.ts` with fields: `unitId`, `name`, `slug`, `bio` (optional), `avatar` (optional)
- [ ] 2.2 Define request/response schemas for GET single and POST batch endpoints
- [ ] 2.3 Export `UserBrief` from `package/contract/src/index.ts`

## 3. User Brief API — Server

- [ ] 3.1 Create `user-brief.api.ts` in the user domain with `GET /user/brief/:unitId` route
- [ ] 3.2 Add `POST /user/brief` batch route accepting `{ unitIds: string[] }`
- [ ] 3.3 Implement service method using Prisma `select` (only `unitId`, `name`, `slug`, `bio`, `avatar`) for both single and batch queries
- [ ] 3.4 Mount the brief API in the server route tree

## 4. Settings Profile — Markdown Description Editor

- [ ] 4.1 Replace the description `TextField` in `package/app/src/user/section/SettingsProfileSection.tsx` with `RezicsMarkdownEditor`
- [ ] 4.2 Wire the editor value to the existing `updateMe` mutation for saving

## 5. Profile Overview — DESCRIPTION.md Box

- [ ] 5.1 Create a `DescriptionBox` component that renders a bordered container with "DESCRIPTION.md" label and `MarkdownContent` inside
- [ ] 5.2 Add `DescriptionBox` to the profile Overview tab's main column, above the Pinned section — only render when `user.description` is non-empty

## 6. Post/Comment Markdown

- [ ] 6.1 Replace `whitespace-pre-wrap` text rendering in `PostCard.tsx` with `MarkdownContent`
- [ ] 6.2 Replace `TextField` in `InlinePostForm.tsx` with `RezicsMarkdownEditor`

## 7. Validation

- [ ] 7.1 Run `tsc --noEmit` in `package/editor`, `package/ui`, `package/app`, `package/server`, `package/contract`, `package/folio` to verify no type errors
- [ ] 7.2 Grep for `createNovelRenderer` across the entire repo to confirm zero results
