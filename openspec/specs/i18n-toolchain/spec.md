# i18n-toolchain Specification

## Purpose

Defines the Paraglide-based frontend i18n toolchain for Rezics: package structure, locale ownership, generated message runtime expectations, source file format, and the app/admin/UI synchronization rules. The toolchain compiles JSON message sources into per-locale message functions at build time so consumers import explicit, tree-shakable references rather than calling a runtime resolver. `@rezics/i18n` owns product/domain messages shared across app and admin; `@rezics/ui` owns generic component-internal messages; the shared React i18n adapter owns the active-locale state and synchronizes registered package-local runtimes.

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

### Requirement: Active locale is adapter-owned

The shared React i18n adapter SHALL own frontend active-locale state for app,
admin, UI components, and Storybook. App/admin shells SHALL initialize the
adapter, register package-local Paraglide runtimes, and invoke the adapter
setter when users change language.

#### Scenario: User changes language through app shell

- **WHEN** the user selects `en` in an app language control
- **THEN** the app SHALL call the shared adapter locale setter with `en`
- **AND** the adapter SHALL synchronize the product/domain Paraglide runtime
  and the UI Paraglide runtime
- **AND** translated React components SHALL update through adapter
  subscriptions

#### Scenario: Admin uses the same locale owner

- **WHEN** the user selects `ja` in admin settings
- **THEN** admin SHALL call the same adapter API used by app
- **AND** admin product copy and imported UI package copy SHALL render in
  Japanese

### Requirement: React UI copy resolves through useMessage

React UI copy in app, admin, and UI packages SHALL resolve generated Paraglide
message functions through the shared `useMessage(messageBag)` hook. React
render paths SHALL NOT call generated message functions directly unless the
call is outside user-visible UI copy or explicitly exempted by tests or
generated code boundaries.

#### Scenario: App component renders product message

- **WHEN** an app component renders a product/domain label
- **THEN** it SHALL import the needed generated message functions explicitly
- **AND** it SHALL render the label through `m.<message>()` from
  `useMessage(messageBag)`

#### Scenario: UI component renders UI package message

- **WHEN** a UI package component renders component-internal copy
- **THEN** it SHALL import generated UI message functions from the UI package
- **AND** it SHALL render those messages through `useMessage(messageBag)`

#### Scenario: Module-scope config stores message references

- **WHEN** a module-scope navigation item, option list, or helper map needs a
  translated label
- **THEN** it SHALL store a generated message function or typed descriptor
- **AND** the message SHALL be resolved through `useMessage()` during React
  render

### Requirement: React message imports are explicit

Production React source SHALL import generated message functions by name and
SHALL NOT import full generated message namespaces for user-visible UI copy.
This preserves Paraglide message-level tree shaking and makes each message bag
auditable.

#### Scenario: Named imports are accepted

- **WHEN** production React source imports `{ common_save }` from
  `@rezics/i18n/messages`
- **AND** it includes `common_save` in a local message bag passed to
  `useMessage()`
- **THEN** the callsite SHALL satisfy the i18n toolchain rules

#### Scenario: Namespace imports are rejected in production React source

- **WHEN** production React source imports `* as m` from generated messages and
  renders `m.common_save()`
- **THEN** convention checks SHALL flag the callsite
- **AND** the code SHALL be migrated to named imports and `useMessage()`

### Requirement: Canonical locale behavior is preserved

The Paraglide frontend UI toolchain SHALL use the canonical locale set
`zh-hant`, `zh-hans`, `en`, `ja`, `de`, and `ko`; the default locale is
`zh-hant`. Frontend UI callsites SHALL NOT provide runtime fallback strings for
missing messages; message catalog completeness is required before a message
function is used.

#### Scenario: Default locale

- **WHEN** a frontend shell initializes without a persisted language preference
- **THEN** the active locale SHALL be `zh-hant`

#### Scenario: Complete catalog replaces fallback strings

- **WHEN** frontend source renders product/domain UI copy through a generated
  Paraglide message function
- **THEN** the corresponding message SHALL exist in every supported product
  locale JSON file
- **AND** the rendering callsite SHALL NOT pass a fallback string

#### Scenario: Korean locale is supported

