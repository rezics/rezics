## 1. Package And Tooling Setup

- [ ] 1.1 Add Paraglide JS dependency and compile scripts for the shared product/domain i18n package.
- [ ] 1.2 Create the shared product/domain i18n package, likely `package/i18n`, with package exports for generated messages and runtime helpers.
- [ ] 1.3 Add a Paraglide project and JSON message source directory for `package/i18n`.
- [ ] 1.4 Add a Paraglide project and JSON message source directory for `package/ui` component-owned messages.
- [ ] 1.5 Configure TypeScript/package exports so consumers can import generated message functions and runtime helpers without deep generated paths.

## 2. Message Catalog Migration

- [ ] 2.1 Inventory existing `react-i18next` locale keys in `package/app/src/locale/`.
- [ ] 2.2 Convert app/admin product and domain translations into Paraglide-compatible JSON source files for all canonical locales.
- [ ] 2.3 Move reusable UI component-internal strings into the `package/ui` JSON message catalog.
- [ ] 2.4 Keep domain labels, feature copy, and contract-derived labels out of the `package/ui` message catalog.
- [ ] 2.5 Add placeholder English translations where non-English locale coverage is missing.

## 3. Locale Runtime Integration

- [ ] 3.1 Implement a shell-level locale synchronization helper that updates the product/domain i18n runtime and `@rezics/ui` i18n runtime from one active locale.
- [ ] 3.2 Replace app language provider initialization with Paraglide runtime initialization.
- [ ] 3.3 Replace admin language provider initialization with the shared product/domain i18n runtime.
- [ ] 3.4 Update language toggles to call the synchronization helper with canonical locale codes.
- [ ] 3.5 Preserve default locale `zh-hant` and fallback locale `en` behavior.

## 4. Frontend Callsite Migration

- [ ] 4.1 Replace `useTranslation()` and `t()` callsites in `package/app/src/` with generated product/domain message functions.
- [ ] 4.2 Replace `useTranslation()` and `t()` callsites in `package/admin/src/` with generated product/domain message functions.
- [ ] 4.3 Replace `useTranslation()` and `t()` callsites in `package/ui/src/` with generated UI message functions or explicit label props.
- [ ] 4.4 Add label override props for reusable UI components whose built-in translated text needs consumer overrides.
- [ ] 4.5 Move or wrap UI components that require Rezics domain labels so the portable UI surface remains domain-decoupled.

## 5. Dependency Cleanup

- [ ] 5.1 Remove frontend runtime imports from `react-i18next` across `package/{app,admin,ui,editor,folio}/src/`.
- [ ] 5.2 Remove obsolete `i18next` and `react-i18next` dependencies after all frontend callsites are migrated.
- [ ] 5.3 Remove obsolete TypeScript locale modules once Paraglide JSON catalogs are the source of truth.
- [ ] 5.4 Update documentation that references the old i18next resource structure.

## 6. Verification

- [ ] 6.1 Run Paraglide compile commands for product/domain and UI message catalogs.
- [ ] 6.2 Run repo-wide searches verifying no frontend runtime imports remain from `react-i18next`.
- [ ] 6.3 Run targeted tests for language toggle behavior and locale synchronization.
- [ ] 6.4 Run package-level TypeScript/build checks for affected frontend packages.
- [ ] 6.5 Run `bun run format:check` and `bun run check:convention`.
- [ ] 6.6 Verify translated UI component stories render with the expected locale in Storybook or documented local URLs.
