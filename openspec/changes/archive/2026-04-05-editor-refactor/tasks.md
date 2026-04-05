## 1. Editor Core: insertImageUrl Command

- [x] 1.1 Add `insertImageUrl(view: EditorView, url: string, alt?: string)` function in `package/editor/src/markdown/core/commands.ts` — inserts `![alt](url)` at cursor, defaults alt to "image"
- [x] 1.2 Export `insertImageUrl` from `package/editor/src/markdown/index.ts` and `package/editor/src/index.ts`
- [x] 1.3 Add unit test for `insertImageUrl` in `package/editor/src/markdown/core/commands.test.ts` — test with/without alt, with/without selection

## 2. Server: Image Upload Endpoint

- [x] 2.1 Add R2 env vars (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`) to `package/server/src/env.ts` as optional strings
- [x] 2.2 Create `package/server/src/upload/upload.service.ts` — S3Client init from env, `uploadImage(file, mimeType)` function with ULID key generation, 5MB/MIME validation
- [x] 2.3 Create `package/server/src/upload/upload.api.ts` — `POST /api/upload/image` Elysia route, multipart body parsing, auth guard, calls service, returns `{ url }`
- [x] 2.4 Create `package/server/src/upload/index.ts` — re-export `uploadApi`
- [x] 2.5 Mount `uploadApi` in `package/server/src/index.ts` via `.use()`
- [x] 2.6 Add `ImageUploadResponse` Typebox schema to `@rezics/contract`
- [x] 2.7 Add `useImageUpload` mutation hook to `@rezics/api`

## 3. UI: EditorPanel Component

- [x] 3.1 Create `package/ui/src/editor/panel/EditorPanel.tsx` — flex container with `left` and `right` ReactNode slots
- [x] 3.2 Export `EditorPanel` from `package/ui/src/editor/index.ts`

## 4. UI: Image Modal and Providers

- [x] 4.1 Create `package/ui/src/editor/image/types.ts` — `ImageProvider` interface
- [x] 4.2 Create `package/ui/src/editor/image/ExternalImageGuide.tsx` — reusable guide component with steps, external link, URL input, and Insert button with URL validation
- [x] 4.3 Create guide provider configs: `imgbb-guide.tsx`, `postimages-guide.tsx`, `imgbox-guide.tsx` using `ExternalImageGuide`
- [x] 4.4 Create `package/ui/src/editor/image/RezicsUploadProvider.tsx` — drop zone, paste, file picker, `browser-image-compression` integration, calls `useImageUpload` mutation, progress/error states
- [x] 4.5 Add `browser-image-compression` dependency to `package/ui/package.json`
- [x] 4.6 Create `package/ui/src/editor/image/ImageModal.tsx` — tabbed dialog rendering providers, default provider set, onInsert/onClose callbacks
- [x] 4.7 Export image modal and types from `package/ui/src/editor/index.ts`

## 5. UI: Composed Editor Wrappers

- [x] 5.1 Add `viewRef` prop support to `MarkdownEditor` and `JsonEditor` in `@rezics/editor` — expose `EditorView` via `React.Ref` or callback ref
- [x] 5.2 Create `package/ui/src/editor/RezicsMarkdownEditor.tsx` — composes MarkdownEditor + EditorPanel (image button left, submit/cancel right) + ImageModal, wires insertImageUrl via viewRef
- [x] 5.3 Create `package/ui/src/editor/RezicsJsonEditor.tsx` — composes JsonEditor + EditorPanel (format + submit right), wires format command via viewRef
- [x] 5.4 Export composed wrappers from `package/ui/src/editor/index.ts`

## 6. Consumer Migration

- [x] 6.1 Migrate `package/app/src/book-edit/page/ChapterPage.tsx` — replace EasyEditor with RezicsMarkdownEditor, wire onSubmit to existing save handler
- [x] 6.2 Migrate `package/app/src/book-edit/section/BookEditInfoSection.tsx` — replace EasyEditor with RezicsMarkdownEditor
- [x] 6.3 Migrate `package/app/src/comment/component/ReplyDrawer.tsx` — replace EasyEditor with RezicsMarkdownEditor, preserve mention extraction logic
- [x] 6.4 Migrate `package/app/src/quote/page/QuoteEditPage.tsx` — replace EasyEditor with RezicsMarkdownEditor
- [x] 6.5 Migrate `package/app/src/review/page/ReviewEditPage.tsx` — replace EasyEditor with RezicsMarkdownEditor
- [x] 6.6 Migrate `package/app/src/book-edit/component/Metadata/BookExtraEditor.tsx` — replace JsonEditorLight with RezicsJsonEditor
- [x] 6.7 Migrate `package/app/src/book-library/component/Chapter/ChapterTreeJsonEditor.tsx` — replace JsonEditorLight with RezicsJsonEditor
- [x] 6.8 Migrate `package/admin/src/misc/page/EchokvEdit.tsx` — replace nanojson JSONEditor class with RezicsJsonEditor

## 7. Cleanup and Verification

- [x] 7.1 Delete `package/ui/src/editor/easyeditor/` directory
- [x] 7.2 Delete `package/ui/src/editor/jsoneditor/` directory
- [x] 7.3 Delete `package/ui/src/editor/nanojson/` directory
- [x] 7.4 Delete `package/ui/src/editor/component/EditorMention.tsx` and `EmojiMart.tsx`
- [x] 7.5 Remove `easymde`, `@pardnchiu/nanojson`, `emoji-picker-react` dependencies from `package/ui/package.json` if no longer used elsewhere
- [x] 7.6 Verify build: run `bun run build` or type-check across affected packages (`package/editor`, `package/ui`, `package/app`, `package/admin`, `package/server`, `package/contract`, `package/api`)
- [x] 7.7 Run existing tests in `package/editor` to confirm no regressions
