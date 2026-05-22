## 1. Language Registry and Runtime Locale Setup

- [x] 1.1 Update `package/contract/src/language.ts` so `LANGUAGES`, `Language`, `languageSchema`, `LANGUAGE_META`, and `normalizeLanguage()` include canonical `ko`.
- [x] 1.2 Keep `DEFAULT_LANGUAGE` as `zh-hant` and keep `FALLBACK_LANGUAGE` unchanged for content-data fallback consumers; do not use it to justify UI-copy fallback strings.
- [x] 1.3 Add or update contract tests covering `ko`, rejecting `ko-KR`, rejecting `kr`, and preserving case-insensitive canonical normalization.
- [x] 1.4 Search the repo for hard-coded five-locale assumptions in TypeScript, JSON, docs, and OpenSpec-adjacent implementation notes that affect runtime behavior; update implementation sources to the six-locale set.
- [x] 1.5 Verify `LANGUAGE_META` native label for Korean is `한국어` and language controls can display it without local hard-coded label lists.

## 2. Paraglide Project Configuration

- [x] 2.1 Update `package/i18n/project.inlang/settings.json` to include `ko` in the `locales` list.
- [x] 2.2 Update `package/ui/project.inlang/settings.json` to include `ko` in the `locales` list.
- [x] 2.3 Check for any generated Paraglide runtime assumptions about the locale union in `package/i18n/src/paraglide/` and `package/ui/src/paraglide/`; regenerate rather than editing generated files manually.
- [x] 2.4 Update package README or contributor guidance where it still says “five locales” for frontend UI messages.

## 3. Product I18n Catalog Completion

- [x] 3.1 Add `package/i18n/messages/ko.json`.
- [x] 3.2 Diff `package/i18n/messages/en.json` against `zh-hant.json`, `zh-hans.json`, `ja.json`, `de.json`, and `ko.json`; list every missing key per locale before editing.
- [x] 3.3 Fill missing product/domain message keys in `zh-hans.json`.
- [x] 3.4 Fill missing product/domain message keys in `ja.json`.
- [x] 3.5 Fill missing product/domain message keys in `de.json`.
- [x] 3.6 Fill product/domain message keys in `ko.json`.
- [ ] 3.7 Review `en.json` and `zh-hant.json` for values that are accidentally in the wrong language and correct them while preserving message parameters exactly.
- [x] 3.8 Verify every message parameter placeholder, plural/select branch, and punctuation-sensitive format is preserved across all six `@rezics/i18n` locale files.
- [x] 3.9 Keep message key naming consistent with existing domain prefixes; do not introduce duplicate keys for the same app/admin concept.

## 4. UI Package Catalog Completion

- [x] 4.1 Add `package/ui/messages/ko.json`.
- [x] 4.2 Diff `package/ui/messages/en.json` against `zh-hant.json`, `zh-hans.json`, `ja.json`, `de.json`, and `ko.json`; list every missing key per locale before editing.
- [x] 4.3 Fill missing UI component message keys for all six locale files.
- [x] 4.4 Confirm reusable `@rezics/ui` components import only their own generated UI messages for component-internal copy and do not import `@rezics/i18n`.
- [x] 4.5 Confirm `@rezics/i18n` does not import from `@rezics/ui`.

## 5. I18n Compile and Generated Output

- [x] 5.1 Run `bun --filter=@rezics/i18n run compile` after catalog changes.
- [x] 5.2 Run `bun --filter=@rezics/ui run compile` or the package's configured equivalent after UI catalog changes.
- [x] 5.3 Inspect generated type declarations to confirm `ko` is part of both Paraglide runtime locale unions.
- [x] 5.4 Confirm generated files are changed only by compile commands, not manual edits.

## 6. Convention and Catalog Integrity Checks

- [x] 6.1 Add or extend a repo convention check that compares `@rezics/contract` `LANGUAGES` with `package/i18n/project.inlang/settings.json` and `package/ui/project.inlang/settings.json`.
- [x] 6.2 Add or extend a check that verifies each supported locale file exists in `package/i18n/messages/` and `package/ui/messages/`.
- [x] 6.3 Add or extend a check that verifies exact message key parity across all supported `package/i18n/messages/*.json` files.
- [x] 6.4 Add or extend a check that verifies exact message key parity across all supported `package/ui/messages/*.json` files.
- [x] 6.5 Add or extend a check that rejects frontend UI-copy fallback arguments such as `t("key", "Text")`.
- [x] 6.6 Add or extend a check that rejects static UI nullish/string fallback patterns around translated values, such as `message() ?? "Text"` where the fallback is UI copy.
- [x] 6.7 Add or extend a check that rejects dynamic generated message lookup such as `m[key]()` and template-literal computed message keys.
- [x] 6.8 Add or extend a check that rejects `react-i18next` or `i18next` runtime usage for frontend UI copy under `package/{app,admin,ui,editor,folio}/src/`.
- [x] 6.9 Add or extend a check that rejects admin-local locale imports and `package/admin/src/locale` reintroduction.
- [ ] 6.10 Add tests or fixtures for the new convention checks covering pass and fail cases.

