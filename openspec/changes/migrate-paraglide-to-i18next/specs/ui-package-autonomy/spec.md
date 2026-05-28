## MODIFIED Requirements

### Requirement: UI package SHALL use the shared neutral i18n React adapter

`@rezics/ui` SHALL use the shared neutral `@rezics/i18n/react` adapter for active-locale subscriptions and translation lookup, and SHALL NOT introduce a competing i18n runtime. That adapter subpath SHALL remain neutral: it SHALL NOT import app/admin shell code, routers, API clients, namespace JSON files, or `@rezics/ui/locales/*` modules.

#### Scenario: UI component imports the adapter

- **WHEN** a reusable UI component needs dynamic localization for
  component-internal copy
- **THEN** it MAY import `useTranslation` re-exported from
  `@rezics/i18n/react`
- **AND** it SHALL reference keys via `t('ui:<key>')`

#### Scenario: UI package avoids product namespaces

- **WHEN** source under `package/ui/src/` is inspected
- **THEN** it SHALL NOT call `useTranslation('<ns>')` for any
  namespace other than `'ui'` (or aggregate hooks that include `'ui'`)
- **AND** it SHALL NOT import app/admin locale helpers

### Requirement: UI package ships per-locale ES modules

`@rezics/ui` SHALL ship its translations as per-locale ES modules at
`package/ui/locales/{locale}.ts`. Each module SHALL default-export the
`ui` namespace's translation object for one locale. The UI package
SHALL expose a `registerUiLocale(i18n, locale)` helper that dynamically
imports the requested locale's module and calls
`i18n.addResourceBundle(locale, 'ui', messages, true, true)`.

#### Scenario: Consumer registers the UI locale

- **WHEN** a consumer app's bootstrap calls
  `await registerUiLocale(i18n, i18n.language)` from
  `@rezics/ui/i18n`
- **THEN** the helper SHALL dynamically import the locale's module
- **AND** the `ui` namespace SHALL be available for that locale via
  `i18next.t('ui:<key>')`

#### Scenario: UI package adds a new locale independently

- **WHEN** `@rezics/ui` adds a new locale by introducing a new
  `package/ui/locales/<new-locale>.ts` module and publishing a new
  package version
- **THEN** consumer apps SHALL pick up the new locale by upgrading
  the package version
- **AND** consumer apps SHALL NOT need any code change to support
  the new locale beyond updating the version

#### Scenario: Consumer ships only the locales it needs

- **WHEN** a consumer app supports only `en` and `zh-hant`
- **THEN** the consumer's bundler SHALL ship only the
  `package/ui/locales/en.ts` and `package/ui/locales/zh-hant.ts`
  modules via dynamic import code splitting
- **AND** locale modules for other locales SHALL NOT appear in the
  consumer's production bundle

### Requirement: Core UI export surfaces avoid host runtime imports

The following `@rezics/ui` surfaces SHALL NOT import
`@tanstack/react-router`, `@rezics/api`, `@rezics/server`, app/admin
feature internals, app/admin locale helpers, or namespace JSON files
under `public/locales/`:

- Root core exports intended for common UI consumption.
- `@rezics/ui/shadcn`.
- `@rezics/ui/uno.config`.
- `@rezics/ui/config/*`.
- `@rezics/ui/i18n` (the locale registration entrypoint).
- Common primitive and composite exports that do not explicitly
  document themselves as host adapters.

These surfaces MAY import `useTranslation` re-exported from the
neutral `@rezics/i18n/react` adapter for locale reactivity.

#### Scenario: Consumer imports shadcn primitives

- **WHEN** a consumer imports `Button`, `Dialog`, or `Select` from
  `@rezics/ui/shadcn`
- **THEN** that import surface SHALL NOT require router, API,
  server, or app/admin feature modules

#### Scenario: Consumer imports UnoCSS config

- **WHEN** a consumer imports `createUnoConfig` from
  `@rezics/ui/uno.config`
- **THEN** the config import SHALL NOT require router, API, server,
  editor, or app/admin feature modules

#### Scenario: Consumer imports translated UI component

- **WHEN** a consumer imports a UI component that renders
  package-owned translated text
- **THEN** that component MAY require the neutral React i18n adapter
- **AND** it SHALL NOT require namespace JSON files or app/admin
  locale helpers
