# i18n-toolchain Specification

## Purpose

Defines the Paraglide-based frontend i18n toolchain for Rezics: package structure, locale ownership, generated message runtime expectations, source file format, and the app/admin/UI synchronization rules. The toolchain compiles JSON message sources into per-locale message functions at build time so consumers import explicit, tree-shakable references rather than calling a runtime resolver. `@rezics/i18n` owns product/domain messages shared across app and admin; `@rezics/ui` owns generic component-internal messages; the app/admin shell owns the active-locale state and fans changes out to both runtimes.

## Requirements

### Requirement: Paraglide message generation

Frontend i18n packages SHALL compile JSON message source files with Paraglide JS and SHALL expose generated message functions and runtime helpers through package exports.

#### Scenario: Product i18n package exposes generated messages

- **WHEN** a frontend consumer imports product/domain translations
- **THEN** the consumer SHALL import generated Paraglide message functions from the shared product/domain i18n package
- **AND** the consumer SHALL NOT call `react-i18next` `useTranslation()` for product/domain UI copy

#### Scenario: UI package exposes generated messages

- **WHEN** a reusable `@rezics/ui` component needs component-internal text
- **THEN** it SHALL read that text from generated Paraglide message functions owned by `@rezics/ui`

### Requirement: Translation source files use JSON

Frontend translation source files SHALL use Paraglide/Inlang-compatible JSON files. JSON5, JSONC, YAML, and custom translation file format plugins SHALL NOT be introduced by this change.

#### Scenario: Translation source file extension

- **WHEN** translation source files are added for product/domain or UI component messages
- **THEN** the files SHALL use the `.json` extension
- **AND** they SHALL be readable by the configured official Paraglide/Inlang JSON message plugin path

### Requirement: App and admin share product/domain messages

The app and admin frontends SHALL consume one shared product/domain i18n package for feature copy, product labels, and domain labels that are common across Rezics frontends.

#### Scenario: Shared product label appears in app and admin

- **WHEN** app and admin both render the same product/domain label
- **THEN** both frontends SHALL resolve the label from the shared product/domain i18n package
- **AND** neither frontend SHALL keep a duplicate local translation key for that shared label

### Requirement: Active locale is shell-owned

The app/admin shell SHALL be the single owner of the active locale state. Package-local i18n runtimes SHALL receive the active locale from the shell and SHALL NOT independently infer locale from URL, cookies, localStorage, or browser language.

#### Scenario: User changes language

- **WHEN** the user selects a supported language in an app/admin language control
- **THEN** the shell SHALL update the active locale
- **AND** the shell SHALL synchronize that locale into both the product/domain i18n runtime and the UI i18n runtime

#### Scenario: UI component renders after language change

- **WHEN** the shell active locale changes from `zh-hant` to `en`
- **THEN** a translated `@rezics/ui` component SHALL render its UI-owned text in English
- **AND** app/admin product text SHALL render from the same active locale

### Requirement: Canonical locale behavior is preserved

The Paraglide migration SHALL preserve the existing canonical locale set and language defaults: supported locales are `zh-hant`, `zh-hans`, `en`, `ja`, and `de`; the default locale is `zh-hant`. Frontend UI callsites SHALL NOT provide runtime fallback strings for missing messages; message catalog completeness is required before a message function is used.

#### Scenario: Default locale

- **WHEN** a frontend shell initializes without a persisted language preference
- **THEN** the active locale SHALL be `zh-hant`

#### Scenario: Complete catalog replaces fallback strings

- **WHEN** frontend source renders product/domain UI copy through a generated
  Paraglide message function
- **THEN** the corresponding message SHALL exist in every supported product
  locale JSON file
- **AND** the rendering callsite SHALL NOT pass a fallback string

### Requirement: React-i18next is removed from frontend runtime usage

Frontend packages SHALL NOT use `react-i18next` or `i18next` as the runtime API after the Paraglide migration completes.

#### Scenario: Runtime translation callsites

- **WHEN** frontend source under `package/{app,admin,ui,editor,folio}/src/` is inspected
- **THEN** there SHALL be no imports from `react-i18next`
- **AND** there SHALL be no new `i18next` runtime initialization for frontend UI copy

### Requirement: Generated files are not edited manually

Paraglide generated output SHALL be treated as generated code. Developers SHALL edit JSON source messages and Paraglide configuration, not generated message or runtime files.

#### Scenario: Translation update

- **WHEN** a developer changes a user-visible translation
- **THEN** the change SHALL be made in the relevant JSON source message file
- **AND** generated Paraglide output SHALL be refreshed through the configured compile command or bundler plugin

### Requirement: Contract domain enums resolve labels through `@rezics/i18n` helpers

Backend-driven discriminator keys for contract domain enums (entity kind, license, subject attribution role, credit role, and any future contract enum that ships with a displayable label) SHALL resolve their localized label through hand-written maps in `@rezics/i18n` guarded by `satisfies Record<EnumKey, () => string>`. The `i18nKey` field SHALL NOT exist on `@rezics/contract` domain definitions after the migration; message identity belongs to `@rezics/i18n`, not contract.

#### Scenario: Rendering an entity kind label

- **WHEN** a frontend component needs to display the label for an entity whose `kind` is `"person"`
- **THEN** the component SHALL call `entityKindLabel(entity.kind)` from `@rezics/i18n`
- **AND** the component SHALL NOT read an `i18nKey` field from the contract object
- **AND** the component SHALL NOT call a generated Paraglide message function with a dynamic string key

#### Scenario: Adding a new entity kind

- **WHEN** a new discriminator value is added to a contract domain enum
- **THEN** the corresponding `<enum>Label` map in `@rezics/i18n` SHALL be updated in the same change
- **AND** TypeScript SHALL flag the omission via `satisfies Record<EnumKey, () => string>` if the map is not updated

