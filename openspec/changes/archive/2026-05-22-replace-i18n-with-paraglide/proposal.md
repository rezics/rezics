## Why

The current frontend i18n stack is split between app-level `react-i18next` usage and UI package components that directly import `react-i18next`, which makes `@rezics/ui` harder to share across multiple Rezics projects. Replacing the runtime i18n layer with Paraglide JS lets app and admin share product/domain translations while `@rezics/ui` owns only its component-internal messages through a type-safe, build-time generated message API.

A second pressure: `@rezics/contract` currently embeds `i18nKey: "entity.kind.person"` style strings on domain enums (entity kinds, licenses, subject attribution roles, credit roles). This pattern only works because `react-i18next` has a runtime `t(dynamicKey)` resolver, and it ships every translation in the bundle. Paraglide compiles messages into individual functions and does not have a first-class dynamic key lookup; the migration is the right moment to move the discriminator-to-label bridge out of contract and into the i18n package where it belongs.

The third pressure is admin: admin currently has zero i18n callsites precisely because there is no shared package to put them in. The migration unblocks admin i18n by carving out `@rezics/i18n` as a first-class workspace package consumed by both app and admin.

## Scope

This change covers the **i18n axis** of UI autonomy only. `@rezics/ui` still depends on `@rezics/server`, `@rezics/api`, `@rezics/contract` types, and `@tanstack/react-router` for non-i18n concerns. Full UI portability across multiple Rezics projects requires follow-up changes on those axes; this change is a necessary step but does not by itself make `@rezics/ui` standalone.

## What Changes

- **BREAKING** Replace the frontend `react-i18next` workflow with Paraglide JS generated message functions and locale runtimes.
- Introduce `@rezics/i18n` as the shared product/domain i18n package for app and admin translations.
- Give `@rezics/ui` its own Paraglide message project for UI component-internal strings such as ARIA labels, control labels, pagination labels, and generic empty states.
- Keep translation source files on the Paraglide/Inlang official JSON path; JSON5 is explicitly out of scope for this change.
- Make app/admin shells own the global active-locale state and synchronize that locale into both the product/domain i18n runtime and the UI package i18n runtime.
- Decouple `@rezics/ui` component messages from `@rezics/contract`, product/domain translation keys, and app/admin i18n catalogs.
- Replace contract `i18nKey` fields with explicit label maps in `@rezics/i18n`, guarded by `satisfies Record<EnumKey, () => string>` for exhaustiveness. Remove `i18nKey` from `@rezics/contract` after callsites migrate.
- Forbid dynamic Paraglide message lookup (`m[runtimeString]()`) as a project invariant; all dynamic discriminators resolve through explicit maps in `@rezics/i18n`.
- Migrate existing locale resources from TypeScript/i18next resources to Paraglide-compatible JSON message files.
- Preserve canonical language codes: `zh-hant`, `zh-hans`, `en`, `ja`, and `de`.
- Introduce an explicit shell-owned active-locale state in `package/app` (currently the language code is hardcoded to `zh-hant` in the i18next initializer).

## Capabilities

### New Capabilities

- `i18n-toolchain`: Defines the Paraglide-based package structure, locale ownership, generated message runtime expectations, source file format, and app/admin/UI synchronization rules.

### Modified Capabilities

- `multilingual-ui`: Replace `react-i18next` requirements with Paraglide message usage and shared active-locale behavior.
- `ui-component-foundation`: Define UI component message ownership rules so reusable UI components can translate their own generic text without importing product/domain i18n or contract definitions.

## Impact

- Affected packages:
  - `package/app`: migrate app provider setup, language switching, and product UI strings to Paraglide; introduce shell-owned active-locale state.
  - `package/admin`: adopt `@rezics/i18n` and active-locale synchronization; this is admin's first i18n integration.
  - `package/ui`: add a UI-local Paraglide project/runtime for component-internal messages and remove direct `react-i18next` usage.
  - `package/contract`: remove `i18nKey` fields from `entity.ts`, `license.ts`, `subject-attribution.ts`, and `credit-attribution.ts`; keep canonical language constants as the registry of valid language codes.
  - **New** `package/i18n` (`@rezics/i18n`): shared app/admin product and domain translation package. Owns the JSON message catalog, the generated Paraglide output, and the contract-enum → label maps (e.g. `entityKindLabel`, `licenseLabel`).
- Dependency impact:
  - Add `@inlang/paraglide-js` and Inlang project configuration where Paraglide messages are compiled.
  - Remove frontend runtime dependence on `react-i18next` and `i18next` after migration completes.
  - `@rezics/i18n` depends on `@rezics/contract` for enum key types; `@rezics/contract` does not depend on `@rezics/i18n`. The Paraglide output never imports from `@rezics/contract`.
- Backward compatibility:
  - Internal frontend imports and translation callsites are expected to change in one clear cutover because this project is still in development.
  - Existing user-facing language behavior should remain: default language is `zh-hant`, fallback language is `en`, and supported locales remain the canonical five-code set.
- Migration needs:
  - Convert existing app locale modules to JSON message files.
  - Replace `useTranslation()` and `t()` callsites with generated Paraglide message function imports.
  - Replace `t(domainObject.i18nKey)` callsites with the corresponding `@rezics/i18n` label function (e.g. `entityKindLabel(entity.kind)`).
  - Add locale synchronization helpers so app/admin language changes update both product/domain and UI message runtimes.
  - Add Storybook preview decorators for `@rezics/ui` so stories render with a known locale.
  - Ensure CI ordering: Paraglide compile MUST run before TypeScript checks so generated message functions exist.
