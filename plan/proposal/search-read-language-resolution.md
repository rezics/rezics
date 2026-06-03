---
title: Search Read Language Resolution
status: active
created: 2026-06-03
completed:
supersededBy:
tags: [language, search, meilisearch, frontend, api, unit, post, book, realm]
---

## Why

Most public list surfaces are backed by Meilisearch, while the SQL Unit, Book,
Post, and Realm reads now only partially share a preferred-language model. This
leaves ordinary UI surfaces free to omit read-language candidates, use raw
`translations[]`, or filter by a language set that does not match
`UnitSupportLanguage` semantics. The result is visible inconsistency: an English
UI can show Chinese realm cards, `/realm` can show untitled cards despite
returned records, and search/list pagination can disagree with SQL list reads.

The intended shape is a single read-language pipeline for SQL and Meilisearch.
Registration setup creates a non-empty language preference list for every
completed account, the frontend builds an ordered read context from user
preferences and the app locale, list/search endpoints apply preferred-language
visibility before pagination, and each returned item exposes resolved display
fields chosen by the same support-language resolver. Raw translation arrays
remain available only for language switchers and editing surfaces.

## Durable constraints & decisions

- `(type)` All localized list/search contracts share one read-language shape:
  ordered `languages`, optional `appLocale`, and `languageMode` with
  `preferred | all`.
- `(type)` Account setup includes `preferredLanguages` next to display name and
  slug. A completed account must have a non-empty
  `User.settings.preferredLanguages`.
- `(test)` Setup UI pre-fills preferred languages from the current app locale,
  lets the user edit the list, and submits it with profile setup.
- `(test)` Profile setup normalizes submitted preferred languages and writes
  them in the same operation as the canonical slug. Missing or empty input is
  normalized to `[FALLBACK_LANGUAGE]`, which is currently `["en"]`.
- `(test)` Settings updates must preserve the invariant that
  `preferredLanguages` is non-empty after account setup. Empty updates are
  rejected or normalized by one explicit server rule, not by scattered UI
  fallbacks.
- `(test)` `languages` always means ordered read candidates, not the complete
  availability set for a Unit or search document.
- `(test)` Preferred filtering happens inside PostgreSQL or Meilisearch before
  pagination, totals, sorting, grouping, or section counts are observed.
- `(test)` Preferred filtering uses support-language availability:
  `isLanguageNeutral = true OR supportLanguages/languages intersects
  candidates`.
- `(comment)` Display resolution is separate from language visibility filtering:
  filtering decides whether an item appears; `resolveReadLanguage` decides which
  language its resolved fields use.
- `(test)` Meilisearch language filters use any-of semantics. `["ja", "en"]`
  means `ja OR en`, never `ja AND en`.
- `(test)` Missing translation rows or fields in the resolved supported language
  remain null. Resolved display must not silently fall through to another
  translation row after the support-language resolver has chosen a language.
- `(type)` Meilisearch documents for localized Unit-derived indexes carry enough
  data to resolve display consistently: `languages`, `isLanguageNeutral`,
  ordered support-language metadata where needed, structured translations, and
  resolved response fields.
- `(test)` Frontend ordinary list/search hooks must provide app locale fallback.
  Anonymous reads use `appLocale`; authenticated reads use the locally fetched
  non-empty user preference list and still append `appLocale` as the final
  client-provided fallback.
- `(comment)` Ordinary app queries provide read candidates from the frontend.
  Search/list endpoints should not hide extra authenticated settings lookups in
  the hot path unless a server-only route explicitly needs that behavior.
- `(test)` Search and SQL list behavior stay compatible for language-neutral
  Units and development data repaired from translations into support-language
  rows.
- `(type)` Ordinary UI display consumes resolved fields (`resolvedLanguage`,
  `title`, `summary`, `description`, `content`, `coverUrl` as applicable), not
  raw `translations[]`.

## 1. Account Setup Language Preferences

- [x] 1.1 Extend `package/contract/src/account/registration.ts` so
  `accountSetupBodySchema` accepts `preferredLanguages` using the shared
  language schema.