#### Scenario: Contract is inspected for embedded message keys

- **WHEN** source under `package/contract/src/` is inspected after the migration
- **THEN** no `i18nKey` field SHALL appear on contract domain definitions
- **AND** no contract source file SHALL import from `@rezics/i18n` or from the generated Paraglide output

### Requirement: Dynamic Paraglide message lookup is forbidden

Frontend code SHALL NOT access generated Paraglide messages through dynamic keys (bracket access with a runtime string, template-literal computed property names, or destructuring `m` into a runtime variable). Paraglide's bracket-access escape hatch defeats tree-shaking and bypasses the explicit-mapping invariant. Dynamic labels SHALL dispatch through statically-defined slug-to-function maps whose values are generated message functions.

#### Scenario: Dynamic key access is rejected

- **WHEN** a developer writes `m[runtimeString]()` or `m[\`prefix_${value}\`]()`
- **THEN** the convention check SHALL flag the callsite
- **AND** the developer SHALL refactor through an explicit map in `@rezics/i18n` or a typed feature-local map

#### Scenario: Map-mediated dynamic dispatch is allowed

- **WHEN** a developer accesses messages through a statically-defined object whose values are message functions and whose type is `Record<Slug, () => string>` (or stricter)
- **THEN** the access pattern SHALL be allowed
- **AND** tree-shaking SHALL still see direct message function references in the source

### Requirement: Paraglide output is generated before TypeScript checks

The build pipeline SHALL compile Paraglide messages before any step that consumes generated message functions (`tsc`, bundlers, tests, Storybook). New contributors SHALL be able to run repo checks after a fresh `bun install` without manually invoking the Paraglide compile step.

#### Scenario: Fresh install runs typecheck

- **WHEN** a contributor clones the repository and runs `bun install` followed by a TypeScript check
- **THEN** the Paraglide compile step SHALL have already run via `postinstall` or as the first step of the consuming script
- **AND** generated message functions SHALL be importable without manual compile commands

#### Scenario: CI runs typecheck

- **WHEN** CI runs TypeScript checks for any frontend package
- **THEN** Paraglide compile SHALL run first
- **AND** missing generated output SHALL NOT be a cause of CI failure

### Requirement: Shell-level locale helper lives in the app/admin shell

The helper that fans out a locale change to all Paraglide runtimes SHALL live in the app or admin shell (e.g. `package/app/src/app/`), not in `@rezics/i18n` or `@rezics/ui`. Neither `@rezics/i18n` nor `@rezics/ui` SHALL import from the other; both are leaves under the shell.

#### Scenario: Shell synchronizes both runtimes

- **WHEN** the shell calls `setRezicsLocale("en")`
- **THEN** the helper SHALL invoke the `@rezics/i18n` locale setter and the `@rezics/ui` locale setter
- **AND** the helper SHALL pass `{ reload: false }` to both setters so SPA navigation is preserved

#### Scenario: I18n packages do not cross-import

- **WHEN** `@rezics/i18n` and `@rezics/ui` package sources are inspected
- **THEN** `@rezics/i18n` SHALL NOT import from `@rezics/ui`
- **AND** `@rezics/ui` SHALL NOT import from `@rezics/i18n`

### Requirement: Legacy frontend translation API is removed

Frontend UI copy SHALL NOT be rendered through a legacy string-key translation
resolver. App, admin, and UI package source SHALL NOT call
`useTranslation().t(...)`, `translate(key)`, or any equivalent runtime resolver
for product/domain UI copy.

#### Scenario: Static message rendering

- **WHEN** a component renders static product/domain UI copy such as a button
  label, heading, placeholder, tooltip, or validation message
- **THEN** it SHALL call a generated Paraglide message function directly
- **AND** it SHALL NOT pass a string translation key to a runtime resolver

#### Scenario: Runtime translation bridge is inspected

- **WHEN** frontend source under `package/{app,admin,ui,editor,folio}/src/` is
  inspected
- **THEN** no UI copy callsite SHALL import or call the legacy
  `@rezics/i18n` `translate` helper
- **AND** no UI copy callsite SHALL destructure `t` from `useTranslation()`

### Requirement: Fallback string parameters are forbidden

Frontend UI translation callsites SHALL NOT provide fallback string parameters.
Fallback text from legacy callsites MAY be used only while populating catalog
source files during migration.

#### Scenario: Legacy fallback callsite is rejected

- **WHEN** a developer writes a UI translation callsite like
  `t("common.save", "Save")`
- **THEN** the convention check SHALL flag the callsite
- **AND** the developer SHALL add or use a catalog-backed generated message
  function instead

#### Scenario: Missing message is found during migration

- **WHEN** a legacy callsite references a slug that does not exist as a
  generated Paraglide message
- **THEN** the implementation SHALL add that message to every supported locale
  JSON file before replacing the callsite

### Requirement: Slug-to-function maps are typed

Any frontend dynamic label that is selected from a known set of slugs SHALL use a
typed map from slug to generated message function. The map SHALL be exhaustive
for the slug union it claims to support.

#### Scenario: Provider label is selected dynamically

- **WHEN** a component needs to render a provider label from a runtime provider
  slug such as `github`
- **THEN** the slug SHALL be narrowed to a known provider union
- **AND** the label SHALL be rendered by calling the corresponding generated
  message function from a `satisfies Record<ProviderSlug, () => string>` map

#### Scenario: New slug is added

- **WHEN** a new supported slug is added to a typed dynamic label union
- **THEN** TypeScript SHALL require the corresponding generated message function
  entry in the slug-to-function map
