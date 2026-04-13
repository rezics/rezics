## Why

The current database reset (`seed:databaseReset`) wipes everything including cross-seeded infrastructure (users, content-type tags, default realm, EchoKV entries), forcing a manual `seed:cross` rerun before mock data can be re-seeded. This makes the reset-and-reseed cycle slow and error-prone. Additionally, all seed data is English-only — there is no multilingual content to test translation resolution, language toggles, or content fallback behavior. With the `contract-language-codes` change establishing canonical language codes, the seed infrastructure needs to produce realistic multilingual data.

## What Changes

- **Rename `databaseReset.ts` → `database-reset.ts`** in `package/server/prisma/seed/utils/` and update the corresponding `package.json` script.
- **Smart reset with infrastructure preservation**: The default `database-reset` behavior SHALL query cross-seeded infrastructure (4 seed users, 5 content-type tags, default realm, infra EchoKV entries) before wiping, then reinsert them after the reset. This eliminates the need to rerun `seed:cross` between resets.
- **`--all` CLI flag**: When passed, `database-reset --all` performs a full wipe with no preservation (current behavior). JSDoc added with usage description.
- **Multilingual seed generators (Option C: Hybrid)**: Replace English-only `generateTranslation()` with a multilingual generator that produces translations in multiple canonical languages per unit. Uses curated text corpus for titles/summaries (visible in UI) and faker locale instances for structured data (person names, company names). Language distribution: 100% `zh-hant`, ~70% `en`, ~40% `zh-hans`, ~20% `ja`, ~10% `de`.
- **Curated text corpus**: New `seed/mock/data/text/` directory with per-language title and description pools for realistic CJK/multilingual content.
- **Faker locale instances**: Per-language faker instances (`fakerZH_TW`, `fakerZH_CN`, `fakerJA`, `fakerDE`) for generating localized person names, company names, and structured data.

## Capabilities

### New Capabilities
- `database-reset-preserve`: Smart database reset that preserves cross-seeded infrastructure by default, with `--all` flag for full wipe. Includes JSDoc with usage description.
- `multilingual-seed-generators`: Multilingual text generation using the hybrid approach — curated text corpus for titles/summaries plus faker locale instances for structured data. Produces realistic multilingual seed data across all 5 canonical languages.

### Modified Capabilities
- `infra-seed`: Cross-seeded infrastructure (users, tags, realm, EchoKV) now uses canonical language codes from `@rezics/contract` for translation records. Content-type tag and realm translations use `DEFAULT_LANGUAGE` instead of hardcoded `"en"`.

## Impact

**Affected packages:**
- `package/server` — seed files under `prisma/seed/` (reset, generators, all entity seeders), `package.json` script rename
- `tool/seed/` — cross-seed infrastructure updates to use canonical language codes

**Dependencies:**
- Depends on `contract-language-codes` for canonical code imports (`LANGUAGES`, `DEFAULT_LANGUAGE`, `Language` type)
- `@faker-js/faker` already at v10 — no new dependencies needed (locale-specific imports are built-in)

**Backward compatibility:** The `seed:databaseReset` script name changes to `seed:database-reset`. No production impact — seed scripts are dev-only tooling.
