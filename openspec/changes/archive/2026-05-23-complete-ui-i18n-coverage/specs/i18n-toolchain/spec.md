## ADDED Requirements

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

## MODIFIED Requirements

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

