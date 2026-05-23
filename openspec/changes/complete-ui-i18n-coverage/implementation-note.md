# Implementation Note

## Completed Foundation Pass

- Added canonical `ko` to `@rezics/contract`, both Paraglide project settings,
  product message catalogs, and UI message catalogs.
- Recorded the pre-fill catalog diff in `catalog-diff-before.md`.
- Completed exact message-key parity for `package/i18n/messages/*.json` and
  `package/ui/messages/*.json`.
- Regenerated Paraglide output with:
  - `bun --filter=@rezics/i18n run compile`
  - `bun --filter=@rezics/ui run i18n:compile`
- Removed unused admin-local locale files under `package/admin/src/locale/`.

## Verification Commands

- `bun --filter=@rezics/i18n run compile`
- `bun --filter=@rezics/ui run i18n:compile`
- `bun test package/contract/src/language.test.ts package/app/src/app/locale.test.ts package/admin/src/app/locale.test.ts`
- `bun test tool/scripts/i18n-catalog.test.ts`
- `bun run check:convention`

## Accepted Exclusions In This Pass

- The exact task search
  `rg "src/locale|@/locale|from .*locale|useTranslation|\\.t\\(" package/admin/src`
  still reports admin shell imports from `@/app/locale` and the locale test's
  local `./locale` import. These are locale-state helpers, not the removed
  admin-local message catalog.
- Newly filled `ko` values and missing `zh-hans`/`ja`/`de` values currently use
  the English base text where no existing localized value was present. They are
  explicit catalog entries, so missing keys no longer fall back at runtime.
- `package/app/src/playground/**`, `package/app/src/stories/**`, and
  `*.stories.tsx` were reviewed as demo-only surfaces. Remaining literals there
  are fixture names, Storybook controls, mock content, or playground safety
  probes, not production UI copy.
- Remaining broad app hard-coded-copy scan hits outside stories are technical
  literals or content placeholders: decorative empty `alt`, rating suffixes
  such as `/10`, `JSON` mode labels, MDX Storybook metadata, brand text
  `REZICS`, route/query keys, and playground-only theme demo labels.
- The fallback-string scan still reports content-data fallbacks, test/demo
  fixtures, placeholders for editable user/content fields, CSS/color fallback
  values, route defaults, protocol/MIME defaults, and technical sentinel text.
  Static UI-copy fallbacks found during the sweep were moved to catalog
  messages.
