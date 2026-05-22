## Context

Rezics frontend i18n is split between compiled Paraglide catalogs and legacy
local UI copy:

- `package/i18n` owns product/domain messages consumed by app and admin.
- `package/ui` owns reusable component-internal messages.
- `package/app` already imports many generated `@rezics/i18n/messages`
  functions, but still contains hard-coded UI copy in pages, feature components,
  stories, labels, placeholders, tooltips, and accessibility attributes.
- `package/admin` initializes the shared i18n runtime but still has
  `package/admin/src/locale/*.ts` and many hard-coded labels.
- `package/contract/src/language.ts` defines five canonical languages:
  `zh-hant`, `zh-hans`, `en`, `ja`, and `de`.
- `package/i18n/messages/en.json` and `zh-hant.json` contain substantially more
  keys than `zh-hans`, `ja`, and `de`, so the current locale set is runtime
  supported but not catalog-complete.

The target state is a single compiled UI-copy model:

```txt
package/contract
  LANGUAGES = zh-hant | zh-hans | en | ja | de | ko
          │
          ▼
package/i18n                package/ui
  product/domain messages     generic component messages
  six complete JSON files      six complete JSON files
          │                         │
          └──────────────┬──────────┘
                         ▼
              app/admin shell locale state
                         │
                         ▼
            generated message functions only
```

## Goals / Non-Goals

**Goals:**

- Add Korean as canonical UI locale `ko`.
- Make `@rezics/i18n` and `@rezics/ui` locale lists match the contract language
  registry.
- Require exact message key parity across all supported locale JSON files.
- Migrate admin UI copy to `@rezics/i18n` in one clear cutover.
- Remove the admin-local locale files and consumers.
- Sweep app/admin UI copy callsites comprehensively, including visible text,
  labels, placeholders, title attributes, alt text, aria labels, tooltips, empty
  states, error states, toast/alert text, dialog copy, table headers, tabs,
  route/page titles, and validation messages.
- Forbid UI fallback strings and dynamic message lookup for app/admin/UI copy.
- Add checks that make missing keys, locale-list drift, and fallback callsites
  fail in development or CI.

**Non-Goals:**

- Changing content/catalog translation fallback chains for `UnitTranslation`,
  book/entity/shelf display data, or user-generated content.
- Translating database content or seed data beyond UI-copy fixtures needed for
  tests/stories.
- Introducing runtime `i18next`, `react-i18next`, string-key resolvers, or a
  new translation file format.
- Adding regional Korean variants such as `ko-KR`; `ko` is the canonical locale
  for this change.

## Decisions

### Decision 1: Use `ko`, not `ko-KR` or `kr`

`ko` becomes the canonical Korean language code in `@rezics/contract`,
Paraglide project settings, message file names, and language controls.

Alternatives considered:

- `kr`: rejected because it is a region/country-oriented abbreviation, not the
  canonical language code.
- `ko-KR`: rejected because Rezics does not currently model regional Korean UI
  variants. A regional code can be introduced later only if a real product need
  appears.

### Decision 2: Treat UI copy catalogs as complete, not fallback-backed

Every source message key in `package/i18n/messages/en.json` must exist in
`zh-hant`, `zh-hans`, `ja`, `de`, and `ko`. The same key-parity rule applies to
`package/ui/messages/*.json`.

Missing native-quality translations may temporarily use a reviewed placeholder
translation in the target locale file, but the callsite must still resolve
through a generated message function. There is no runtime fallback string at the
callsite.

Alternatives considered:

- Keep English runtime fallback for incomplete locales: rejected because it
  hides missing translation work and contradicts the compiled i18n model.
- Permit callsite fallback only in admin: rejected because admin would remain
  the largest source of drift.

### Decision 3: Admin migrates in one cutover

`package/admin/src/locale/*.ts` and any associated local translation access
patterns are removed in the same implementation. Admin pages and components use
generated `@rezics/i18n/messages` functions and shared label helpers.

Alternatives considered:

- Bridge admin local locale files into `@rezics/i18n`: rejected because it keeps
  duplicate message identity and makes future full-locale enforcement harder.
