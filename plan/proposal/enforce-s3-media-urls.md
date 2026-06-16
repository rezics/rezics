---
title: Enforce S3-only media URLs
status: done
created: 2025-06-14
completed: 2026-06-14
supersededBy:
tags: [contract, server, app, upload, media]
---

## Why

All media URL fields (avatar, coverUrl, imageUrl, logoUrl, bannerUrl,
backgroundUrl) currently accept arbitrary string URLs — any external URL can be
stored in the database. This creates data integrity issues (broken external
links, abuse via arbitrary URLs) and bypasses the existing S3 upload pipeline.
The S3 upload infrastructure already exists end-to-end (presigned URLs, direct
browser upload, Garage dev env); this change enforces it as the only path for
media, and replaces all text `<Input>` fields for media URLs with file upload
interactions.

## Durable constraints & decisions

- `(type)` `mediaUrlSchema` in `@rezics/contract` is structurally `t.String()`
  with a metadata marker (`x-rezics-media: true`). The contract cannot access
  runtime env vars, so it carries semantic intent only — the actual prefix check
  is server-side.
- `(test)` Server rejects any media URL whose origin does not match
  `MEDIA_PUBLIC_BASE_URL`. Inputs that are `null` (clearing the field) pass
  through unchecked.
- `(comment)` Response DTOs keep plain `t.String()` / `t.Optional(t.String())`
  — validation applies only on the write path (input schemas). Existing stored
  URLs from before this change remain readable.
- `(type)` Zone theme `httpsUrlSchema` replaced with `mediaUrlSchema` — zone
  theme images are no longer exempt.
- `(type)` Realm `realmImageExtraSchema.url` uses `mediaUrlSchema`.
- `(comment)` `isStorageConfigured() === false` → media URL fields in input
  schemas still accept the type, but the server returns 503 on presign. This is
  an operational concern (deploy must configure S3), not a validation bypass.
- `(test)` When `MEDIA_PUBLIC_BASE_URL` is unset, the server-side media URL
  validator skips prefix checking (dev/test convenience). The presign endpoint
  already returns 503 in this case, so no upload can happen anyway.
- `(type)` `ImageUploadField` component in `package/app/src/shared/ui/` — a
  reusable form field that wraps `useImageUpload()`, shows a thumbnail preview,
  and returns the S3 URL on success. Replaces all text `<Input>` fields for
  media URLs in the app.

## Tasks

### 1. Contract — `mediaUrlSchema`

- [x] 1.1 Create `mediaUrlSchema` in `package/contract/src/media-url.ts`:
  `t.String()` with metadata `{ "x-rezics-media": true }` to mark write-path
  media fields. Export alongside a `isMediaUrlField(schema)` type guard for
  server-side introspection.
- [x] 1.2 Replace avatar fields in input schemas with `mediaUrlSchema`:
  `package/contract/src/user/user.ts` (`createUserSchema.avatar`,
  `updateUserSchema.avatar`), `package/contract/src/account/registration.ts`
  (`accountSetupBodySchema.avatar`).
- [x] 1.3 Replace avatar fields in `package/contract/src/entity/entity.ts`
  (`createEntitySchema.avatar`, `updateEntitySchema.avatar`).
- [x] 1.4 Replace coverUrl fields in `package/contract/src/book/book.ts`
  (create/update book input schemas only — not DTOs).
- [x] 1.5 Replace coverUrl fields in `package/contract/src/book/chapter.ts`
  (`createChapterSchema.coverUrl`, `updateChapterSchema.coverUrl`).
- [x] 1.6 Replace `imageUrl` in `package/contract/src/zone/zone.ts` (zone
  create/update input schemas).
- [x] 1.7 Replace `httpsUrlSchema` in `package/contract/src/zone/theme-v1.ts`
  (`logoUrl`, `bannerUrl`, `backgroundUrl`) with `mediaUrlSchema`.
- [x] 1.8 Replace `url` field in `package/contract/src/realm/realm-extra.ts`
  (`realmImageExtraSchema`) with `mediaUrlSchema`.
- [x] 1.9 Replace `coverUrl` fields in `package/contract/src/shelf/shelf.ts`
  (create/update input schemas).
- [x] 1.10 Replace `coverUrl` in `package/contract/src/unit/translation.ts`
  (`translationExtraSchema.coverUrl`).

### 2. Server — media URL validation

- [x] 2.1 Create `package/server/src/upload/media-url.guard.ts`: utility
  function `assertMediaUrl(url: string | null | undefined)` that throws if
  `url` is a non-null string whose origin doesn't match `MEDIA_PUBLIC_BASE_URL`.
  No-op when `MEDIA_PUBLIC_BASE_URL` is unset.
- [x] 2.2 Add validation calls in user endpoints:
  `package/server/src/token/token.user.api.ts` (avatar on account setup),
  user update handler.
- [x] 2.3 Add validation calls in entity endpoints:
  `package/server/src/entity/entity.api.ts` (create + update avatar).
- [x] 2.4 Add validation calls in book/chapter endpoints:
  `package/server/src/book/book.api.ts` (create/update coverUrl),
  `package/server/src/chapter/chapter.api.ts` (create/update coverUrl).
- [x] 2.5 Add validation calls in zone/realm endpoints where media URLs are
  written.
- [x] 2.6 Add tests for `assertMediaUrl` in
  `package/server/src/upload/media-url.guard.test.ts`.

### 3. App — `ImageUploadField` component

- [x] 3.1 Create `package/app/src/shared/ui/ImageUploadField.tsx`: reusable
  form field wrapping `useImageUpload()`. Props: `value` (current URL or null),
  `onChange` (new URL or null), `label`, `aspect` (optional aspect ratio hint
  for preview). Shows thumbnail when a URL is set, click/drop/paste to upload,
  clear button to null.
- [x] 3.2 Replace text `<Input>` with `ImageUploadField` in
  `package/app/src/user/sections/SettingsProfileSection.tsx` (user avatar).
- [x] 3.3 Replace text `<Input>` with `ImageUploadField` in
  `package/app/src/user/pages/UserEditPage.tsx` (admin user avatar edit).
- [x] 3.4 Replace text `<Input>` with `ImageUploadField` in
  `package/app/src/entity/pages/NewEntityPage.tsx` (entity creation avatar).
- [x] 3.5 Replace text `<Input>` with `ImageUploadField` in
  `package/app/src/entity/pages/EntityEditPage.tsx` (entity edit avatar).
- [x] 3.6 Replace text `<Input>` with `ImageUploadField` in
  `package/app/src/book-edit/components/Metadata/BookMetadataEditor.tsx` (book
  cover).
- [x] 3.7 Replace text `<Input>` with `ImageUploadField` in
  `RealmImagePicker` within
  `package/app/src/realm/sections/RealmManageEditors.tsx` (realm avatar/banner).
- [x] 3.8 Replace text `<Input>` with `ImageUploadField` in
  `EntityInlineCreateForm` within
  `package/app/src/entity-picker/components/EntityInlineCreateForm.tsx` if it
  has an avatar text input.

## Out of scope

- Image processing pipeline (thumbnails, format conversion, resizing) — a
  separate initiative.
- Migrating existing stored URLs that point to external domains — existing data
  remains readable; enforcement is write-path only.
- Making S3 configuration mandatory at startup — it stays optional; the presign
  endpoint returns 503 when unconfigured.
- Shared `@rezics/ui` upload component extraction — `ImageUploadField` lives in
  `package/app/src/shared/ui/` for now; if other apps need it, extract later.
