## 1. Editor Entry Policy

- [x] 1.1 Add an editor-entry decision model in `package/api/src/hooks` or a feature-appropriate app helper, separate from existing `useCanEdit`.
- [x] 1.2 Implement collaborative entry rules for Book, future work surfaces, and Wiki Post: authenticated non-blocked viewers can enter when at least one editor capability is available.
- [x] 1.3 Keep ordinary Review, Remark, Excerpt, and reply Post entry owner/admin controlled.
- [x] 1.4 Add focused tests for anonymous, blocked, owner, admin/root, ordinary non-owner, and collaborative-entry cases.
- [x] 1.5 Audit existing focal edit entry call sites and replace editor-entry affordance checks that incorrectly use field-update permission.

## 2. Editor Route Family

- [x] 2.1 Create a pathless `_editor` route family under `package/app/src/routes` that renders editor routes outside `_mainLayout`.
- [x] 2.2 Migrate Book edit routes from the existing non-nested route branch into the editor route family while preserving `/book/$bookId/edit` child URLs.
- [x] 2.3 Migrate Shelf, Review, Remark, Excerpt, and Entity edit routes into the editor route family while preserving public URLs.
- [x] 2.4 Add route-generation/type verification after each route group migration and update typed route imports/call sites.
- [x] 2.5 Confirm main browsing layout chrome no longer wraps migrated editor pages.

## 3. Edit Console Layout Adoption

- [x] 3.1 Add reusable minimal edit-console configuration helpers for one-page editors with localized return actions.
- [x] 3.2 Keep Book-specific navigation in a Book-owned config and avoid hardcoded surface type checks inside `EditConsoleLayout`.
- [x] 3.3 Wire minimal console configs for Shelf, Review, Remark, Excerpt, Entity, and focal Post editors.
- [x] 3.4 Ensure editor shells can render when some tabs or fields are unavailable because entry permission does not imply field edit permission.
- [x] 3.5 Add Storybook or focused component coverage for minimal and rich edit-console configurations.

## 4. Focal Edit Entries

- [x] 4.1 Replace focal text edit links with accessible icon edit actions on Book, Shelf, Review, Remark, Excerpt, Entity, and focal Post detail surfaces.
- [x] 4.2 Use editor-entry decisions for focal collaborative surfaces and owner/admin decisions for ordinary author-owned surfaces.
- [x] 4.3 Add focal Post editor routes for root post and continue-thread focal post URLs.
- [x] 4.4 Ensure each focal editor has a localized return action back to the correct read/detail surface.
- [x] 4.5 Verify `PostCard`, `PostReply`, `ReviewDetail`, `RemarkDetail`, and similar presentation components remain free of edit authorization and edit dialog ownership.

## 5. Post Tree Inline Edit

- [x] 5.1 Add section-owned edit overflow content to `PostTreeSection` / `PostTreeNode` for editable non-current tree replies.
- [x] 5.2 Reuse or adapt the existing `PostEditDialog` for inline tree-node editing without navigating to the editor layout.
- [x] 5.3 Ensure unauthorized tree rows do not render the edit overflow item.
- [x] 5.4 Ensure overflow edit actions stop row click propagation and remain keyboard accessible.
- [x] 5.5 Add focused tests or stories for owner-visible overflow edit, unauthorized hidden edit, and inline edit submit/cancel behavior.

## 6. Post Edited Marker

- [x] 6.1 Add a small timestamp comparison helper for Post metadata that handles string/date values and invalid dates safely.
- [x] 6.2 Render a localized edited marker when `createdAt` and `updatedAt` represent different instants.
- [x] 6.3 Add localized Traditional Chinese and English messages for the edited marker.
- [x] 6.4 Add focused tests or stories for edited and unedited post metadata.

## 7. Validation

- [x] 7.1 Run route generation/type checks for `@rezics/app` after route migration.
- [x] 7.2 Run focused unit tests for editor-entry policy and timestamp comparison helpers.
- [x] 7.3 Run focused component tests or Storybook smoke checks for edit console variants and post tree overflow behavior.
- [x] 7.4 Run `bun run check:convention` and relevant package checks after implementation.
- [ ] 7.5 Manually verify representative URLs after `bun run dev`: Book edit, Review edit, Entity edit, root Post edit, continue-thread focal edit, and tree reply inline edit.
