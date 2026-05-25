## 1. Adapter Core

- [x] 1.1 Replace `package/i18n/src/react.ts` with a neutral locale store that exports `getLocale`, `setLocale`, `subscribeLocale`, `useLocale`, and `useSetLocale` without importing generated messages or UI package code.
- [x] 1.2 Implement canonical locale normalization in the adapter using `@rezics/contract` language constants and preserve the current `lang` localStorage persistence behavior.
- [x] 1.3 Implement `registerParaglideRuntime()` so app/admin can register `@rezics/i18n/runtime` and `@rezics/ui/i18n/runtime`, capturing original runtime setters before overwriting runtime get/set hooks.
- [x] 1.4 Implement `useMessage(messageBag)` with typed `m.<message>()` wrappers that pass the current locale explicitly through Paraglide message options.
- [x] 1.5 Add adapter TypeScript helper types for no-input messages, required-input messages, optional-input messages, and message options.
- [x] 1.6 Export only the adapter API from `@rezics/i18n/react`; do not export generated message namespaces or registries from this subpath.

## 2. Adapter Tests

- [x] 2.1 Add unit tests for `setLocale`, `getLocale`, `subscribeLocale`, invalid locale handling, and persisted locale initialization.
- [x] 2.2 Add runtime registration tests proving product and UI Paraglide runtimes both update when adapter locale changes.
- [x] 2.3 Add a test proving a direct registered runtime `setLocale()` call updates the adapter locale and notifies subscribers exactly once.
- [x] 2.4 Add React tests for `useMessage()` rerendering when locale changes.
- [x] 2.5 Add type-level tests or compile fixtures proving `useMessage()` preserves generated message input requirements.
- [x] 2.6 Verify with a temporary bundle/tree-shaking fixture that imports `useMessage()` and one generated message, then confirms unrelated generated message text or keys are absent from the bundle.

## 3. App/Admin Bootstrap

- [x] 3.1 Replace `package/app/src/app/locale.ts` with shared adapter initialization or remove it after callsites migrate.
- [x] 3.2 Register product/domain and UI Paraglide runtimes during app bootstrap before translated UI renders.
- [x] 3.3 Update app language controls to call the shared adapter `setLocale()` instead of shell-local `setRezicsLocale()`.
- [x] 3.4 Replace `package/admin/src/app/locale.ts` with shared adapter initialization or remove it after callsites migrate.
- [x] 3.5 Register product/domain and UI Paraglide runtimes during admin bootstrap before translated UI renders.
- [x] 3.6 Update admin settings language control to call the shared adapter `setLocale()`.
- [x] 3.7 Preserve document `lang` and `dir` updates through an adapter-aware provider or app/admin root effect.

## 4. UI Package Migration

- [x] 4.1 Add `@rezics/i18n` as an explicit UI package dependency or peer dependency as required for importing the neutral `@rezics/i18n/react` subpath.
- [x] 4.2 Migrate `package/ui/src/composite/forms/field/PasswordField.tsx` to named UI message imports, a module-scope message bag, and `useMessage()`.
- [x] 4.3 Migrate `package/ui/src/composite/pagination/Pagination.tsx` to named UI message imports, a module-scope message bag, and `useMessage()`.
- [x] 4.4 Search `package/ui/src/` for remaining generated message namespace imports and migrate production component callsites to `useMessage()`.
- [x] 4.5 Ensure UI components with host string override props keep overrides host-owned while defaults remain dynamically localized.
- [x] 4.6 Update UI Storybook or shared Storybook configuration so UI stories register the UI runtime and can demonstrate dynamic locale changes.

## 5. App React Migration

- [x] 5.1 Run a repo search for `import * as m from "@rezics/i18n/messages"` under `package/app/src/` and inventory production React callsites.
- [x] 5.2 Migrate app layout, header, footer, navigation, and core shared components to named message imports, module-scope message bags, and `useMessage()`.
- [x] 5.3 Migrate app route pages and feature sections to named message imports, module-scope message bags, and `useMessage()`.
- [x] 5.4 Migrate app dialog, form, toast, error, loading, empty-state, accessibility, placeholder, and tooltip copy to `useMessage()`.
- [x] 5.5 Convert app module-scope configs and option arrays that store localized strings to store generated message functions or descriptors, resolving them through `useMessage()` during render.
- [x] 5.6 Update app tests that asserted direct generated message calls so they initialize the adapter or use named message functions as appropriate.
- [x] 5.7 Remove remaining production app direct generated message namespace imports after migration.

## 6. Admin React Migration

- [x] 6.1 Run a repo search for `import * as m from "@rezics/i18n/messages"` under `package/admin/src/` and inventory production React callsites.
- [x] 6.2 Migrate admin layout, navigation, settings, auth, dashboard, and shared table/list components to named message imports, module-scope message bags, and `useMessage()`.
- [x] 6.3 Migrate admin feature pages for entity, unit, user, token, Meili, authority, JWT service, shelf, realm, and system health surfaces to `useMessage()`.
- [x] 6.4 Convert admin module-scope configs and option arrays that store localized strings to store generated message functions or descriptors, resolving them through `useMessage()` during render.
- [x] 6.5 Update admin tests that asserted direct generated message calls so they initialize the adapter or use named message functions as appropriate.
- [x] 6.6 Remove remaining production admin direct generated message namespace imports after migration.

## 7. Conventions and Documentation

- [x] 7.1 Extend `bun run check:convention` to reject production React imports of generated message namespaces from `@rezics/i18n/messages`, `@rezics/ui/i18n/messages`, or generated `paraglide/messages` files.
- [x] 7.2 Extend convention checks to reject adapter imports from generated message catalogs or package-local message registries.
- [x] 7.3 Extend convention checks to reject dynamic generated message lookup such as `m[runtimeKey]()` in production source.
- [x] 7.4 Update `package/i18n/README.md` to document `useMessage(messageBag)`, the local `m.xxx()` form, tree-shaking rules, and runtime registration.
- [x] 7.5 Update UI package documentation or Storybook notes to describe UI-owned message bags and dynamic locale behavior.
- [x] 7.6 Document the allowed `@rezics/ui` dependency on the neutral `@rezics/i18n/react` subpath in the relevant package-boundary guidance.

## 8. Verification

- [x] 8.1 Run `bun --filter=@rezics/i18n run compile` and `bun --filter=@rezics/ui run i18n:compile`.
- [x] 8.2 Run targeted adapter, app locale, admin locale, and UI component tests.
- [x] 8.3 Run `bun run format:check`.
- [x] 8.4 Run `bun run check:convention`.
- [x] 8.5 Run `bun --filter=@rezics/app run build`.
- [x] 8.6 Run `bun --filter=@rezics/admin run build`.
- [ ] 8.7 Verify app dynamic language switching manually for shell navigation, route content, and imported UI components.
- [ ] 8.8 Verify admin dynamic language switching manually for settings, navigation, table/list pages, and imported UI components.