- [x] 1.2 Update `package/app/src/user/pages/CompleteRegistrationPage.tsx` so
  the setup-account step shows a compact preferred-language control next to
  display name and slug, pre-filled from the current app locale and editable
  before submit.
- [x] 1.3 Update `package/api/src/auth/auth.api.ts` tests/types as needed so
  `setupProfile` passes `preferredLanguages` through the public auth boundary.
- [x] 1.4 Update `package/server/src/auth-boundary/auth-boundary.service.ts` to
  normalize setup preferred languages and pass a non-empty list to user profile
  completion, defaulting missing or empty input to `[FALLBACK_LANGUAGE]`.
- [x] 1.5 Update `package/server/src/user/service/user.service.ts` so
  `completeProfileSetup` writes `settings.preferredLanguages` in the same
  transaction as the canonical USER slug.
- [x] 1.6 Update `package/server/src/user/service/settings.service.ts` and its
  callers so post-setup settings updates cannot leave
  `preferredLanguages` empty.
- [x] 1.7 Add focused app/API/server tests for app-locale prefill, submitted
  setup preferences, missing/empty setup fallback to `["en"]`, and rejection or
  normalization of empty settings updates.

## 2. Contract Shape

- [x] 2.1 Add or reuse a shared read-language query/body schema in
  `package/contract/src/translation/language-resolution.ts` or
  `package/contract/src/list-query-base.ts` for `languages`, `appLocale`, and
  `languageMode`.
- [x] 2.2 Extend `package/contract/src/meili/content.ts`,
  `package/contract/src/meili/post.ts`, `package/contract/src/meili/realm.ts`,
  `package/contract/src/meili/poll.ts`, and
  `package/contract/src/search/search.ts` so direct and federated search options
  accept the shared read-language shape.
- [x] 2.3 Extend Meilisearch document schemas for localized Unit-derived indexes
  with filterable language availability and enough support-language metadata to
  resolve display consistently with SQL mappers.
- [x] 2.4 Extend search result document/DTO schemas with resolved display fields
  where ordinary UI consumers currently derive display from `translations[]`.
- [x] 2.5 Add contract tests for POST body candidates, default
  `languageMode`, `appLocale`, and multi-language any-of semantics across direct
  and federated search schemas.

## 3. Search Index Shape And Sync

- [x] 3.1 Update `package/search/src/schema.ts` so content, post, realm, poll,
  and federated-relevant indexes expose `languages` and `isLanguageNeutral` as
  filterable attributes where applicable.
- [x] 3.2 Update `package/search/src/sync.ts` document builders to source
  indexed `languages` from `UnitSupportLanguage`; repair development data
  rather than preserving old-client compatibility branches.
- [x] 3.3 Update `buildRealmDocument` to include `languages`,
  `isLanguageNeutral`, support-language metadata, and structured translations
  matching the resolved display contract.
- [x] 3.4 Update `buildPostDocument` to include post language availability and
  structured title/content translations needed for resolved post display.
- [x] 3.5 Update content and poll document builders only where their current
  language projection is incomplete relative to support-language filtering and
  resolved display requirements.
- [x] 3.6 Add `package/search/src/*` tests for support-language-first indexing,
  language-neutral indexing, repaired development data assumptions, and
  realm/post language fields.

## 4. Server Meilisearch Resolution

- [x] 4.1 Add a shared Meilisearch read-language helper near
  `package/server/src/meili/search/filters.ts` or a new local module to
  normalize effective candidates from request `languages` and `appLocale`.
- [x] 4.2 Add a shared preferred-language Meilisearch filter builder that emits
  `isLanguageNeutral = true OR languages IN [...]` and returns no filter when
  `languageMode !== "preferred"` or candidates are empty.
- [x] 4.3 Update `package/server/src/meili/content/content.service.ts`,
  `post/post.service.ts`, `realm/realm.service.ts`, and `poll/poll.service.ts`
  to apply the shared language filter before pagination and totals.
- [x] 4.4 Update `package/server/src/meili/search/filters.ts` and
  `federated.service.ts` so federated content, post, realm, and poll sections
  use the same language filter and section counts.