## 7. Admin Shared I18n Cutover

- [x] 7.1 Inventory all consumers of `package/admin/src/locale/*.ts`, admin-local locale helpers, and local locale data objects.
- [ ] 7.2 Create or reuse `@rezics/i18n/messages` keys for admin navigation labels in `package/admin/src/navigation/`.
- [ ] 7.3 Migrate `package/admin/src/core/layouts/` page/layout copy to generated messages.
- [ ] 7.4 Migrate `package/admin/src/home/` dashboard, stat card, and health strip copy to generated messages.
- [ ] 7.5 Migrate `package/admin/src/user/` login, create, edit, and list page copy to generated messages.
- [ ] 7.6 Migrate `package/admin/src/auth/` status, sessions, users, email, and JWT-service admin copy to generated messages.
- [ ] 7.7 Migrate `package/admin/src/token/` token page, tables, dialogs, secret display, scopes editor, and validation copy to generated messages.
- [ ] 7.8 Migrate `package/admin/src/unit/` list, create, edit, field-lock, collaborator, subject attribution, and Meili unit page copy to generated messages.
- [ ] 7.9 Migrate `package/admin/src/entity/` list and edit page copy to generated messages and reuse shared entity/subject/credit label helpers where applicable.
- [ ] 7.10 Migrate `package/admin/src/book/`, `package/admin/src/shelf/`, `package/admin/src/tag/`, `package/admin/src/realm/`, `package/admin/src/authority/`, `package/admin/src/meili/`, and `package/admin/src/setting/` copy to generated messages.
- [ ] 7.11 Migrate admin `placeholder`, `aria-label`, `title`, meaningful `alt`, tooltip, select item, tab, badge, table header, empty/loading/error state, alert, and dialog copy.
- [ ] 7.12 Replace admin static label arrays/objects with direct message functions or typed slug-to-function maps.
- [x] 7.13 Remove `package/admin/src/locale/*.ts` and any barrel/index files that exist only for local locale data.
- [ ] 7.14 Verify `rg "src/locale|@/locale|from .*locale|useTranslation|\\.t\\(" package/admin/src` returns no admin-local locale or legacy runtime UI-copy consumers.

## 8. App UI Copy Sweep

- [ ] 8.1 Run a broad hard-coded UI copy scan over `package/app/src` for JSX text nodes and `placeholder`, `aria-label`, `title`, meaningful `alt`, tooltip, select item, tab, badge, table header, empty/loading/error state, alert, toast, dialog, and validation copy.
- [ ] 8.2 Migrate app shell/core layout/header/footer/navigation/create-menu/account-menu/language-menu copy to generated messages.
- [ ] 8.3 Migrate `package/app/src/home/` remaining hard-coded homepage and section copy to generated messages.
- [ ] 8.4 Migrate `package/app/src/book-edit/` page, chapter editor, table-of-contents, metadata, extra, translation, rating, and dialog copy to generated messages.
- [ ] 8.5 Migrate `package/app/src/book-library/` detail, hero, chapter list, release selector, copyright, review preview, shelf preview, author info, history, and basic info copy to generated messages.
- [ ] 8.6 Migrate `package/app/src/book-read/` reader layout and chapter state copy to generated messages.
- [ ] 8.7 Migrate `package/app/src/search/` filters, chips, result lists, advanced search, federated search, rating labels, and primitive input copy to generated messages.
- [ ] 8.8 Migrate `package/app/src/review/`, `package/app/src/remark/`, `package/app/src/post/`, and `package/app/src/excerpt/` form, page, list, detail, and action copy to generated messages.
- [ ] 8.9 Migrate `package/app/src/shelf/` shelf list/detail/edit/new pages, shelf editor controls, move modal, discussion, and system shelf labels to generated messages.
- [ ] 8.10 Migrate `package/app/src/tag/`, `package/app/src/entity/`, `package/app/src/entity-picker/`, `package/app/src/realm/`, and `package/app/src/unit/` user-visible copy to generated messages and shared label helpers.
- [ ] 8.11 Migrate `package/app/src/user/`, settings, auth, registration, profile, reaction, hover preview, and preferences copy to generated messages where the string is static UI copy.
- [ ] 8.12 Migrate `package/app/src/inbox/`, `package/app/src/feedback/`, `package/app/src/pinboard/`, `package/app/src/progress-status/`, and `package/app/src/engagement/` copy to generated messages.
- [ ] 8.13 Review `package/app/src/playground/`, `package/app/src/stories/`, and `*.stories.tsx`; migrate stories that render reusable production UI copy and document/allowlist demo-only literals.
- [ ] 8.14 Verify remaining app hard-coded literals are intentional technical literals, brand names, URL examples, enum keys, debug identifiers, user/content data, or documented story/demo text.

