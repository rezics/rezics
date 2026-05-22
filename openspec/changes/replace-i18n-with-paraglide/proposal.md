## Why

The current frontend i18n stack is split between app-level `react-i18next` usage and UI package components that directly import `react-i18next`, which makes `@rezics/ui` harder to share across multiple Rezics projects. Replacing the runtime i18n layer with Paraglide JS lets app and admin share product/domain translations while `@rezics/ui` owns only its component-internal messages through a type-safe, build-time generated message API.

## What Changes

- **BREAKING** Replace the frontend `react-i18next` workflow with Paraglide JS generated message functions and locale runtimes.
- Introduce a shared product/domain i18n package for app and admin translations.
- Give `@rezics/ui` its own Paraglide message project for UI component-internal strings such as ARIA labels, control labels, pagination labels, and generic empty states.
- Keep translation source files on the Paraglide/Inlang official JSON path; JSON5 is explicitly out of scope for this change.
- Make app/admin shells own the global active-locale state and synchronize that locale into both the product/domain i18n runtime and the UI package i18n runtime.
- Decouple `@rezics/ui` component messages from `@rezics/contract`, product/domain translation keys, and app/admin i18n catalogs.
- Migrate existing locale resources from TypeScript/i18next resources to Paraglide-compatible JSON message files.
- Preserve canonical language codes: `zh-hant`, `zh-hans`, `en`, `ja`, and `de`.

## Capabilities

### New Capabilities

- `i18n-toolchain`: Defines the Paraglide-based package structure, locale ownership, generated message runtime expectations, source file format, and app/admin/UI synchronization rules.

### Modified Capabilities

- `multilingual-ui`: Replace `react-i18next` requirements with Paraglide message usage and shared active-locale behavior.
- `ui-component-foundation`: Define UI component message ownership rules so reusable UI components can translate their own generic text without importing product/domain i18n or contract definitions.

## Impact

- Affected packages:
  - `package/app`: migrate app provider setup, language switching, and product UI strings to Paraglide.
  - `package/admin`: adopt the shared product/domain i18n package and active-locale synchronization.
  - `package/ui`: add a UI-local Paraglide project/runtime for component-internal messages and remove direct `react-i18next` usage.
  - `package/contract`: keep canonical language constants as the registry of valid language codes; do not use contract DTOs or domain registries for UI-local messages.
  - New package likely named `package/i18n`: shared app/admin product and domain translation package.
- Dependency impact:
  - Add `@inlang/paraglide-js` and Inlang project configuration where Paraglide messages are compiled.
  - Remove frontend runtime dependence on `react-i18next` and `i18next` after migration completes.
- Backward compatibility:
  - Internal frontend imports and translation callsites are expected to change in one clear cutover because this project is still in development.
  - Existing user-facing language behavior should remain: default language is `zh-hant`, fallback language is `en`, and supported locales remain the canonical five-code set.
- Migration needs:
  - Convert existing app locale modules to JSON message files.
  - Replace `useTranslation()` and `t()` callsites with generated Paraglide message function imports.
  - Add locale synchronization helpers so app/admin language changes update both product/domain and UI message runtimes.
