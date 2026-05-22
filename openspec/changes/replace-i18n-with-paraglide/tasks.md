## 1. Package And Tooling Setup

- [x] 1.1 Add `@inlang/paraglide-js` dependency and compile scripts for `@rezics/i18n`.
- [x] 1.2 Scaffold `package/i18n/` as the `@rezics/i18n` workspace package with `package.json`, exports map, and TypeScript config.
- [x] 1.3 Add a Paraglide project (`project.inlang/`) and JSON message source directory for `@rezics/i18n`.
- [x] 1.4 Add a Paraglide project and JSON message source directory for `package/ui` component-owned messages.
- [x] 1.5 Configure package exports so consumers import generated message functions and runtime helpers without deep generated paths.
- [x] 1.6 Add a Storybook preview decorator in `@rezics/ui` that initializes the UI Paraglide runtime and exposes a locale switcher in the toolbar.
- [x] 1.7 Wire Paraglide compile into the build pipeline so generated output exists before `tsc`. Add compile to `postinstall` and to the dev/build scripts of any package consuming Paraglide output.

## 2. Message Catalog Migration

- [x] 2.1 Inventory existing `react-i18next` locale keys in `package/app/src/locale/`.
- [x] 2.2 Convert app/admin product and domain translations into Paraglide-compatible JSON source files under `package/i18n/messages/` for all canonical locales.
- [x] 2.3 Move reusable UI component-internal strings into the `package/ui` JSON message catalog.
- [x] 2.4 Keep domain labels, feature copy, and contract-derived labels out of the `package/ui` message catalog.
- [x] 2.5 Add placeholder English translations where non-English locale coverage is missing.
- [x] 2.6 Author contract-enum label maps in `@rezics/i18n` for `EntityKind`, `License`, `SubjectAttributionRole`, and `CreditRole`. Each map is `as const satisfies Record<EnumKey, () => string>` and exposes a thin `<enum>Label(key)` helper (e.g. `entityKindLabel`, `licenseLabel`).
- [x] 2.7 Ensure JSON messages exist for every contract enum case (e.g. `entity_kind_person`, `license_cc_by_4_0`, …) across all five locales.

## 3. Locale Runtime Integration

- [x] 3.1 Implement a shell-level `setRezicsLocale(locale)` helper in `package/app/src/app/` that updates the `@rezics/i18n` runtime and the `@rezics/ui` i18n runtime from one active locale, using `{ reload: false }`.
- [x] 3.2 Introduce shell-owned active-locale state in `package/app` (current `lng: "zh-hant"` in `package/app/src/app/providers/i18n.ts` is hardcoded; replace with state read from persistence + URL where applicable).
- [x] 3.3 Replace app language provider initialization with Paraglide runtime initialization.
- [x] 3.4 Replace admin language provider initialization with the `@rezics/i18n` runtime; this is admin's first i18n integration.
- [x] 3.5 Update language toggles to call `setRezicsLocale` with canonical locale codes.
- [x] 3.6 Preserve default locale `zh-hant` and fallback locale `en` behavior.

## 4. Frontend Callsite Migration

- [x] 4.1 Replace `useTranslation()` and `t(key)` callsites in `package/app/src/` with generated product/domain message functions.
- [x] 4.2 Replace `useTranslation()` and `t(key)` callsites in `package/admin/src/` with generated product/domain message functions.
- [x] 4.3 Replace `useTranslation()` and `t(key)` callsites in `package/ui/src/` with generated UI message functions or explicit label props (currently affects `PasswordField.tsx`, `Pagination.tsx`).
- [x] 4.4 Replace `t(x.i18nKey)` callsites with `<enum>Label(x.key)` from `@rezics/i18n` for entity kind, license, subject attribution role, and credit role usages.
- [x] 4.5 Add label override props for reusable UI components whose built-in translated text needs consumer overrides.
- [x] 4.6 Move or wrap UI components that require Rezics domain labels so the portable UI surface remains domain-decoupled.

## 5. Dependency Cleanup

- [x] 5.1 Remove frontend runtime imports from `react-i18next` across `package/{app,admin,ui,editor,folio}/src/`.
- [x] 5.2 Remove `i18nKey` fields from `package/contract/src/{entity,license,subject-attribution,credit-attribution}.ts` after callsites migrate.
- [x] 5.3 Remove obsolete `i18next` and `react-i18next` dependencies after all frontend callsites are migrated.
- [x] 5.4 Remove obsolete TypeScript locale modules under `package/app/src/locale/` once Paraglide JSON catalogs are the source of truth.
- [ ] 5.5 Update documentation that references the old i18next resource structure.

## 6. Invariants And Tooling

- [x] 6.1 Add a convention check (or ESLint rule) that flags dynamic Paraglide access patterns: `m[runtimeString]()`, template-literal computed keys, or destructuring `m` into a runtime variable.
- [x] 6.2 Add a convention check that flags any remaining `t(*.i18nKey)` callsites or any new `i18nKey` field introduced on contract domain objects.
- [x] 6.3 Document the `@rezics/i18n` label-map pattern in `package/i18n/README.md` so future contract enums adopt the same shape.

## 7. Verification

- [x] 7.1 Run Paraglide compile commands for `@rezics/i18n` and `@rezics/ui` message catalogs.
- [x] 7.2 Run repo-wide searches verifying no frontend runtime imports remain from `react-i18next` and no `i18nKey` references remain in `package/contract/src/`.
- [x] 7.3 Run targeted tests for language toggle behavior and locale synchronization across `@rezics/i18n` and `@rezics/ui` runtimes.
- [ ] 7.4 Run package-level TypeScript/build checks for `@rezics/i18n`, `@rezics/ui`, `@rezics/app`, `@rezics/admin`, and `@rezics/contract`.
- [ ] 7.5 Run `bun run format:check`, `bun run check:convention`, and `bun run knip`.
- [ ] 7.6 Verify translated UI component stories render with the expected locale in Storybook via the new preview decorator.
- [ ] 7.7 Smoke-test the language toggle in `bun run dev` for both app and admin shells; confirm both `@rezics/i18n` and `@rezics/ui` text update together.
