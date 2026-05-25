## Why

Rezics currently updates Paraglide runtime locale state without giving React
components a tree-shake-safe subscription model, so dynamic language switching
is unreliable across app, admin, and reusable `@rezics/ui` components. Because
the project is still in development, we should perform a full migration to the
final React i18n API instead of preserving legacy direct message calls.

## What Changes

- Add a React i18n adapter that provides a shared active-locale store,
  Paraglide runtime registration, and a `useMessage()` hook.
- Standardize React UI rendering on the first `m.xxx()` form:
  components call `const m = useMessage(messageBag)` and render
  `m.message_name(inputs?)`.
- Preserve Paraglide tree shaking by requiring message functions to be imported
  explicitly at each callsite or stored in explicit feature-local message bags.
- Support `@rezics/ui` package-owned messages by allowing reusable UI components
  to import the neutral `@rezics/i18n/react` adapter while importing their own
  generated UI message functions from the UI package.
- Move app/admin locale initialization and language switching onto the shared
  adapter, registering both the product/domain Paraglide runtime and the UI
  Paraglide runtime.
- **BREAKING**: Production React code in app, admin, and UI packages must no
  longer render user-visible UI copy through direct `m.xxx()` calls from a
  generated message namespace. Message calls in React render paths must go
  through `useMessage()`.
- **BREAKING**: Shell-local duplicated locale helpers are replaced by the shared
  adapter API.

## Capabilities

### New Capabilities

- `react-i18n-adapter`: Defines the tree-shake-safe React binding for Paraglide
  messages, active-locale subscriptions, runtime registration, and multi-package
  dynamic language switching.

### Modified Capabilities

- `i18n-toolchain`: Changes the active-locale owner from app/admin shell-local
  helpers to the shared React adapter, and replaces direct React render
  message calls with `useMessage()` message bags.
- `ui-package-autonomy`: Allows `@rezics/ui` to depend on the neutral
  `@rezics/i18n/react` adapter for locale reactivity while still forbidding
  imports of product/domain messages or app/admin shell code.

## Impact

- Affected packages:
  - `package/i18n`: new React adapter exports, runtime registration API,
    locale store, `useMessage()` hook, and tests.
  - `package/ui`: UI components with internal copy migrate to UI-owned message
    bags and `useMessage()`; UI Storybook/bootstrap registers the UI runtime.
  - `package/app`: language controls, app initialization, providers, and all
    React UI copy callsites migrate to the shared adapter and `m.xxx()` message
    bags.
  - `package/admin`: same migration as app for admin surfaces and settings.
  - `package/storybook-config`: shared Storybook setup registers locale runtime
    state for package stories that render translated UI.
  - convention checks: add or extend checks that reject direct generated
    namespace message calls in React render paths, runtime-key lookup, and
    adapter imports that would pull full message catalogs.
- Backward compatibility:
  - Existing generated message functions remain the translation source of
    truth.
  - Existing direct Paraglide runtime exports remain available for non-React
    integration points, but React UI copy must migrate to `useMessage()`.
  - The migration is an internal development-stage cutover; no legacy React
    rendering API is preserved for production UI code.
