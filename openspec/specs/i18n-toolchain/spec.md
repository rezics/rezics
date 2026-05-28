# i18n-toolchain Specification

## Purpose

Defines the Paraglide-based frontend i18n toolchain for Rezics: package structure, locale ownership, generated message runtime expectations, source file format, and the app/admin/UI synchronization rules. The toolchain compiles JSON message sources into per-locale message functions at build time so consumers import explicit, tree-shakable references rather than calling a runtime resolver. `@rezics/i18n` owns product/domain messages shared across app and admin; `@rezics/ui` owns generic component-internal messages; the shared React i18n adapter owns the active-locale state and synchronizes registered package-local runtimes.
## Requirements
### Requirement: Translation source files use JSON

Frontend translation source files SHALL be JSON files served as static
assets from `public/locales/{lng}/{ns}.json`. JSON5, JSONC, YAML, and
custom translation source formats SHALL NOT be introduced by this
change.

#### Scenario: Translation source file extension

- **WHEN** translation source files are added for product, domain, or
  UI component messages
- **THEN** the files SHALL use the `.json` extension
- **AND** every file SHALL be a valid JSON object whose values are
  strings or ICU template strings

### Requirement: App and admin share product/domain messages

The app and admin frontends SHALL consume the same set of product/domain
namespace JSON files served from `public/locales/{lng}/{ns}.json`. Admin
SHALL additionally load the `admin` namespace, which SHALL NOT be loaded
by app.

#### Scenario: Shared product label appears in app and admin

- **WHEN** app and admin both render the same product/domain label
- **THEN** both frontends SHALL resolve the label from the same
  namespace JSON file
- **AND** neither frontend SHALL keep a duplicate local translation key
  for that shared label

#### Scenario: Admin-only namespace is isolated

- **WHEN** the app frontend boots
- **THEN** it SHALL NOT request `/locales/<lng>/admin.json`
- **AND** the admin namespace SHALL be loaded only by the admin frontend

### Requirement: Active locale is adapter-owned

The shared React i18n adapter SHALL own frontend active-locale state for
app, admin, UI components, and Storybook. App/admin shells SHALL
initialize the i18next instance, register UI locale bundles, and call
`i18next.changeLanguage(locale)` when users change language.

#### Scenario: User changes language through app shell

- **WHEN** the user selects `en` in an app language control
- **THEN** the app SHALL call `i18next.changeLanguage('en')`
- **AND** every already-loaded namespace SHALL refetch its `en` version
- **AND** translated React components SHALL update through
  `react-i18next` subscriptions without page reload

#### Scenario: Admin uses the same locale owner

- **WHEN** the user selects `ja` in admin settings
- **THEN** admin SHALL call the same `changeLanguage` API used by app
- **AND** admin product copy, admin-only namespace copy, and imported
  UI package copy SHALL render in Japanese

### Requirement: Canonical locale behavior is preserved

The frontend UI toolchain SHALL use the canonical locale set `zh-hant`,
`zh-hans`, `en`, `ja`, `de`, and `ko`; the default locale is `zh-hant`.
Frontend UI callsites SHALL NOT provide runtime fallback strings for
missing messages; namespace catalog completeness is required before a
key is referenced.

#### Scenario: Default locale

- **WHEN** a frontend shell initializes without a persisted language
  preference
- **THEN** the active locale SHALL be `zh-hant`

#### Scenario: Complete catalog replaces fallback strings

- **WHEN** frontend source renders UI copy through `t('<ns>:<key>')`
- **THEN** the corresponding key SHALL exist in every supported locale's
  JSON file for that namespace
- **AND** the rendering callsite SHALL NOT pass a fallback string

#### Scenario: Korean locale is supported

- **WHEN** a frontend shell sets the active locale to `ko`
- **THEN** the i18next runtime SHALL accept `ko`
- **AND** every loaded namespace SHALL refetch its `ko` JSON

### Requirement: Contract domain enums resolve labels through `@rezics/i18n` helpers

