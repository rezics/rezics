## Context

`@rezics/i18n` and `@rezics/ui` already compile Paraglide JSON catalogs into
generated message functions. App and admin locale state is shell-owned and fans
out to both runtimes. The remaining gap is a compatibility layer:
`package/i18n/src/translate.ts` maps legacy dotted keys to generated functions,
and `package/i18n/src/react.ts` exposes `useTranslation().t(...)` to app/admin
callers.

That bridge allows callsites to keep runtime string keys, fallback string
arguments, casts such as `as any`, and missing generated keys. It also keeps a
mental model where UI copy is resolved at runtime even though Paraglide is the
source of truth.

## Goals / Non-Goals

**Goals:**

- Make generated Paraglide message functions the only frontend UI translation
  API for static product/domain copy.
- Require every frontend UI message used by app/admin to exist in
  `package/i18n/messages/*.json` for every supported locale.
- Use typed slug-to-function maps for dynamic labels, with direct references to
  generated message functions visible in source.
- Remove fallback string parameters from migrated callsites.
- Keep locale synchronization behavior unchanged.
- Add convention coverage so legacy translation APIs do not return.

**Non-Goals:**

- Do not change the canonical locale set.
- Do not introduce a new i18n package, message format, or runtime dependency.
- Do not rewrite backend/domain APIs except where frontend label helpers need
  typed dynamic maps.
- Do not change `@rezics/ui` ownership rules; UI package messages remain in the
  UI catalog, while product/domain messages remain in `@rezics/i18n`.

## Decisions

### Generated functions are the default callsite API

Static UI copy will import generated functions from `@rezics/i18n/messages`:

```ts
import * as m from "@rezics/i18n/messages";

m.common_save();
m.book_hero_meta_chapter_count({ count });
```

This keeps message identity explicit, makes missing keys a compile-time error,
and removes fallback strings from component code.

Alternative considered: keep `translate("slug")` while banning the fallback
argument. That still preserves runtime string keys and weakens type checking, so
it does not complete the Paraglide cutover.

### Dynamic labels use typed slug-to-function maps

Dynamic rendering will normalize backend or UI slugs into a finite union and
dispatch through a static map:

```ts
const providerLabelBySlug = {
  github: m.auth_flow_providers_github,
  google: m.auth_flow_providers_google,
} as const satisfies Record<AuthProviderSlug, () => string>;

providerLabelBySlug[provider]();
```

For contract/domain enums, this pattern belongs in `@rezics/i18n` label helpers.
For feature-local UI slugs that are not shared domain concepts, the map may live
near the feature as long as it is typed and references generated functions
directly.

Alternative considered: use `m[computedName]()` after converting dots to
underscores. That bypasses tree-shaking and hides missing-key errors, so it
remains forbidden.

### Catalog completeness replaces fallback strings

Old fallback strings may be used only as migration seed data when adding JSON
message entries. After migration, components must not pass fallback strings at
render time. Every used product/domain message key must exist in each supported
locale file.

Alternative considered: keep English fallback parameters for partially
translated areas. That leaves missing catalog entries invisible and contradicts
the generated-message model.

### Locale state remains shell-owned

The change does not alter `setRezicsLocale` or shell fan-out to product/UI
runtimes. Components that only need the active locale should use the existing
locale subscription/runtime helpers instead of `useTranslation()`.

## Risks / Trade-offs

- Large internal diff -> Keep edits mechanical, grouped by feature, and avoid
  unrelated UI or copy refactors.
- Missing translations during migration -> Inventory all legacy keys, compare
  against JSON catalogs and generated exports, then compile before type checks.
- Dynamic slugs can be open-ended -> Unknown external strings must be narrowed
  to known unions before label lookup, with explicit unknown/default UI behavior
  where the product already has one.
- Generated output churn -> Edit only JSON catalogs by hand, then regenerate
  Paraglide output with the package script.

## Migration Plan

1. Inventory all frontend `useTranslation`, `translate`, and `t(...)` callsites
   under app/admin/UI package sources.
2. Add missing message keys to `package/i18n/messages/*.json` for all supported
   locales.
3. Regenerate `@rezics/i18n` Paraglide output.
4. Replace static callsites with direct generated message functions.
5. Replace dynamic callsites with typed slug-to-function maps or shared label
   helpers.
6. Remove the general legacy translation resolver from frontend-facing APIs.
7. Tighten convention checks and run format, convention, compile, and targeted
   tests.

Rollback is not expected because this is an internal development-stage cutover.
If needed, revert the change as a unit; partial rollback would reintroduce mixed
i18n APIs.

## Open Questions

None.
