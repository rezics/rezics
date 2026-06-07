---
title: Read Language Contract Cutover
status: active
created: 2026-06-07
completed:
supersededBy:
tags: [contract, i18n, app, api, server, book, realm, unit, search]
---

## Why

Localized reads currently mix app locale, user preferred content languages, and
fallback candidates in ad hoc ways. The shared resolver says user preferences
outrank UI locale, while product behavior should make the locally selected app
language the primary read language unless an explicit language is requested.

The mismatch leaks into API contracts and UI: some book/realm read schemas do not
accept `appLocale`, frontend callers often pass only `languages`, and some UI
mapping still reads `translations[0]` instead of server-resolved fields. The
outcome is a contract-first read-language flow where list/detail/search use the
same candidate semantics and display DTO fields remain coherent across list and
detail surfaces.

## Durable constraints & decisions

- `(test)` Read language resolution order is explicit language, then app locale,
  then user preferred/read fallback candidates, then unit support-language
  order, then platform fallback.
- `(type)` Shared read-language query/body shapes carry `languages`,
  `appLocale`, and `languageMode`; detail reads also allow an explicit language
  where the endpoint supports one-shot selection.
- `(test)` Visibility filtering for `languageMode: "preferred"` may use the
  union of app locale and preferred/read fallback candidates, but display
  resolution must still use resolver order.
- `(comment)` `languages` is a fallback/preference candidate list, not a place to
  smuggle app locale priority. Keep `appLocale` distinct at API boundaries.
- `(test)` Resolved DTO display fields (`title`, `description`, `summary`,
  `resolvedLanguage`) are the default frontend display surface for list/detail
  cards. Translation arrays are for edit surfaces, language switchers, and
  explicit fallback helpers only.
- `(test)` Book and realm list/detail reads with the same read context resolve
  the same language for an item when support languages are unchanged.
- `(test)` If no locally stored app locale exists, the app may seed the locale
  from the user's first preferred language and persist it, without overriding an
  existing local app-language choice.

## Tasks

## 1. Contract language semantics

- [x] 1.1 Update `package/contract/src/translation/language-resolution.ts` so
  `readLanguageCandidates` places `appLocale` before `languages` and
  `preferredLanguages`, and revise comments to match the new product rule.
- [x] 1.2 Update `package/contract/src/translation/language-resolution.test.ts`
  to lock app-locale-first read ordering, support-language fallback, and the
  supported-but-missing-translation behavior.
- [x] 1.3 Add shared GET read-language query bases in
  `package/contract/src/list-query-base.ts` for CSV query transport:
  `languages?: string`, `appLocale?: language`, and
  `languageMode?: preferred | all`.
- [x] 1.4 Replace duplicated book, realm, post, feed, and unit read/list query
  schema fragments with the shared contract shapes where the endpoint is a
  localized read surface.
- [x] 1.5 Update contract tests for book, realm, post, unit, and Meili read
  schemas so `appLocale` is accepted consistently on localized GET/list
  endpoints.

## 2. Server propagation

- [x] 2.1 Update `package/server/src/unit/language-resolution.ts` so
  `resolveEffectiveReadLanguageCandidates` keeps app locale as a distinct
  resolver input instead of flattening it behind `languages`.
- [x] 2.2 Update book API/service mapping in `package/server/src/book/book.api.ts`,
  `package/server/src/book/book.service.ts`, and `package/server/src/book/mapper.ts`
  to pass the full read-language context through list, POST list, and detail
  mapping.
- [x] 2.3 Update realm API/service mapping in
  `package/server/src/realm/realm.api.ts`, `package/server/src/realm/realm.service.ts`,
  and `package/server/src/realm/realm.mapper.ts` to pass `appLocale` through
  list, by-slug, detail, member, and my-realms reads.
- [x] 2.4 Audit existing post, unit, feed, zone, and Meili search handlers that
  already accept `appLocale`; align them with the new contract order and avoid
  local candidate reordering.
- [x] 2.5 Add or update server tests for book/realm mapper/API behavior showing
  app locale outranks preferred languages and list/detail resolve consistently.

## 3. Frontend API clients and read context

- [x] 3.1 Update `package/api/src/book`, `package/api/src/realm`,
  `package/api/src/post`, and `package/api/src/unit` query/client types so
  localized reads accept the shared read-language query shape, including
  `appLocale`.
- [x] 3.2 Update API serialization tests to prove `appLocale` and `languages`
  are both sent for list/detail requests without collapsing app locale into the
  `languages` CSV.
- [x] 3.3 Update `package/app/src/shared/hooks/useReadLanguageCandidates.ts` so
  `languages` contains user preferred/fallback candidates and `appLocale` stays
  separate.
- [x] 3.4 Add app locale seeding near the i18n/user-settings integration: when
  no `rezics-locale` exists and user settings contain preferred languages, set
  and persist the first preferred language without overwriting an existing local
  choice.
- [x] 3.5 Update book, realm, unit, post, poll, pinboard, user profile, and
  search frontend callsites to pass both `languages: readContext.languages` and
  `appLocale: readContext.appLocale` on localized reads.

## 4. Frontend display consistency

- [x] 4.1 Replace `RealmsTabSection` list-item mapping so joined and created
  realm rows display `realm.title` and `realm.description` from the resolved DTO
  instead of `realm.translations?.[0]`.
- [x] 4.2 Audit book list/detail display components and helpers to ensure default
  display uses `book.title`, `book.description`, and `book.resolvedLanguage`,
  not `translations[0]`.
- [x] 4.3 Audit user-facing unit/realm/search card adapters that render
  `translations[0]`; convert task-owned display paths to resolved DTO fields and
  leave edit/language-switcher paths unchanged.
- [x] 4.4 Add focused app model/component tests for the known regression:
  realm list and detail show the same localized title when app locale differs
  from user preferred language.

## 5. Verification

- [x] 5.1 Run focused contract, server, API, and app tests touched by the change.
- [x] 5.2 Run `bun run check:convention` for cross-package contract/frontend
  convention coverage.
- [ ] 5.3 Manually verify after `bun run dev`: a user with app locale
  `zh-hant` and preferred language `en` sees matching Chinese realm and book
  titles on list and detail pages.

## Out of scope

- Reworking translation authoring defaults beyond any necessary tests that keep
  create/edit language behavior stable.
- Changing support-language data, migration/backfill policy, or translation row
  completeness semantics.
- Fixing every historical `translations[0]` display in unrelated shelf, excerpt,
  entity, and admin surfaces unless it is on a task-owned localized read path.
- Adding a global language switcher redesign or account settings redesign.