## 9. Dynamic Labels and Shared Helpers

- [x] 9.1 Review existing `@rezics/i18n` label helpers for entity kind, license, credit role, and subject role; add Korean catalog entries and keep `satisfies Record<EnumKey, () => string>` coverage.
- [ ] 9.2 Move repeated app/admin dynamic domain labels into `@rezics/i18n/src/labels/` when they are shared across frontends.
- [ ] 9.3 Keep feature-local dynamic label maps near the feature only when they are not shared; type them with `satisfies Record<Slug, () => string>`.
- [x] 9.4 Search for `m[` and computed message access in app/admin/ui/editor/folio source; replace every UI-copy case with a direct function or typed map.
- [x] 9.5 Search for ad hoc language display maps outside `LANGUAGE_META`; replace them with contract metadata unless there is a documented non-language UI reason.

## 10. UI Fallback Removal

- [ ] 10.1 Search app/admin/ui/editor/folio frontend source for `fallback`, `fallbackLng`, `defaultValue`, `?? "`, `|| "`, and second-argument translation patterns; classify UI-copy cases separately from content-data fallback cases.
- [ ] 10.2 Remove every UI-copy fallback string from app/admin rendering callsites.
- [x] 10.3 Keep content-data fallback helpers unchanged unless they are incorrectly used for static UI copy.
- [ ] 10.4 Update tests that asserted English UI fallback on missing locale keys so they now assert catalog completeness or compile/check failure.
- [x] 10.5 Confirm `openspec/specs/unit-translation/spec.md` content fallback behavior remains untouched by this UI-copy migration.

## 11. Tests and Type Safety

- [x] 11.1 Update `package/app/src/app/locale.test.ts` or equivalent locale tests to include `ko`.
- [x] 11.2 Add admin locale initialization tests if missing, covering `ko` and invalid stored locale normalization to `DEFAULT_LANGUAGE`.
- [x] 11.3 Add tests for message key parity tooling with missing-key and extra-key fixtures.
- [ ] 11.4 Add tests for forbidden fallback-string tooling with representative app/admin UI callsites.
- [x] 11.5 Run targeted tests for contract language behavior.
- [x] 11.6 Run targeted tests for app/admin locale helpers.
- [x] 11.7 Run targeted tests for repo convention/i18n checks.

## 12. Verification

- [x] 12.1 Run `bun run format`.
- [x] 12.2 Run `bun run format:check`.
- [x] 12.3 Run `bun run check:convention`.
- [x] 12.4 Run `bun run check:tokens`.
- [x] 12.5 Run `bun --filter=@rezics/i18n run compile`.
- [x] 12.6 Run `bun --filter=@rezics/ui run compile`.
- [ ] 12.7 Run TypeScript/build checks for affected frontend packages according to available package scripts.
- [x] 12.8 Run `bun test` in packages with changed tests or package-level targeted test commands where available.
- [ ] 12.9 Run final repo searches proving no admin-local locale files/imports remain.
- [ ] 12.10 Run final repo searches proving no UI-copy fallback string callsites remain in app/admin/ui/editor/folio source.
- [ ] 12.11 Run final repo searches proving no dynamic generated message lookup remains.
- [x] 12.12 Manually review remaining hard-coded UI-copy scan candidates and document intentional exclusions in the convention check allowlist or task notes.

## 13. Documentation and Handoff

- [x] 13.1 Update `package/i18n/README.md` to say all six locales must be updated for every UI copy change.
- [x] 13.2 Update relevant contributor docs to state that app/admin UI copy must use generated Paraglide message functions and must not use fallback strings.
- [x] 13.3 Add a short implementation note summarizing the final scan commands and any accepted exclusions.
- [x] 13.4 Ensure OpenSpec specs and proposal no longer describe the frontend UI locale set as five languages.
