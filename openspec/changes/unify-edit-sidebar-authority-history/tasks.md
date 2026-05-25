## 1. Route And Navigation Structure

- [ ] 1.1 Audit current book edit and history routes under `package/app/src/routes/_mainLayout/book` and choose the canonical edit-console route names.
- [ ] 1.2 Add book edit sidebar navigation entries for authority and history in `package/app/src/book-edit/layouts/BookEditorNavigation.tsx`.
- [ ] 1.3 Add or update book edit route files for the standalone authority page.
- [ ] 1.4 Add or update book edit route files for the standalone history page.
- [ ] 1.5 Decide and implement compatibility behavior for existing `/book/:bookId/history` routes: redirect, alias, or retained public route.

## 2. Authority Page

- [ ] 2.1 Extract the existing lock management UI from `BookHistoryPage` into a reusable authority page component owned by the book edit feature or a shared Unit authority feature.
- [ ] 2.2 Replace the raw path-first lock selector with grouped field sections for translations, metadata, credits, and wiki/post content.
- [ ] 2.3 Add the top-level all-fields lock control backed by `UnitFieldLock("*")`.
- [ ] 2.4 When the all-fields lock is active, render child field controls as covered and disabled without creating child lock rows.
- [ ] 2.5 Preserve the existing custom path escape hatch for maintainers if needed, with clear path display and validation error handling.
- [ ] 2.6 Gate mutation controls by available authority where client context supports it, while preserving server-side rejection as authoritative.

## 3. History Page Migration

- [ ] 3.1 Move or wrap the existing book history timeline page so it renders under the book edit layout with the edit sidebar visible.
- [ ] 3.2 Update revision detail routes to preserve edit-console context or provide an explicit return path to edit history.
- [ ] 3.3 Update compare routes to preserve edit-console context or provide an explicit return path to edit history.
- [ ] 3.4 Verify restore entry points return actors to the normal book edit form and keep the edit sidebar context.
- [ ] 3.5 Remove duplicated authority lock controls from the history page after the standalone authority page owns them.

## 4. Lock Status In Edit Forms

- [ ] 4.1 Identify collaborative book edit fields that already receive locked-field errors.
- [ ] 4.2 Add lightweight locked-field affordances where lock state is available or returned by error payloads.
- [ ] 4.3 Ensure privileged actors can understand that locked fields remain editable for them but closed to ordinary community contributors.
- [ ] 4.4 Preserve unsaved form input when a locked-field save fails.

## 5. Localization And Accessibility

- [ ] 5.1 Add Traditional Chinese and English i18n messages for sidebar items, authority page headings, all-fields lock, covered child fields, and compatibility route copy.
- [ ] 5.2 Ensure sidebar links expose active state and keyboard focus semantics.
- [ ] 5.3 Ensure all icon-only authority/history controls have accessible labels.
- [ ] 5.4 Verify lock status is not communicated by color alone.

## 6. Tests And Validation

- [ ] 6.1 Add focused tests or stories for the authority page in no-lock, field-lock, and all-fields-lock states.
- [ ] 6.2 Add focused tests or stories for edit sidebar authority/history navigation.
- [ ] 6.3 Add route-level tests or manual verification notes for legacy history route compatibility.
- [ ] 6.4 Run targeted app tests for changed book edit/history components.
- [ ] 6.5 Run `bun run format:check`.
- [ ] 6.6 Run `bun run check:convention`.
- [ ] 6.7 Run `openspec validate unify-edit-sidebar-authority-history --strict`.
