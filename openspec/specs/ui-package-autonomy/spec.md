# ui-package-autonomy Specification

## Purpose

Defines the `@rezics/ui` dependency tiers, export surface boundaries, host-capability injection rules, and package-level convention enforcement that let the UI package be reused across Rezics projects. The package is product-aware where useful, but it is not bound to any specific app shell, router, API client, server package, auth/session implementation, cache implementation, or upload implementation. Application-owned behavior reaches reusable UI through explicit adapter APIs supplied by the consuming host.
## Requirements
### Requirement: UI package is Rezics ecosystem reusable

`@rezics/ui` SHALL be reusable across Rezics projects without requiring a specific app shell, router, API client, server package, auth/session implementation, cache implementation, or upload implementation.

The package MAY expose Rezics product-aware components when they are reusable across Rezics projects, but product-aware components SHALL receive application-owned capabilities from the consuming project instead of importing those capabilities directly.

#### Scenario: Another Rezics project consumes the UI package

- **WHEN** a Rezics project installs `@rezics/ui` to use shadcn components, design tokens, and common composites
- **THEN** the project SHALL NOT need to install or configure the main app router, app API client, server package, auth shell, or app feature modules just to consume those UI exports

#### Scenario: Product-aware component needs app behavior

- **WHEN** a shared product-aware UI component needs navigation, data fetching, upload, search, auth/session, cache, or route progress behavior
- **THEN** the consuming app SHALL provide that behavior through props, context, or an app-owned wrapper
- **AND** the shared component SHALL NOT import the app-owned implementation directly

### Requirement: UI package may use neutral i18n React adapter

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

### Requirement: Contract usage is shared vocabulary only

`@rezics/ui` MAY import `@rezics/contract` for stable shared Rezics vocabulary such as domain types, enum values, and constants that are meaningful across Rezics projects. `@rezics/ui` SHALL NOT use `@rezics/contract` as a shortcut for app policy, navigation behavior, data fetching behavior, or product workflow ownership.

Low-value contract imports, such as pulling a package dependency only for a default value that can be supplied as a prop or local constant, SHALL be removed when the surrounding component is touched by this change.

#### Scenario: Domain value is rendered

- **WHEN** a reusable component accepts a shared Rezics domain value such as a content rating
- **THEN** the component MAY type that value with `@rezics/contract`
- **AND** it SHALL keep labels, navigation, fetching, and mutation behavior outside the contract import

#### Scenario: Default value can be local

- **WHEN** a UI component imports `@rezics/contract` only to read a default that the host can provide
- **THEN** the component SHALL use a prop, local default, or UI package constant instead

### Requirement: Host capability adapters are explicit

Reusable UI components that need host-owned behavior SHALL expose explicit adapter APIs. Adapter APIs SHALL be small, typed, and named for the capability they provide, such as link rendering, user search, image upload, or route progress state.

#### Scenario: Component needs navigation

- **WHEN** a UI component needs to render an app-route link
- **THEN** it SHALL accept a host-provided link renderer or be wrapped by the consuming app
- **AND** it SHALL NOT import the consuming app's router directly

#### Scenario: Component needs image upload

- **WHEN** a UI component needs to upload an image
- **THEN** it SHALL call a host-provided upload adapter
- **AND** it SHALL NOT import `@rezics/api` upload mutations directly

#### Scenario: Component needs user search

- **WHEN** a UI component needs user mention search results
- **THEN** it SHALL call a host-provided search adapter
- **AND** it SHALL NOT import `@rezics/api` search clients directly

### Requirement: Package dependency declarations match the boundary

`package/ui/package.json` SHALL declare only dependencies needed by reusable UI package surfaces. API clients, server packages, and app/admin packages SHALL NOT be direct dependencies of `@rezics/ui`.

Router or editor integrations that remain available through explicit adapter-only subpaths SHALL be represented as peer, optional peer, or consumer-owned dependencies according to how the subpath is intended to be used.

#### Scenario: UI package dependencies are inspected

- **WHEN** `package/ui/package.json` is inspected
- **THEN** `@rezics/api`, `@rezics/server`, and app/admin package internals SHALL NOT appear as direct dependencies

#### Scenario: Optional adapter dependency is required

- **WHEN** a subpath intentionally integrates with a host framework
- **THEN** the dependency policy SHALL make that integration explicit
- **AND** core UI consumers SHALL NOT be forced to install the host framework for unrelated UI imports

### Requirement: UI package boundary is convention-checked

The repository SHALL include convention enforcement that flags forbidden imports from core `@rezics/ui` surfaces. The check SHALL allow documented exceptions only for explicit adapter surfaces, stories, mocks, or tests where the exception is part of the test fixture.

#### Scenario: Core UI imports router directly

- **WHEN** a reusable core UI source file imports from `@tanstack/react-router`
- **THEN** the convention check SHALL fail
- **AND** the code SHALL be refactored to use host capability injection or an app-owned wrapper

#### Scenario: Core UI imports API client directly

- **WHEN** a reusable core UI source file imports from `@rezics/api`
- **THEN** the convention check SHALL fail
- **AND** the code SHALL be refactored to use a host-provided adapter

#### Scenario: Story imports router for fixture setup

- **WHEN** a Storybook story or mock route fixture imports a router dependency to demonstrate a component
- **THEN** the convention check MAY allow the import if the path is explicitly classified as story, mock, or test-only

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

