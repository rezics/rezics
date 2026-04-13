## Why

The codebase uses three competing language code conventions simultaneously: `zh-SC`/`zh-TC` (UI i18n), `zh-CN` (content translations, DB), and bare codes like `zh`/`en`/`ja` (fallback chains). Language fields across the contract are unvalidated `t.String()`, allowing any value. This leads to silent mismatches — a translation stored as `zh-CN` won't match a UI requesting `zh-SC`, and the fallback chain references codes that exist nowhere else. A single canonical definition is needed before multilingual features grow further.

## What Changes

- **New `@rezics/contract/src/language.ts` module** — defines 5 canonical lowercase language codes (`zh-hant`, `zh-hans`, `en`, `ja`, `de`), a Typebox validation schema, display metadata, and an alias-based normalizer for migration.
- **BREAKING**: All `language: t.String()` fields in contract DTOs replaced with `language: languageSchema` (Typebox union of the 5 literals). API requests with non-canonical codes will fail validation.
- **Normalizer function** (`normalizeLanguage`) maps legacy codes (`zh-SC`, `zh-TC`, `zh-CN`, `en-US`, `ja-JP`, `de-DE`) to canonical forms. Available for ingress normalization during transition.
- **Frontend i18n resource keys** change from `zh-SC`/`zh-TC`/`en-US`/`ja-JP`/`de-DE` to `zh-hant`/`zh-hans`/`en`/`ja`/`de`. Locale files renamed accordingly.
- **Platform default** set to `zh-hant`; universal fallback to `en`. No bare `zh` code — Simplified and Traditional Chinese are treated as fully separate languages.
- **Fallback chain** in `translation-helpers.ts` simplified: preferred language → `en` → first available. No cross-script Chinese affinity.
- **All hardcoded language strings** updated across frontend and backend (~15 files with `zh-CN`, `zh-SC`, `en-US`, etc.).

## Capabilities

### New Capabilities
- `language-registry`: Canonical language code definitions, Typebox schema, display metadata, normalization/alias mapping, and platform defaults (`zh-hant` primary, `en` fallback). Single source of truth for all language handling across the monorepo.

### Modified Capabilities
- `multilingual-ui`: Default UI language changes from `zh-SC` to `zh-hant`, fallback from `en-US` to `en`. Resource keys and locale filenames change to canonical codes.
- `unit-translation`: Translation language fields validated against canonical code set. Fallback resolution simplified to preferred → `en` → first available.
- `content-search-translations`: Language codes in Meilisearch documents change to canonical form. Search language filters must use canonical codes.

## Impact

**Affected packages:**
- `package/contract` — new `language.ts` module; all schemas with `language` fields updated
- `package/app` — locale file renames, i18n provider config, `LangToggle`, `translation-helpers.ts`, ~10 files with hardcoded `zh-CN`
- `package/admin` — locale file renames, i18n provider config
- `package/server` — `translation.service.ts` fallback logic, ingress normalization
- `package/search` — language codes in sync/indexing
- `package/preview` — `lang` attribute in HTML template

**Backward compatibility:** Breaking change to API language field validation. Existing API consumers sending `zh-CN` or `en-US` will get validation errors unless they update to canonical codes. The `normalizeLanguage()` function is provided for transition but is not applied automatically at the API boundary.

**No database migration required** — no real multilingual data exists in the current database. Seed data will be updated in a separate change.
