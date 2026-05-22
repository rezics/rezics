## Why

The Paraglide migration left a compatibility bridge that still lets app and
admin code render UI copy through legacy string keys such as
`t("book.hero.kind.book", "Book")`. That keeps fallback strings and missing
catalog entries alive even though messages now compile into explicit Paraglide
functions.

This change completes the cutover: frontend UI copy should be statically backed
by generated message functions, and dynamic labels should dispatch through typed
slug-to-function maps rather than runtime translation keys.

## What Changes

- **BREAKING** Remove frontend support for `useTranslation().t(...)` and
  `translate(key, fallback)` as UI translation APIs.
- Replace app and admin callsites that use legacy string keys with generated
  Paraglide message functions from `@rezics/i18n/messages`.
- Replace dynamic translation-key rendering with explicit slug-to-function maps
  typed with `satisfies Record<Slug, MessageFn>`.
- Complete the product message catalog so every migrated frontend callsite has a
  concrete key in all supported locales.
- Remove fallback string arguments from frontend UI translation callsites.
- Keep locale state APIs for app/admin shell synchronization, but stop exposing a
  general runtime translation resolver for UI copy.
- Add or tighten convention checks so new legacy `t(...)`, `translate(...)`,
  fallback string, and dynamic Paraglide bracket-access patterns are rejected.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `i18n-toolchain`: frontend UI copy must use generated Paraglide functions or
  typed slug-to-function maps; legacy string-key runtime translation and
  fallback string parameters are forbidden.

## Impact

- Affected packages: `package/i18n`, `package/app`, `package/admin`,
  `package/ui`, and repo convention tooling.
- `package/i18n/messages/*.json` will gain missing product/domain message keys
  across `zh-hant`, `zh-hans`, `en`, `ja`, and `de`.
- `package/i18n/src/paraglide/messages/*` will be regenerated from the updated
  catalog.
- `package/app/src` and `package/admin/src` will be migrated away from
  `useTranslation().t(...)`.
- Existing domain label helpers in `package/i18n/src/labels/` remain the model
  for backend-driven discriminator values; additional typed maps may be added
  for non-contract dynamic UI slugs.
- Backward compatibility is intentionally not preserved for frontend UI
  translation callsites. Internal callsites must migrate in the same change.