Contract domain enum labels SHALL resolve through hand-written maps in `@rezics/i18n`, not through `i18nKey` fields on `@rezics/contract` definitions. Backend-driven discriminator keys for contract domain enums (entity kind, license, subject attribution role, credit role, and any future contract enum that ships with a displayable label) SHALL resolve their localized label through hand-written maps in `@rezics/i18n` guarded by `satisfies Record<EnumKey, () => string>`. Each map entry SHALL return the result of `i18next.t('<ns>:<key>')` for the appropriate namespace. The `i18nKey` field SHALL NOT exist on `@rezics/contract` domain definitions; message identity belongs to `@rezics/i18n`, not contract.

#### Scenario: Rendering an entity kind label

- **WHEN** a frontend component needs to display the label for an entity
  whose `kind` is `"person"`
- **THEN** the component SHALL call `entityKindLabel(entity.kind)` from
  `@rezics/i18n`
- **AND** the helper SHALL resolve the label via
  `i18next.t('entity:kind_person')` or the equivalent
  namespace-qualified key
- **AND** the component SHALL NOT read an `i18nKey` field from the
  contract object

#### Scenario: Adding a new entity kind

- **WHEN** a new discriminator value is added to a contract domain enum
- **THEN** the corresponding `<enum>Label` map in `@rezics/i18n` SHALL
  be updated in the same change
- **AND** TypeScript SHALL flag the omission via
  `satisfies Record<EnumKey, () => string>` if the map is not updated

#### Scenario: Contract is inspected for embedded message keys

- **WHEN** source under `package/contract/src/` is inspected after the
  migration
- **THEN** no `i18nKey` field SHALL appear on contract domain
  definitions
- **AND** no contract source file SHALL import from `@rezics/i18n` or
  from any i18next runtime

### Requirement: Frontend i18n runtime

Frontend i18n packages SHALL use `i18next` as the runtime translation
resolver, `react-i18next` for React binding, `i18next-http-backend` for
on-demand namespace JSON loading, and `i18next-browser-languagedetector`
for active-locale resolution. `@rezics/i18n` SHALL initialize the
shared runtime and re-export `i18next`, the React provider, and
`useTranslation` for downstream consumers.

#### Scenario: Frontend consumer fetches a translation

- **WHEN** a frontend consumer needs a product/domain translation
- **THEN** the consumer SHALL call `useTranslation('<ns>')` from
  `react-i18next` re-exported by `@rezics/i18n`
- **AND** the consumer SHALL resolve the string through `t('<ns>:<key>')`
- **AND** no consumer SHALL import generated Paraglide message functions

#### Scenario: UI package uses the same runtime

- **WHEN** a `@rezics/ui` component needs component-internal text
- **THEN** it SHALL call `useTranslation('ui')` against the shared
  i18next instance
- **AND** it SHALL NOT initialize a separate i18next instance

### Requirement: React UI copy resolves through useTranslation

React UI copy in app, admin, and UI packages SHALL resolve translations
through `useTranslation('<ns>')` and `t('<ns>:<key>')`. Direct imports
of namespace JSON files into React render paths SHALL NOT be used.

#### Scenario: App component renders product message

- **WHEN** an app component renders a product/domain label from the
  `book` namespace
- **THEN** it SHALL call `const { t } = useTranslation('book')`
- **AND** it SHALL render the label through `t('book:<key>')`

#### Scenario: UI component renders UI package message

- **WHEN** a UI package component renders component-internal copy
- **THEN** it SHALL call `const { t } = useTranslation('ui')`
- **AND** it SHALL render the message through `t('ui:<key>')`

#### Scenario: Module-scope config defers resolution to render

- **WHEN** a module-scope navigation item, option list, or helper map
  needs a translated label
- **THEN** it SHALL store the namespace-qualified key string (e.g.
  `'book:tag_label'`)
- **AND** the message SHALL be resolved through `t(key)` during React
  render

### Requirement: Generated Paraglide artifacts SHALL be removed

Generated Paraglide artifacts SHALL NOT remain in the repository after the migration. The `@inlang/paraglide-js` dependency, `project.inlang/` directories, `src/paraglide/` generated outputs, and `i18n:compile` build scripts SHALL be removed. Frontend packages SHALL NOT contain any reference to generated Paraglide message functions.

