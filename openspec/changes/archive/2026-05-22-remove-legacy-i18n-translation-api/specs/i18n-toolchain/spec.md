## MODIFIED Requirements

### Requirement: Canonical locale behavior is preserved

The Paraglide migration SHALL preserve the existing canonical locale set and
language defaults: supported locales are `zh-hant`, `zh-hans`, `en`, `ja`, and
`de`; the default locale is `zh-hant`. Frontend UI callsites SHALL NOT provide
runtime fallback strings for missing messages; message catalog completeness is
required before a message function is used.

#### Scenario: Default locale

- **WHEN** a frontend shell initializes without a persisted language preference
- **THEN** the active locale SHALL be `zh-hant`

#### Scenario: Complete catalog replaces fallback strings

- **WHEN** frontend source renders product/domain UI copy through a generated
  Paraglide message function
- **THEN** the corresponding message SHALL exist in every supported product
  locale JSON file
- **AND** the rendering callsite SHALL NOT pass a fallback string

### Requirement: Dynamic Paraglide message lookup is forbidden

Frontend code SHALL NOT access generated Paraglide messages through dynamic keys
(bracket access with a runtime string, template-literal computed property names,
or destructuring `m` into a runtime variable). Paraglide's bracket-access escape
hatch defeats tree-shaking and bypasses the explicit-mapping invariant. Dynamic
labels SHALL dispatch through statically-defined slug-to-function maps whose
values are generated message functions.

#### Scenario: Dynamic key access is rejected

- **WHEN** a developer writes `m[runtimeString]()` or
  `m[\`prefix_${value}\`]()`
- **THEN** the convention check SHALL flag the callsite
- **AND** the developer SHALL refactor through an explicit map in `@rezics/i18n`
  or a typed feature-local map

#### Scenario: Map-mediated dynamic dispatch is allowed

- **WHEN** a developer accesses messages through a statically-defined object
  whose values are message functions and whose type is `Record<Slug, () =>
  string>` (or stricter)
- **THEN** the access pattern SHALL be allowed
- **AND** tree-shaking SHALL still see direct message function references in the
  source

## ADDED Requirements

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
