## Context

The codebase has three competing language code conventions: `zh-SC`/`zh-TC` in UI i18n resource keys, `zh-CN` in content translations and hardcoded defaults, and bare codes (`zh`, `en`, `ja`) in the fallback chain. All `language` fields in the contract are `t.String()` with no validation — any arbitrary string is accepted.

There are 5 supported languages. No real multilingual data exists in the database yet — existing seed data uses `"en"` only. This means there is no data migration burden; the change is purely a code-level standardization.

**Current code distribution:**
- `zh-SC`, `zh-TC` — `package/app/src/app/provider/i18n.ts`, `package/admin/src/app/provider/i18n.ts`, locale file names, `LangToggle.tsx`
- `zh-CN` — `translation-helpers.ts`, `BookEditInfoSection.tsx`, `NewShelfPage.tsx`, `ShelfEditPage.tsx`, `TagEdit.tsx`, `RealmManagePage.tsx`, `NewRealmPage.tsx`, `TranslationEditor.tsx`, `BookLibPage.tsx`, `home/section/hooks/hooks.ts`, `mock/data/bookList01.ts`
- `en-US`, `ja-JP`, `de-DE` — i18n resource keys and locale file names
- `zh`, `en`, `ja` (bare) — `DEFAULT_LANGUAGE_CHAIN` in `translation-helpers.ts`

## Goals / Non-Goals

**Goals:**
- Single source of truth for language codes in `@rezics/contract`
- Typebox schema validation on all language fields — invalid codes rejected at the API boundary
- All-lowercase canonical codes using script subtags over region subtags
- Simplified fallback logic: preferred → `en` → first available
- zh-hans and zh-hant treated as fully independent languages (no bare `zh`, no cross-script affinity)

**Non-Goals:**
- Database data migration (no multilingual data exists yet)
- Multilingual seed data generation (separate change: `seed-infrastructure-v2`)
- Adding or removing supported languages
- Changes to the Prisma schema column types (VARCHAR(16) accommodates new codes)

## Decisions

### Decision 1: All-lowercase canonical codes, script over region

**Canonical set:**

| Code | Meaning |
|------|---------|
| `zh-hant` | Traditional Chinese (script-based) |
| `zh-hans` | Simplified Chinese (script-based) |
| `en` | English (no region — `en-us` vs `en-gb` distinction not needed) |
| `ja` | Japanese (no region) |
| `de` | German (no region) |

**Why lowercase:** Eliminates case-sensitivity bugs. All string comparisons are exact-match without `.toLowerCase()`. BCP 47 is case-insensitive by spec — lowercase is a valid canonical form.

**Why script over region:** A book is in Simplified or Traditional characters regardless of where it was published. `zh-hans`/`zh-hant` captures the meaningful distinction; `zh-CN`/`zh-TW` conflates script with geography.

**Why no bare codes (`zh`, `en`, `ja`):** Bare `zh` is ambiguous — it doesn't specify script. Since Hans and Hant are treated as separate languages, `zh` has no valid meaning. Bare `en`/`ja`/`de` are acceptable since they have no script ambiguity, and the project doesn't distinguish regional variants.

**Alternatives considered:**
- BCP 47 conventional casing (`zh-Hant`) — rejected because case sensitivity introduces bugs for no benefit
- Region-based codes (`zh-CN`, `zh-TW`, `en-US`) — rejected because region doesn't capture the meaningful distinction for book content

### Decision 2: Contract module structure

New file `package/contract/src/language.ts` exports:

```
LANGUAGES          — const object { ZH_HANT: 'zh-hant', ... }
Language           — type union extracted from LANGUAGES values
languageSchema     — Typebox t.Union([t.Literal('zh-hant'), ...])
LANGUAGE_META      — display names and native names per code
DEFAULT_LANGUAGE   — 'zh-hant'
FALLBACK_LANGUAGE  — 'en'
LANGUAGE_ALIASES   — Record<string, Language> for legacy code mapping
normalizeLanguage  — (code: string) => Language | null
```

This follows the existing contract enum pattern (`UnitType`, `UnitStatus`, `UnitVisibility` in `unit.ts`).

**Why a single file:** All language concerns are tightly coupled. Splitting across files would scatter what should be a cohesive module.

**Why include metadata:** The `LangToggle` component and any future language picker need display names. Centralizing them avoids scattering `"繁體中文"` strings across UI components.

### Decision 3: Replace t.String() with languageSchema in all DTOs

Every `language` field in the contract schemas (`unitTranslationDTOSchema`, `unitSupportLanguageDTOSchema`, `createUnitSchema.defaultLanguage`, `createTranslationSchema.language`, `translationParamsSchema.language`, `unitListQuerySchema.language`) changes from `t.String()` to `languageSchema`.

**Why strict validation over normalization at boundary:** The project has no external API consumers yet. All callers are first-party (app, admin). Strict validation forces all code paths to use canonical codes rather than silently normalizing — preventing the very drift this change addresses.

The `normalizeLanguage()` function exists for the seed infrastructure and any future external integration, but is not wired into API middleware.

### Decision 4: Simplified fallback resolution

Current: `['zh-CN', 'zh', 'en', 'ja']` — a chain with non-canonical codes and implicit Chinese affinity.

New: `preferred → en → first available`. Implemented as:

```
1. Exact match on user's preferred language
2. Exact match on unit's defaultLanguage
3. Exact match on 'en' (platform fallback)
4. First available translation (last resort)
```

**Why no Chinese cross-script affinity:** The project treats zh-hans and zh-hant as separate languages. A zh-hant user should not silently receive zh-hans content — if they want both, they configure both in their preferences.

**Why `en` as universal fallback:** English is the most likely secondary translation available. If neither the preferred language nor English exists, returning the first available translation is better than returning nothing.

### Decision 5: Locale file rename strategy

Current files: `zh-SC.ts`, `zh-TC.ts`, `en-US.ts`, `ja-JP.ts`, `de-DE.ts`

Renamed to: `zh-hant.ts`, `zh-hans.ts`, `en.ts`, `ja.ts`, `de.ts`

All five locale files are retained — they contain existing translations. Only the filenames and i18n resource keys change.

**Why keep all 5:** Removing locale files is a separate decision about language support scope. This change standardizes codes, not language coverage.

## Risks / Trade-offs

**[Risk] Hardcoded strings missed during migration** → Comprehensive grep for all legacy codes (`zh-SC`, `zh-TC`, `zh-CN`, `en-US`, `ja-JP`, `de-DE`, bare `zh`) across the entire codebase. Include OpenSpec specs/docs, mock data, and test files.

**[Risk] localStorage persistence** → Users who have `"lang": "zh-SC"` in localStorage from `LangToggle` will have an unrecognized language after the change. → The i18n provider's `fallbackLng: 'en'` handles this gracefully — unrecognized codes fall back to English. Not a critical issue for a dev-stage project.

**[Trade-off] Strict validation breaks any ad-hoc API testing with old codes** → Accepted. The `normalizeLanguage()` function is available for callers that need to adapt, but the API itself enforces canonical codes. This is intentional.

**[Trade-off] `en` instead of `en-us`** → If regional English variants are ever needed (unlikely for a book library), a code change is required. Accepted — YAGNI.
