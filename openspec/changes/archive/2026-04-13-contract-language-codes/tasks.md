## 1. Contract: Language Registry Module

- [x] 1.1 Create `package/contract/src/language.ts` with `LANGUAGES` const, `Language` type, `languageSchema` (Typebox union of 5 literals), `LANGUAGE_META` (display/native names), `DEFAULT_LANGUAGE` (`'zh-hant'`), `FALLBACK_LANGUAGE` (`'en'`)
- [x] 1.2 Add `LANGUAGE_ALIASES` record and `normalizeLanguage()` function with case-insensitive legacy code mapping (`zh-SC` → `zh-hans`, `zh-TC` → `zh-hant`, `zh-CN` → `zh-hans`, `zh-TW` → `zh-hant`, `en-US` → `en`, `en-GB` → `en`, `ja-JP` → `ja`, `de-DE` → `de`). No bare `zh` entry.
- [x] 1.3 Export all language symbols from `package/contract/src/index.ts`

## 2. Contract: Replace t.String() with languageSchema

- [x] 2.1 Update `unitTranslationDTOSchema.language` from `t.String()` to `languageSchema`
- [x] 2.2 Update `unitSupportLanguageDTOSchema.language` from `t.String()` to `languageSchema`
- [x] 2.3 Update `createUnitSchema.defaultLanguage` from `t.Optional(t.String())` to `t.Optional(languageSchema)`
- [x] 2.4 Update `updateUnitSchema.defaultLanguage` from `t.Optional(t.String())` to `t.Optional(languageSchema)`
- [x] 2.5 Update `createTranslationSchema.language` from `t.String()` to `languageSchema`
- [x] 2.6 Update `translationParamsSchema.language` from `t.String()` to `languageSchema`
- [x] 2.7 Update `unitListQuerySchema.language` from `t.Optional(t.String())` to `t.Optional(languageSchema)`
- [x] 2.8 Update `baseUnitSchema.defaultLanguage` from `t.Optional(t.Nullable(t.String()))` to `t.Optional(t.Nullable(languageSchema))`

## 3. Frontend: Locale File Migration (app)

- [x] 3.1 Rename `package/app/src/locale/zh-SC.ts` → `zh-hant.ts`
- [x] 3.2 Rename `package/app/src/locale/zh-TC.ts` → `zh-hans.ts`
- [x] 3.3 Rename `package/app/src/locale/en-US.ts` → `en.ts`
- [x] 3.4 Rename `package/app/src/locale/ja-JP.ts` → `ja.ts`
- [x] 3.5 Rename `package/app/src/locale/de-DE.ts` → `de.ts`
- [x] 3.6 Update `package/app/src/app/provider/i18n.ts`: change import paths, resource keys to canonical codes, `lng: 'zh-hant'`, `fallbackLng: 'en'`

## 4. Frontend: Locale File Migration (admin)

- [x] 4.1 Rename `package/admin/src/locale/zh-SC.ts` → `zh-hant.ts`
- [x] 4.2 Rename `package/admin/src/locale/zh-TC.ts` → `zh-hans.ts`
- [x] 4.3 Rename `package/admin/src/locale/en-US.ts` → `en.ts`
- [x] 4.4 Rename `package/admin/src/locale/ja-JP.ts` → `ja.ts`
- [x] 4.5 Rename `package/admin/src/locale/de-DE.ts` → `de.ts`
- [x] 4.6 Update `package/admin/src/app/provider/i18n.ts`: change import paths, resource keys to canonical codes, `lng: 'zh-hant'`, `fallbackLng: 'en'`

## 5. Frontend: LangToggle and Translation Helpers

- [x] 5.1 Update `package/app/src/core/component/LangToggle.tsx`: change all language codes to canonical codes, use `LANGUAGE_META` from contract for display labels
- [x] 5.2 Update `package/app/src/shared/util/translation-helpers.ts`: replace `DEFAULT_LANGUAGE_CHAIN` with fallback logic using `DEFAULT_LANGUAGE` and `FALLBACK_LANGUAGE` from contract. Resolution order: preferred → unit default → `'en'` → first available.

## 6. Frontend: Hardcoded Language String Migration

- [x] 6.1 Update `package/app/src/book-edit/section/BookEditInfoSection.tsx`: replace `'zh-CN'` with `DEFAULT_LANGUAGE` import
- [x] 6.2 Update `package/app/src/shelf/page/NewShelfPage.tsx`: replace `'zh-CN'` with `DEFAULT_LANGUAGE`
- [x] 6.3 Update `package/app/src/shelf/page/ShelfEditPage.tsx`: replace `'zh-CN'` with `DEFAULT_LANGUAGE`
- [x] 6.4 Update `package/app/src/tag/component/Edit/TagEdit.tsx`: replace `'zh-CN'` with `DEFAULT_LANGUAGE`
- [x] 6.5 Update `package/app/src/realm/page/RealmManagePage.tsx`: replace `'zh-CN'` with `DEFAULT_LANGUAGE`
- [x] 6.6 Update `package/app/src/realm/page/NewRealmPage.tsx`: replace `'zh-CN'` with `DEFAULT_LANGUAGE`
- [x] 6.7 Update `package/app/src/i18n/component/TranslationEditor.tsx`: replace `'zh-CN'` with `DEFAULT_LANGUAGE`
- [x] 6.8 Update `package/app/src/book-library/page/BookLibPage.tsx`: replace `'zh-CN'` with `DEFAULT_LANGUAGE`
- [x] 6.9 Update `package/app/src/home/section/hooks/hooks.ts`: replace `'zh-CN'` with `DEFAULT_LANGUAGE`
- [x] 6.10 Update `package/app/src/mock/data/bookList01.ts`: replace `'zh-CN'` with `DEFAULT_LANGUAGE`

## 7. Backend and Other Packages

- [x] 7.1 Update `package/server/src/unit/translation.service.ts`: update fallback resolution to use `FALLBACK_LANGUAGE` from contract (preferred → unit default → `'en'` → first available)
- [x] 7.2 Update `package/search/src/sync.ts`: verify language codes in indexed documents come from DB (no hardcoded codes)
- [x] 7.3 Update `package/preview/src/component/BookShareDocument.tsx`: change `lang="zh-CN"` to `lang="zh-hant"`

## 8. Cross-Seed Infrastructure

- [x] 8.1 Update `tool/seed/lib/seed-infra.ts`: replace hardcoded `language: "en"` with `DEFAULT_LANGUAGE` import from contract for content-type tag and realm translations
- [x] 8.2 Update `package/server/prisma/seed/mock/` seed files: replace all hardcoded `"en"` language strings with `DEFAULT_LANGUAGE` import (books.ts, shelves.ts, realms.ts, tags.ts, games.ts, media.ts, posts.ts)

## 9. Validation

- [x] 9.1 Run `rg "zh-SC|zh-TC|zh-CN|zh-TW|en-US|ja-JP|de-DE" --type ts --type tsx` across the codebase to verify no legacy codes remain in TypeScript files (excluding openspec archive)
- [x] 9.2 Run `bun run build` in `package/contract` to verify the new module compiles
- [x] 9.3 Run TypeScript compilation across `package/app`, `package/admin`, `package/server` to verify all imports resolve and type-check
- [x] 9.4 Start the dev server (`bun run app:dev`) and verify the language toggle works with canonical codes