- [x] 4.5 Add result mappers for Meilisearch hits that resolve display fields
  with `resolveReadLanguage` instead of leaving frontend consumers to inspect
  raw translations.
- [x] 4.6 Preserve existing moderation, visibility, realm membership, tag,
  rating, target/variant, grouping, and scope filters while composing language
  filters.
- [x] 4.7 Add server tests for direct content/post/realm/poll search and
  federated search language filters, language-neutral inclusion, empty
  candidate behavior, and missing resolved-language fields.

## 5. SQL Read Coverage Carried Forward

- [ ] 5.1 Add post API/service/mapper tests for preferred filtering, realm feed
  filtering, single read resolution, and missing title/body in the resolved
  supported language.
- [ ] 5.2 Add book tests for list filtering, detail resolution, cover fallback in
  the resolved language, and no translation-row fallback after a supported
  language is resolved.
- [ ] 5.3 Add realm tests for list filtering, detail resolution, rule
  resolution, language-neutral behavior, and ignored legacy `language` fields
  that were previously declared but not enforced.
- [ ] 5.4 Add zone/search tests for preferred candidates, language-neutral items,
  and no accidental all-languages requirement.
- [ ] 5.5 Add a convention or repair test that flags multilingual Units with
  translation/content rows but no matching support-language rows.

## 6. Frontend Read-Language Context

- [x] 6.1 Replace or extend `package/app/src/shared/hooks/useReadLanguageCandidates.ts`
  with a read-language context hook that returns ordered `languages`,
  `appLocale`, `languageMode`, and readiness for language-sensitive queries.
- [x] 6.2 Ensure anonymous reads immediately use `[appLocale]`, while
  authenticated reads wait for the locally cached non-empty user settings list
  and append `appLocale` after those preferences.
- [x] 6.3 Add localized query wrappers in `package/api/src/meili` or app-facing
  hooks so direct content, post, poll, realm, and federated search calls merge
  the read-language context by default.
- [x] 6.4 Keep query keys language-aware so React Query caches do not mix
  results resolved for different candidate orders.
- [ ] 6.5 Update ordinary SQL list/detail query consumers to pass the same
  frontend read-language context when they are not edit/language-switch
  surfaces.

## 7. Frontend Consumers

- [x] 7.1 Update `/realm` and realm search pages to use localized realm search
  results with resolved display fields instead of manually mapping raw
  `translations[]` to `RealmDTO`.
- [x] 7.2 Update homepage active realms and other realm list surfaces to pass
  read-language context and display resolved realm fields.
- [ ] 7.3 Replace frontend `translations[]` picking for ordinary Book and Realm
  display with resolved DTO/search fields.
- [ ] 7.4 Keep explicit language switch/edit views wired to full translation
  availability endpoints or `translations[]`, not list preview fields.
- [ ] 7.5 Update home, book library, user profile/unit lists, shelves, zone
  search, and federated search consumers that call raw Meilisearch query
  options so they use the localized wrappers.
- [ ] 7.6 Update Storybook mocks and app tests for PostCard, book detail, realm
  page, realm feed, unit pickers, and search result cards to include resolved
  language fields.

## 8. Rollout And Verification

- [ ] 8.1 Reinitialize or migrate Meilisearch index settings for new filterable
  attributes before relying on preferred filtering in development or deployed
  environments.
- [ ] 8.2 Resync affected Meilisearch indexes after document schema changes:
  content, posts, polls, realms, and any federated sections backed by them.
- [ ] 8.3 Run focused contract, search, server, API, and app tests for language
  resolution, Meilisearch filters, and updated frontend consumers.

## Out of scope

- No automatic machine translation or generated fallback translation rows.
- No change to write-language or authoring-language selection except where
  existing read endpoints need shared query shape cleanup.
- No frontend filtering after a Meilisearch page is returned; pagination and
  totals must come from filtered queries.
- No removal of full translation arrays from edit/detail surfaces that need
  language switching.
- No compatibility layer for old registration clients; this is a development
  stage cutover.
- No change to moderation, permission, rating, blocking, realm visibility,
  target, or tag policy except composing language filters with existing
  predicates.