- **WHEN** a frontend shell sets the active locale to `ko`
- **THEN** both the `@rezics/i18n` runtime and the `@rezics/ui` runtime SHALL
  accept `ko`
- **AND** generated UI copy SHALL render from Korean source message catalogs

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
Fallback text from legacy callsites MAY be used only as source material while
populating catalog source files during migration; it SHALL NOT remain in the
rendering callsite.

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
- **AND** the replacement callsite SHALL NOT keep a runtime fallback string

### Requirement: UI message catalogs have complete locale parity

The `@rezics/i18n` and `@rezics/ui` source message catalogs SHALL contain one
JSON file for each supported frontend UI locale: `zh-hant`, `zh-hans`, `en`,
`ja`, `de`, and `ko`. Within each package, every locale JSON file SHALL contain
the exact same message key set as the package base locale.

#### Scenario: Product catalog locale files are complete

- **WHEN** `package/i18n/messages/` is inspected
- **THEN** it SHALL contain `zh-hant.json`, `zh-hans.json`, `en.json`,
  `ja.json`, `de.json`, and `ko.json`
- **AND** all six files SHALL contain the same message keys

#### Scenario: UI catalog locale files are complete

- **WHEN** `package/ui/messages/` is inspected
- **THEN** it SHALL contain `zh-hant.json`, `zh-hans.json`, `en.json`,
  `ja.json`, `de.json`, and `ko.json`
- **AND** all six files SHALL contain the same message keys

### Requirement: Admin uses the shared product i18n catalog

The admin frontend SHALL render product/domain UI copy through generated
`@rezics/i18n/messages` functions or shared label helpers from `@rezics/i18n`.
Admin SHALL NOT maintain local locale source files for product/domain UI copy.

#### Scenario: Admin local locale files are absent

- **WHEN** `package/admin/src/locale/` is inspected after the migration
- **THEN** no admin-local locale source files SHALL remain
- **AND** admin source SHALL NOT import from those removed files

#### Scenario: Admin page renders static UI copy

- **WHEN** an admin page renders a heading, label, placeholder, table header,
  tooltip, dialog title, empty state, error state, or action button
- **THEN** the copy SHALL come from a generated `@rezics/i18n/messages`
  function or an approved shared label helper
- **AND** it SHALL NOT come from a hard-coded string literal unless the string is
  an intentional technical literal, brand name, URL example, enum value, or user
  data

### Requirement: UI fallback strings are prohibited

App, admin, and reusable UI frontend code SHALL NOT provide runtime fallback
strings for UI copy. Missing UI messages SHALL be fixed by adding catalog
entries for every supported locale before the generated message function is
used.

#### Scenario: Fallback argument is rejected

- **WHEN** a frontend UI callsite uses a runtime translation API with a fallback
  string argument such as `t("common.save", "Save")`
- **THEN** the convention check SHALL fail
- **AND** the developer SHALL replace the callsite with a catalog-backed
  generated message function

#### Scenario: Nullish fallback text is rejected

- **WHEN** a frontend UI callsite renders generated or translated copy with an
  inline fallback such as `message() ?? "Save"` or `label || "Untitled"`
- **THEN** the convention check SHALL fail when the fallback text is static UI
  copy
- **AND** the static UI copy SHALL be represented as a generated message
  function instead

### Requirement: Locale and message checks run with repository conventions

The repository convention checks SHALL verify frontend UI i18n invariants so
locale support cannot drift silently.

#### Scenario: Locale list drift is rejected

- **WHEN** `LANGUAGES`, `package/i18n/project.inlang/settings.json`, and
  `package/ui/project.inlang/settings.json` are compared
- **THEN** all three SHALL expose the same supported locale set
- **AND** a mismatch SHALL fail the convention check

#### Scenario: Message key drift is rejected

- **WHEN** a supported locale JSON file is missing a key that exists in the base
  locale JSON file for the same package
- **THEN** the convention check SHALL fail and report the missing locale/key

#### Scenario: Dynamic generated message lookup is rejected

- **WHEN** app, admin, or UI source uses generated messages through a runtime key
  such as `m[key]()` or `m[\`prefix_${value}\`]()`
- **THEN** the convention check SHALL fail
- **AND** the callsite SHALL be replaced with a direct message function or a
  typed slug-to-function map

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
