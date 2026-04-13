## 1. File Rename and Script Update

- [x] 1.1 Rename `package/server/prisma/seed/utils/databaseReset.ts` → `database-reset.ts`
- [x] 1.2 Update `package/server/package.json`: rename `seed:databaseReset` script to `seed:database-reset`, add `seed:database-reset:all` script variant
- [x] 1.3 Update any imports of `databaseReset` in other seed files (check `seed/database.ts` and `seed/mock/seed.ts`)

## 2. Smart Reset: Infrastructure Snapshot

- [x] 2.1 Create `snapshotInfrastructure(prisma)` function in `package/server/prisma/seed/database.ts` that queries and returns: seed users (by 4 hardcoded emails), content-type tags (type=TAG + isLanguageNeutral + known titles), official realm (isOfficial=true), associated UnitTranslations, UnitSupportLanguages, self-referencing UnitTags, RealmMember owner, and infra EchoKV entries
- [x] 2.2 Define a `InfraSnapshot` TypeScript interface for the snapshot return type, explicitly listing each preserved entity set

## 3. Smart Reset: Restore After Wipe

- [x] 3.1 Create `restoreInfrastructure(prisma, snapshot)` function in `package/server/prisma/seed/database.ts` that reinserts snapshot data in FK-safe order: Users → Units → UnitTranslations → UnitSupportLanguages → UnitTags → Realm → RealmMember → EchoKV
- [x] 3.2 Create `resetDatabasePreserveInfra(prisma)` that orchestrates snapshot → resetDatabase → restore

## 4. CLI Entry Point

- [x] 4.1 Update `database-reset.ts` entry point: parse `process.argv` for `--all` flag, call `resetDatabasePreserveInfra()` by default or `resetDatabase()` when `--all` is passed
- [x] 4.2 Add JSDoc to `database-reset.ts` with script description, available flags (`--all`), example usage, and what constitutes "infrastructure"
- [x] 4.3 Add JSDoc to `resetDatabase()` and `resetDatabasePreserveInfra()` functions

## 5. Curated Text Corpus

- [x] 5.1 Create `package/server/prisma/seed/mock/data/text/zh-hant.ts` with ~50 book titles, ~15 realm/shelf names, ~30 summaries/descriptions in Traditional Chinese
- [x] 5.2 Create `package/server/prisma/seed/mock/data/text/zh-hans.ts` with ~50 book titles, ~15 realm/shelf names, ~30 summaries/descriptions in Simplified Chinese
- [x] 5.3 Create `package/server/prisma/seed/mock/data/text/en.ts` with ~50 book titles, ~15 realm/shelf names, ~30 summaries/descriptions in English
- [x] 5.4 Create `package/server/prisma/seed/mock/data/text/ja.ts` with ~30 book titles, ~10 realm/shelf names, ~20 summaries/descriptions in Japanese
- [x] 5.5 Create `package/server/prisma/seed/mock/data/text/de.ts` with ~30 book titles, ~10 realm/shelf names, ~20 summaries/descriptions in German
- [x] 5.6 Create `package/server/prisma/seed/mock/data/text/index.ts` barrel export with `TITLE_POOLS`, `SUMMARY_POOLS`, `DESCRIPTION_POOLS` typed by `Language` and `UnitType`

## 6. Faker Locale Instances

- [x] 6.1 Create per-language faker instances in `package/server/prisma/seed/mock/generators.ts` using `new Faker({ locale: [zh_TW, en, base] })` pattern for each canonical language
- [x] 6.2 Export a `getFaker(lang: Language)` helper that returns the locale-appropriate faker instance

## 7. Multilingual Generator Refactor

- [x] 7.1 Replace `generateTranslation(type)` with `generateTranslations(type)` in `generators.ts` — returns `TranslationData[]` with `language` field, always includes `zh-hant`, probabilistically includes others
- [x] 7.2 Add `pickFromCorpus(type, lang)` helper that draws title/summary/description from the curated text pool, falling back to faker lorem for descriptions
- [x] 7.3 Update `TranslationData` interface to include `language: Language` field

## 8. Entity Seeder Updates

- [x] 8.1 Update `books.ts`: use `generateTranslations(UnitType.BOOK)`, create multiple UnitTranslation + UnitSupportLanguage records, set `defaultLanguage: DEFAULT_LANGUAGE`
- [x] 8.2 Update `games.ts`: same pattern as books
- [x] 8.3 Update `media.ts`: same pattern as books
- [x] 8.4 Update `shelves.ts`: use `generateTranslations(UnitType.SHELF)`, create multiple translations, set `defaultLanguage: DEFAULT_LANGUAGE`
- [x] 8.5 Update `realms.ts`: use `generateTranslations(UnitType.REALM)`, create multiple translations, set `defaultLanguage: DEFAULT_LANGUAGE`
- [x] 8.6 Update `tags.ts`: use `generateTranslations(UnitType.TAG)`, create multiple translations
- [x] 8.7 Update `posts.ts`: use `generateTranslations(UnitType.POST)`, create multiple translations
- [x] 8.8 Update `attribution.ts`: use `getFaker(lang)` to generate locale-appropriate person and organization names with diverse locale distribution

## 9. Cross-Seed Infrastructure Language Update

- [x] 9.1 Update `tool/seed/lib/seed-infra.ts`: change content-type tag translation from `language: "en"` to `DEFAULT_LANGUAGE` import, add `en` translation as secondary
- [x] 9.2 Update `tool/seed/lib/seed-infra.ts`: change default realm translation from `language: "en"` to `DEFAULT_LANGUAGE`, add `en` translation as secondary

## 10. Validation

- [x] 10.1 Run `bun run seed:database-reset` and verify infrastructure is preserved (users, tags, realm, EchoKV remain)
- [x] 10.2 Run `bun run seed:database-reset --all` and verify full wipe (all tables empty)
- [x] 10.3 Run `bun run seed:mock` and verify multilingual translations are created (spot-check books, shelves, realms for multiple UnitTranslation records)
- [x] 10.4 Start dev server and verify multilingual content displays correctly in the UI when switching languages via LangToggle
<!-- Tasks 10.1-10.4 require running database for validation -->