- Migrate admin page-by-page across multiple changes: rejected because this
  repo is still development-stage and the project instruction prefers clear
  internal cutovers.

### Decision 4: Static message dispatch remains the only UI-copy API

Static UI copy uses direct generated functions:

```ts
import * as m from "@rezics/i18n/messages";

m.common_save();
```

Runtime-selected labels use explicit maps whose values are generated message
functions:

```ts
const STATUS_LABEL = {
  active: m.admin_status_active,
  inactive: m.admin_status_inactive,
} as const satisfies Record<Status, () => string>;
```

Dynamic `m[key]()` access and fallback string arguments remain forbidden.

### Decision 5: Hard-coded sweep is broad but UI-focused

The migration should inspect app/admin source for:

- JSX text nodes.
- `placeholder`, `aria-label`, `title`, and meaningful `alt` attributes.
- shadcn/dialog/table/tabs/tooltip/dropdown/select labels.
- page titles and route metadata.
- toast, alert, `ErrorBoundary`, validation, and empty/loading/error states.
- static arrays/objects that feed labels into UI.

The sweep should exclude:

- Test names and internal debug strings unless rendered as UI.
- Storybook-only explanatory copy unless it is part of a component's public UI
  example.
- Brand names, protocol literals, examples such as `https://...`, enum values
  that are intentionally technical, and user/content data.
- Content translation fallback helpers.

### Decision 6: Checks enforce the cutover

The implementation should add or extend repo convention checks to cover:

- Contract language registry parity with `package/i18n` and `package/ui`
  Paraglide settings.
- Existence of `messages/<locale>.json` for every supported locale.
- Exact message key parity across locale files in each package.
- No admin-local locale files or imports.
- No `react-i18next`/`i18next` UI-copy runtime usage.
- No UI fallback string arguments such as `t("key", "Text")`.
- No dynamic generated message lookup such as `m[runtimeKey]()`.

The hard-coded UI copy scan can initially be a candidate-producing convention
check if a perfectly precise AST rule is too costly, but the final migration
tasks must drive candidate counts to zero or document intentional exclusions.

## Risks / Trade-offs

- [Risk] The migration is large and touches many UI files. -> Mitigation:
  implement by package/feature slices, run typecheck and convention checks after
  each slice, and keep changes limited to copy/i18n plumbing.
- [Risk] Machine or placeholder translations may be semantically weak. ->
  Mitigation: keep English source authoritative, preserve parameters exactly,
  and allow later copy polish without changing callsites.
- [Risk] Message key names become inconsistent during a large sweep. ->
  Mitigation: group keys by domain/feature prefix and reuse existing key naming
  patterns in `package/i18n/messages/en.json`.
- [Risk] Story/test fixture copy inflates scope. -> Mitigation: prioritize
  production app/admin source first, then decide which stories render real UI
  surfaces and which can be excluded from convention checks.
- [Risk] Adding `ko` to the contract language schema widens API validation. ->
  Mitigation: update generated/compiled consumers in the same change and run
  contract/server/app/admin type checks.

## Migration Plan

1. Update the contract language registry to include `ko`.
2. Update Paraglide project settings in `package/i18n` and `package/ui`.
3. Add `ko.json` to both message packages.
4. Fill missing keys so every supported locale file has the same keys as its
   package base locale.
5. Compile Paraglide outputs for `@rezics/i18n` and `@rezics/ui`.
6. Add locale/key-parity and forbidden-callsite checks.
7. Migrate admin from local locale files to `@rezics/i18n`.
8. Delete admin-local locale files and imports.
9. Sweep app hard-coded UI copy and fallback callsites.
10. Sweep admin hard-coded UI copy and fallback callsites.
11. Run format, convention checks, targeted tests, and type checks.

Rollback is source-level revert of the change. Because this is a development
stage internal cutover and does not introduce data migration, no runtime dual
write/read compatibility path is planned.

## Open Questions

- None for the proposal. Copy quality review can happen during implementation,
  but it should not change the architecture: UI copy must remain catalog-backed
  in all six locales.
