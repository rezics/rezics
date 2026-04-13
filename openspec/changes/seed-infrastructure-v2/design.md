## Context

The seed infrastructure currently has three scripts run in sequence: `seed:cross` (creates users, tags, realm, EchoKV), `seed:databaseReset` (wipes everything), and `seed:mock` (generates mock data). The reset step destroys cross-seeded infrastructure, requiring `seed:cross` to be rerun before mock seeding. All mock data is English-only — `generateTranslation()` returns a single English translation per unit.

The `contract-language-codes` change (prerequisite) establishes 5 canonical language codes. This change builds on those codes to produce realistic multilingual seed data and streamline the reset workflow.

**Current file structure:**
```
package/server/prisma/seed/
  mock/
    seed.ts, generators.ts, utils.ts, data.ts, types.ts
    books.ts, games.ts, media.ts, shelves.ts, realms.ts
    posts.ts, scores.ts, engagement.ts, attribution.ts, tags.ts
    echokv.ts, config.ts
    data/ (homeCarousel, quick-tags, noticeboard, echokv/)
  utils/
    databaseReset.ts     ← rename target
    init-meili-search.ts
  database.ts            ← resetDatabase() function
tool/seed/
  cross-seed.ts, lib/seed-infra.ts, lib/seed-server-user.ts
```

## Goals / Non-Goals

**Goals:**
- `database-reset` preserves cross-seeded infrastructure by default, eliminating the `seed:cross` rerun step
- `--all` flag provides full-wipe behavior when needed
- Mock generators produce multilingual translations using canonical language codes
- Hybrid text strategy: curated corpus for visible text (titles, summaries), faker locales for structured data (names, companies)
- JSDoc on the reset function and CLI entry point

**Non-Goals:**
- Changing the cross-seed script itself (`tool/seed/cross-seed.ts` logic stays the same)
- Adding new entity types to the seed pipeline
- Shelf cover images or realm display improvements (separate concern)
- Prisma schema changes

## Decisions

### Decision 1: Snapshot-nuke-restore pattern for smart reset

The reset preserves infrastructure by: (1) querying and snapshotting cross-seeded data, (2) running the existing FK-safe delete cascade, (3) reinserting the snapshot.

```
database-reset (default):

  SNAPSHOT
  ├── Users: query by email list (SEED_USERS emails)
  ├── Tags: query by type=TAG + isLanguageNeutral=true + known titles
  ├── Tag UnitTags: self-referencing UnitTag entries (score boost)
  ├── Realm: query by isOfficial=true
  ├── RealmMember: owner membership for official realm
  ├── UnitTranslations: for all preserved units
  ├── UnitSupportLanguages: for all preserved units
  └── EchoKV: keys starting with 'infra:'

  NUKE (existing resetDatabase cascade — unchanged)

  RESTORE (insert in FK-safe order)
  ├── Users
  ├── Units (tags, realm)
  ├── UnitTranslations
  ├── UnitSupportLanguages
  ├── UnitTags (self-tag boost)
  ├── Realm extension
  ├── RealmMember
  └── EchoKV
```

**Why snapshot-nuke-restore over surgical delete:** The FK dependency graph makes it fragile to delete "only mock data." Hundreds of junction rows (ShelfItem, RealmUnit, UnitTag, PersonCredit, etc.) reference both mock and infra units. Nuke-and-restore is simple, correct, and uses the existing proven delete cascade.

**Alternatives considered:**
- Surgical delete (skip infra rows in each `deleteMany`) — rejected, too fragile and error-prone with evolving schema
- Mark infra rows with a flag column — rejected, requires schema change for a dev-only concern

### Decision 2: CLI flag parsing

The `database-reset.ts` entry point checks `process.argv` for `--all`:

```ts
const wipeAll = process.argv.includes('--all');
if (wipeAll) {
  await resetDatabase(prisma);
} else {
  await resetDatabasePreserveInfra(prisma);
}
```

The `package.json` scripts:
```json
"seed:database-reset": "bun run prisma/seed/utils/database-reset.ts",
"seed:database-reset:all": "bun run prisma/seed/utils/database-reset.ts --all"
```

### Decision 3: Hybrid multilingual text generation (Option C)

Three layers of text generation, selected by visibility:

**Layer 1: Curated text corpus** — for titles and summaries (high visibility)

