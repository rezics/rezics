## Context

The `@rezics/editor` package provides a complete CodeMirror 6 editor framework with a plugin architecture, React integration, and composed editors (MarkdownEditor, JsonEditor, CodeEditor). The legacy editors in `@rezics/ui` (EasyMDE-based EasyEditor, MUI-based JsonEditorLight, nanojson wrapper) are still imported by 8 consumer sites across `package/app` and `package/admin`.

The editor has no image upload capability. Consumers build ad-hoc submit bars alongside editors with inconsistent patterns.

## Goals / Non-Goals

**Goals:**
- Replace all legacy editor usage with `@rezics/editor` components
- Add an `insertImageUrl(view, url, alt?)` command that external code can call with a concrete URL
- Build a reusable `EditorPanel` in `@rezics/ui` that sits below editors for action buttons (image, submit, cancel, format)
- Build a tabbed image modal with a Rezics R2 upload tab and guided flow tabs for ImgBB, Postimages, Imgbox
- Add a server-side image upload endpoint with R2 storage
- Client-side image compression before upload

**Non-Goals:**
- Third-party image hosting API integration (guided flows only — no OAuth, no uploads via their APIs)
- Real-time collaboration
- Drag-and-drop image into editor content area (future enhancement)
- Server-side image processing or resizing

## Decisions

### 1. `insertImageUrl` as a standalone exported command

The existing `insertImage` command in `@rezics/editor` inserts `![alt](url)` with "url" as placeholder text selected for editing. A new `insertImageUrl(view: EditorView, url: string, alt?: string)` command will insert a concrete URL without placeholder selection. This is a simple function export, not a plugin — it's a CodeMirror dispatch call that any external code can invoke with a view reference.

**Alternative considered:** Making the image modal part of the editor plugin system (like emoji picker). Rejected because the modal is an app-level concern with server API calls and multiple providers — it doesn't belong in the editor core.

### 2. Panel system as a `@rezics/ui` layout component, not an editor feature

The `EditorPanel` component is a flex container with left/right slots, rendered below the editor by the consumer or a composed wrapper. It has no knowledge of CodeMirror — it receives callbacks and renders buttons.

```
<div>
  <MarkdownEditor ref={editorRef} ... />
  <EditorPanel
    left={<ImageUploadButton onClick={openModal} />}
    right={<><CancelButton /><SubmitButton /></>}
  />
</div>
```

Communication between panel and editor happens through a ref. `MarkdownEditor` already wraps content in `EditorContext.Provider` — the panel can access the view via `useEditorContext()` when placed inside the provider, or the composed wrapper can hold a ref and pass it down.

**Decision:** Use ref-based approach. The composed wrapper in `@rezics/ui` holds a ref to `EditorView` (obtained via a new `viewRef` prop on MarkdownEditor/JsonEditor) and passes `insertImageUrl` bound to that view as the modal's onInsert callback. This avoids requiring the panel to be a child of EditorContext.

### 3. Image provider model

Each tab in the image modal is an `ImageProvider`:

```typescript
interface ImageProvider {
  name: string;
  label: string;
  icon: ReactNode;
  render: (props: { onInsert: (url: string, alt?: string) => void }) => ReactNode;
}
```

- **Upload provider**: Drop zone + paste + file picker → compresses with `browser-image-compression` → POST multipart to server → calls `onInsert(returnedUrl)`
- **Guide providers**: Static instructions + external link + URL text input + Insert button. A shared `ExternalImageGuide` component parameterized by `{ name, url, steps[] }`.

Providers are passed as an array to the image modal. Default set: `[rezicsUpload, imgbbGuide, postimagesGuide, imgboxGuide]`.

### 4. Client-side compression with `browser-image-compression`

Using `browser-image-compression` (11KB gzipped). Runs in a Web Worker, handles EXIF rotation, supports `maxSizeMB` and `maxWidthOrHeight` configuration.

Default compression config: `maxSizeMB: 4.5` (leaving headroom under 5MB server limit), `maxWidthOrHeight: 4096`, `useWebWorker: true`.

**Alternative considered:** Native Canvas API (zero dependency). Rejected — no Web Worker support, no smart quality reduction loop, no EXIF handling.

### 5. Server upload endpoint

New domain `upload` in `@rezics/server` following existing patterns:

```
package/server/src/upload/
├── upload.api.ts      — POST /api/upload/image
├── upload.service.ts  — R2 client, validation, key generation
├── index.ts           — re-export uploadApi
```

- Accepts `multipart/form-data` with a single `image` field
- Validates: max 5MB, allowed MIME types (`image/jpeg`, `image/png`, `image/webp`, `image/gif`)
- Generates a unique key: `images/{year}/{month}/{ulid}.{ext}`
- Uploads to R2 via `@aws-sdk/client-s3` `PutObjectCommand`
- Returns `{ url: string }` — the public R2 URL
- Auth-gated: requires valid session JWT (same pattern as other server endpoints)

New env vars in `env.ts`:
- `R2_ENDPOINT` — S3-compatible endpoint URL
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_URL` — public base URL for serving uploaded images

### 6. Contract types

New types in `@rezics/contract`:

```typescript
// Upload request is multipart, no Typebox schema needed for the body
// Response schema:
const ImageUploadResponse = Type.Object({
  url: Type.String(),
});
```

New TanStack Query mutation hook in `@rezics/api`:

```typescript
export function useImageUpload() {
  return useMutation({
    mutationFn: (file: File) => uploadImage(file),
  });
}
```

### 7. JSON editor panel layout

JsonEditor's action panel places Format JSON button on the right alongside Submit — no left-side actions. The format shortcut (`Shift+Alt+F`) is a keybinding in the JSON editor plugin itself (already exists in `@rezics/editor`). The panel button is purely a visual affordance.

### 8. Consumer migration strategy

All 8 consumer sites are migrated atomically in this change. After migration, the legacy `package/ui/src/editor/` directory is deleted entirely. Since all consumers are internal monorepo code, no deprecation period is needed.

Composed wrappers in `@rezics/ui` provide the migration target:

```
@rezics/ui/editor
├── RezicsMarkdownEditor  — MarkdownEditor + EditorPanel (image + submit)
├── RezicsJsonEditor      — JsonEditor + EditorPanel (format + submit)
├── EditorPanel           — standalone for custom layouts
├── ImageModal            — standalone for custom usage
└── types
```

## Risks / Trade-offs

**[R2 dependency]** → The upload feature requires R2 configuration. If R2 env vars are missing, the upload provider tab should gracefully show a "not configured" state rather than crash. Guide tabs remain functional regardless.

**[Bundle size]** → `browser-image-compression` adds ~11KB gzipped. `@aws-sdk/client-s3` is server-only so it doesn't affect frontend bundle. Acceptable trade-off.

**[EasyMDE feature gap]** → EasyMDE had a built-in side-by-side preview. `@rezics/editor` MarkdownEditor already has dual-column mode, so no gap exists. Mention and emoji are also covered.

**[Admin panel migration]** → `EchokvEdit` uses raw nanojson class instantiation. Moving to React-based `JsonEditor` is a larger rewrite of that page. The admin uses React + MUI, so this is feasible but should be tested carefully.
