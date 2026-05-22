## 1. Inventory And Catalog Coverage

- [x] 1.1 Inventory legacy frontend callsites under `package/app/src`,
  `package/admin/src`, and `package/ui/src` that import `useTranslation`, call
  `translate`, destructure `t`, or pass fallback strings to translation calls.
- [x] 1.2 Extract all legacy product/domain message slugs from the inventory and
  compare them with `package/i18n/messages/*.json` and generated Paraglide
  exports.
- [x] 1.3 Add every missing product/domain message key to
  `package/i18n/messages/en.json`.
- [x] 1.4 Add every missing product/domain message key to
  `package/i18n/messages/zh-hant.json`, `zh-hans.json`, `ja.json`, and
  `de.json`.
- [x] 1.5 Run the `@rezics/i18n` Paraglide compile script and verify generated
  message functions exist for all newly added keys.

## 2. Static Callsite Migration

- [x] 2.1 Replace static `t("...")` product/domain copy in `package/app/src`
  with generated functions from `@rezics/i18n/messages`.
- [x] 2.2 Replace parameterized `t("...", params)` product/domain copy in
  `package/app/src` with generated functions that receive typed inputs.
- [x] 2.3 Replace static and parameterized `t("...")` product/domain copy in
  `package/admin/src` with generated functions from `@rezics/i18n/messages`.
- [x] 2.4 Verify `package/ui/src` keeps component-owned copy in
  `@rezics/ui/i18n/messages` and does not import product/domain messages.
- [x] 2.5 Replace callsites that only need active locale state with `useLocale`
  or runtime locale helpers instead of `useTranslation`.

## 3. Dynamic Slug Migration

- [x] 3.1 Replace provider, role, status, option, and other dynamic translation
  key callsites with typed slug-to-function maps.
- [x] 3.2 Move shared domain slug maps into `package/i18n/src/labels/` helpers
  when the slug belongs to contract/domain data.
- [x] 3.3 Keep feature-local slug maps near the feature when the slug is not a
  shared domain concept, using `satisfies Record<Slug, () => string>`.
- [x] 3.4 Add explicit unknown/default rendering paths for open-ended external
  strings before label lookup.

## 4. Legacy API Removal

- [x] 4.1 Remove frontend UI access to the `translate` runtime resolver from
  `package/i18n/src/index.ts` exports.
- [x] 4.2 Update `package/i18n/src/react.ts` so it exposes locale subscription
  behavior only and no longer returns `t`.
- [x] 4.3 Delete or reduce `package/i18n/src/translate.ts` after all internal
  callsites have migrated.
- [x] 4.4 Update `package/i18n/README.md` with the generated-function and typed
  slug-map patterns.

## 5. Convention Guards

- [x] 5.1 Extend repo convention checks to flag frontend `useTranslation` usage
  for UI copy.
- [x] 5.2 Extend convention checks to flag imports/calls of
  `@rezics/i18n` `translate`.
- [x] 5.3 Extend convention checks to flag fallback-string translation patterns
  such as `t("slug", "Fallback")`.
- [x] 5.4 Verify existing dynamic Paraglide bracket-access checks still allow
  typed slug-to-function maps.

## 6. Verification

- [x] 6.1 Run repo-wide searches confirming no migrated frontend source contains
  `useTranslation`, `translate(`, or legacy `t("...")` UI copy callsites.
- [x] 6.2 Run `bun run format` or `bun run format:check` after the migration.
- [x] 6.3 Run `bun run check:convention`.
- [x] 6.4 Run targeted tests for changed app/admin/i18n behavior.
- [x] 6.5 Run package-level type/build checks for affected frontend packages
  after Paraglide output is regenerated.