New directory `seed/mock/data/text/` with per-language files:
```
data/text/
  zh-hant.ts   — ~50 titles, ~30 descriptions/summaries
  zh-hans.ts   — ~50 titles, ~30 descriptions/summaries
  en.ts        — ~50 titles, ~30 descriptions/summaries
  ja.ts        — ~30 titles, ~20 descriptions/summaries
  de.ts        — ~30 titles, ~20 descriptions/summaries
```

Each file exports arrays of realistic text (book titles, realm names, shelf names, etc.) grouped by unit type. The generator picks randomly from the pool.

**Layer 2: Faker locale instances** — for person names, company names, addresses

```ts
import { Faker, zh_TW, zh_CN, ja, de, en, base } from '@faker-js/faker';

const fakerInstances: Record<Language, Faker> = {
  'zh-hant': new Faker({ locale: [zh_TW, en, base] }),
  'zh-hans': new Faker({ locale: [zh_CN, en, base] }),
  'en':      new Faker({ locale: [en, base] }),
  'ja':      new Faker({ locale: [ja, en, base] }),
  'de':      new Faker({ locale: [de, en, base] }),
};
```

Each faker instance has English as a fallback locale, so modules without localization fall through gracefully.

**Layer 3: Faker lorem (English)** — for long-form descriptions and post bodies (low visibility)

Long descriptions and post bodies continue using `faker.lorem` (Latin text). These are bulk filler — developers rarely read them in the UI. This avoids the complexity of generating paragraph-length CJK text.

**Why this split:** Titles and summaries are what developers see in book cards, shelf headers, and realm names. Realistic CJK text here immediately shows whether the UI handles multilingual content correctly. Descriptions and bodies are behind detail views — Lorem Ipsum is fine.

### Decision 4: Language distribution in generated data

`generateTranslations(type: UnitType)` returns an array of `{ language, title, ... }` objects. The number of translations per unit follows a probability distribution:

| Language | Probability | Rationale |
|----------|------------|-----------|
| `zh-hant` | 100% | Platform primary — every unit has this |
| `en` | ~70% | Common secondary language |
| `zh-hans` | ~40% | Significant portion |
| `ja` | ~20% | Occasional |
| `de` | ~10% | Rare |

Each language beyond `zh-hant` is independently rolled. A unit might end up with 1-5 translations. The `defaultLanguage` is always set to `zh-hant`.

**Why zh-hant at 100%:** It's the platform default. Every unit having a zh-hant translation ensures the default UI display path always works.

### Decision 5: Generator architecture refactor

Current: `generateTranslation(type)` returns a single `TranslationData` object.

New: `generateTranslations(type)` returns `TranslationData[]` (one per rolled language).

```ts
interface TranslationData {
  language: Language;
  title: string;
  subtitle?: string;
  summary?: string;
  description?: string;
}

function generateTranslations(type: UnitType): TranslationData[] {
  const result: TranslationData[] = [];

  // zh-hant always included
  result.push({
    language: LANGUAGES.ZH_HANT,
    ...pickFromCorpus(type, LANGUAGES.ZH_HANT),
  });

  // other languages by probability
  for (const [lang, prob] of LANG_DISTRIBUTION) {
    if (Math.random() < prob) {
      result.push({
        language: lang,
        ...pickFromCorpus(type, lang),
      });
    }
  }

  return result;
}
```

All entity seeders (books, shelves, realms, etc.) update from:
```ts
translations: { create: { language: "en", ...translation } }
```
to:
```ts
translations: { create: translations.map(t => ({ language: t.language, ... })) }
supportLanguages: { create: translations.map((t, i) => ({ language: t.language, isPrimary: i === 0, sortOrder: i })) }
```

## Risks / Trade-offs

**[Risk] Curated corpus runs out with large seed counts** → With 50 titles per language and 100 books, you'll see repetition in secondary languages. → Acceptable for seed data. Can expand corpus later if needed.

**[Risk] Snapshot misses a new infra entity added later** → If cross-seed adds new infrastructure types, the snapshot function must be updated. → Mitigated by keeping the snapshot logic in `database.ts` next to the reset logic, and documenting what constitutes "infrastructure."

**[Trade-off] Latin lorem for descriptions** → CJK descriptions would be more realistic, but generating paragraph-length Chinese/Japanese text either requires a curated corpus of descriptions (more maintenance) or a CJK lorem library (unmaintained ecosystem). The trade-off favors simplicity — descriptions are rarely scrutinized in seed data.

**[Trade-off] No new dependencies** → Using faker's built-in locale support rather than dedicated CJK text generators means person names and companies are well-localized, but `lorem.words()` still produces Latin text. The curated corpus compensates for the visible text fields.
