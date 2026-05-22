## Why

Rezics now uses compiled Paraglide message functions for frontend UI copy, but the
repository still has incomplete locale catalogs, hard-coded app/admin strings,
and an admin-local locale system that duplicates `@rezics/i18n`. This makes
language switching inconsistent and lets missing UI translations survive as
runtime fallback text instead of failing during development.

This change completes the compiled UI i18n cutover: every supported UI locale is
fully represented, Korean is added as a canonical UI locale, app/admin UI copy is
catalog-backed, and legacy UI fallback strings are removed.

## What Changes

- Add Korean as canonical language code `ko` across the frontend UI i18n stack
  and language registry.
- Complete the product/domain message catalogs in `@rezics/i18n` for
  `zh-hant`, `zh-hans`, `en`, `ja`, `de`, and `ko`.
- Complete the reusable UI component message catalogs in `@rezics/ui` for the
  same six locales.
- Migrate `package/admin` UI copy to generated message functions from
  `@rezics/i18n/messages` and shared label helpers from `@rezics/i18n`.
- Remove the legacy `package/admin/src/locale/*.ts` locale source and any admin
  code that consumes it.
- Sweep `package/app` and `package/admin` for hard-coded user-visible UI copy
  and replace eligible strings with generated `@rezics/i18n` message functions.
- Forbid UI copy fallback strings in app/admin/UI code. Missing UI copy must be
  fixed by adding catalog entries for every supported locale, not by passing
  inline fallback text.
- Add or update convention checks so supported locale lists and message key sets
  cannot drift.
- **BREAKING**: frontend contributors can no longer add app/admin/UI message keys
  for only one locale; every new UI message must be added to all six locale JSON
  files in the same change.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `language-registry`: Adds `ko` to the canonical language registry and language
  metadata while preserving `zh-hant` as the default language.
- `i18n-toolchain`: Changes frontend UI locale coverage from five locales to six,
  requires complete message key parity across locale files, and removes runtime
  UI copy fallback strings as an allowed migration behavior.
- `multilingual-ui`: Updates the supported frontend UI locale set to include
  `ko`, removes missing-key UI locale fallback behavior, and broadens the
  hard-coded UI copy prohibition from selected homepage/search surfaces to the
  app/admin UI surfaces covered by this migration.

## Impact

- Affected packages:
  - `package/contract`: `LANGUAGES`, `Language`, `languageSchema`,
    `LANGUAGE_META`, and normalization behavior.
  - `package/i18n`: Paraglide project settings, source message catalogs,
    generated output, shared label helpers, and README guidance.
  - `package/ui`: Paraglide project settings, source message catalogs, generated
    output, and component-internal UI copy checks.
  - `package/app`: UI copy callsites, language controls, locale initialization,
    tests, and convention check coverage.
  - `package/admin`: full migration from admin-local locale files to
    `@rezics/i18n`, route/page/table/dialog copy, language controls, locale
    initialization, and tests.
  - repo-level checks/scripts: message catalog completeness, locale list parity,
    forbidden fallback-string patterns, and hard-coded UI copy scan.
- No backend API shape change is intended, except any generated contract type
  widening caused by adding `ko` to the shared language schema.
- Content translation fallback chains for user-generated/catalog data are out of
  scope. This change targets UI copy fallback strings only.
- Migration is a clear cutover: app/admin internal callsites should be updated
  in the same change instead of keeping dual locale systems.