#### Scenario: Repository is inspected after migration

- **WHEN** the repository is inspected after the migration completes
- **THEN** no `project.inlang/` directory SHALL exist
- **AND** no `src/paraglide/` directory SHALL exist
- **AND** `@inlang/paraglide-js` SHALL NOT appear in any `package.json`
- **AND** no `i18n:compile` script SHALL appear in any `package.json`

### Requirement: Dynamic translation keys are typed maps

Frontend code SHALL NOT call `t(...)` with a key constructed by
unrestricted string concatenation or template literal interpolation
of runtime values. Dynamic labels SHALL dispatch through
statically-defined slug-to-string maps whose values are
namespace-qualified key strings and whose types are
`Record<Slug, \`<ns>:${string}\`>` (or stricter).

#### Scenario: Dynamic key access through arbitrary string is rejected

- **WHEN** a developer writes `t(\`book:${runtimeValue}\`)` where
  `runtimeValue` is not narrowed to a known slug union
- **THEN** the `check:i18n` script SHALL flag the callsite
- **AND** the developer SHALL refactor through an explicit slug-to-key
  map

#### Scenario: Map-mediated dynamic dispatch is allowed

- **WHEN** a developer accesses translations through a typed map whose
  values are namespace-qualified key literals and whose type is
  `satisfies Record<Slug, \`<ns>:${string}\`>` (or stricter)
- **THEN** the access pattern SHALL be allowed
- **AND** the `check:i18n` script SHALL recognize each map value as a
  valid key reference

### Requirement: `check:i18n` validates keys statically

The repository SHALL provide a `bun run check:i18n` script that
statically validates translation usage. The script SHALL be wired into
`lefthook` pre-commit checks and CI. It SHALL exit non-zero on any
detected problem.

#### Scenario: Missing key is detected

- **WHEN** source code calls `t('book:nonexistent_key')` but no JSON
  file under `public/locales/<lng>/book.json` declares
  `nonexistent_key`
- **THEN** `check:i18n` SHALL fail
- **AND** the report SHALL identify the callsite file and line

#### Scenario: Per-locale gap is detected

- **WHEN** `public/locales/en/book.json` defines key `book:tag_label`
  but `public/locales/ja/book.json` does not
- **THEN** `check:i18n` SHALL fail
- **AND** the report SHALL list each (locale, namespace, key) tuple
  that is missing

#### Scenario: Unused key is reported

- **WHEN** `public/locales/en/book.json` defines `book:legacy_key`
  but no source file calls `t('book:legacy_key')` or maps to that key
  through a typed slug map
- **THEN** `check:i18n` SHALL report the key as unused
- **AND** the report SHALL be advisory unless the strict-unused flag
  is enabled

#### Scenario: Pre-commit hook runs the check

- **WHEN** a developer commits a change that introduces an unknown key
- **THEN** the `lefthook` pre-commit hook SHALL run `check:i18n`
- **AND** the commit SHALL be blocked until the key is added or the
  callsite is corrected

### Requirement: Bootstrap and lazy namespaces are loaded according to the namespace architecture

The i18next runtime SHALL load namespaces according to the bootstrap
and route-lazy classifications defined by the
[`i18n-namespace-architecture`](../i18n-namespace-architecture/spec.md)
spec. The bootstrap namespace set SHALL be passed to `i18next.init`'s
`ns` option; route-lazy namespaces SHALL be loaded via
`useTranslation` or explicit `i18next.loadNamespaces` calls.

#### Scenario: Bootstrap namespaces are listed in init

- **WHEN** `@rezics/i18n` initializes the runtime
- **THEN** `i18next.init({ ns: [...] })` SHALL include exactly the
  bootstrap namespaces declared by the namespace architecture spec
- **AND** `defaultNS` SHALL be set to `'common'`

#### Scenario: Locale loading mode is current-only

- **WHEN** `i18next.init` is configured
- **THEN** the `load` option SHALL be `'currentOnly'`
- **AND** the runtime SHALL NOT eagerly fetch fallback-chain locales

