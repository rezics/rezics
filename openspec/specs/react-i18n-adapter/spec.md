# react-i18n-adapter Specification

## Purpose

Defines the shared React i18n adapter (`@rezics/i18n/react`) that owns frontend
active-locale state for app, admin, UI components, and Storybook. The adapter
exposes a single locale store and a tree-shake-safe `useMessage(messageBag)`
hook so React render paths bind generated Paraglide message functions without
the adapter importing any generated message catalog. Package-local Paraglide
runtimes register with the adapter to receive active-locale updates, keeping
reusable `@rezics/ui` components dynamically localized without host-level
remounting.

## Requirements

### Requirement: Shared React locale store

The React i18n adapter SHALL provide a single active-locale store shared by
app, admin, UI components, and Storybook. The store SHALL expose synchronous
`getLocale`, `setLocale`, and `subscribeLocale` APIs and SHALL validate all
locale writes through the canonical language registry.

#### Scenario: Component observes language change

- **WHEN** a React component subscribes through the adapter and the active
  locale changes from `zh-hant` to `en`
- **THEN** the component SHALL re-render from the new locale snapshot
- **AND** no full page reload SHALL be required

#### Scenario: Invalid locale is rejected

- **WHEN** a caller attempts to set the active locale to `en-US`
- **THEN** the adapter SHALL reject or normalize the value according to the
  canonical language registry
- **AND** the active locale SHALL remain a canonical Rezics language code

### Requirement: Tree-shake-safe message binding

The React i18n adapter SHALL expose `useMessage(messageBag)` for React render
paths. The hook SHALL return a local `m` object with the same keys as the input
message bag, and each `m.<key>()` function SHALL invoke the corresponding
generated Paraglide message function using the current adapter locale.

#### Scenario: Local m object renders a static message

- **WHEN** a component imports `common_save` from generated product messages,
  defines `{ common_save }` as a message bag, and calls
  `const m = useMessage(messageBag)`
- **THEN** `m.common_save()` SHALL render the `common_save` translation for the
  current active locale

#### Scenario: Message inputs remain typed

- **WHEN** a generated message requires inputs such as `{ count: number }`
- **THEN** the corresponding `m.<key>()` wrapper SHALL require the same inputs
  at compile time
- **AND** TypeScript SHALL reject calls that omit required inputs or pass
  incompatible input shapes

#### Scenario: Locale is passed explicitly to message functions

- **WHEN** `m.common_save()` is called during React render
- **THEN** the wrapper SHALL call the generated message function with the
  current locale supplied through message options
- **AND** the rendered string SHALL NOT depend on a parent route remount

### Requirement: Adapter does not import generated messages

The React i18n adapter SHALL NOT import product/domain generated messages, UI
generated messages, or any generated message index. Message functions SHALL be
supplied by callsites through explicit imports and message bags.

#### Scenario: Adapter source is inspected

- **WHEN** source for `@rezics/i18n/react` is inspected
- **THEN** it SHALL NOT import from `@rezics/i18n/messages`
- **AND** it SHALL NOT import from `@rezics/ui/i18n/messages`
- **AND** it SHALL NOT import generated `paraglide/messages` files

#### Scenario: Unused message remains tree-shaken

- **WHEN** a bundle fixture imports `useMessage` and exactly one generated
  message function
- **THEN** unrelated generated message functions SHALL NOT appear in the output
  bundle

### Requirement: Runtime registration synchronizes Paraglide runtimes

The adapter SHALL allow Paraglide runtimes from multiple packages to register
with the shared locale store. Registered runtimes SHALL receive active-locale
updates without requiring the registering package to import another package's
generated messages.

#### Scenario: Product and UI runtimes are registered

- **WHEN** app or admin bootstrap registers the product/domain runtime and the
  UI runtime with the adapter
- **THEN** setting the adapter locale to `ja` SHALL update both runtime
  instances to `ja`
- **AND** both runtime setters SHALL be called with reload disabled

#### Scenario: Runtime setter delegates to adapter

- **WHEN** a caller sets locale through a registered Paraglide runtime after
  registration
- **THEN** the shared adapter locale SHALL update
- **AND** React subscribers SHALL be notified exactly once for that language
  change

### Requirement: UI package components remain dynamically localized

Reusable `@rezics/ui` components that render package-owned text SHALL bind
their own generated UI message functions through `useMessage()`. When a host
application changes the shared adapter locale, those UI components SHALL update
without host-level remounting.

#### Scenario: UI component updates inside app

- **WHEN** app renders a `@rezics/ui` password field that defaults its label
  from UI package messages
- **AND** the user changes the active locale from `en` to `zh-hant`
- **THEN** the password field's default label and visibility text SHALL render
  in Traditional Chinese

#### Scenario: Host override remains host-owned

- **WHEN** a host passes an explicit string override prop to a UI component
- **THEN** the UI component SHALL render that override as supplied
- **AND** dynamic localization of the override SHALL be the host's
  responsibility

### Requirement: React UI callsites use the m-dot form

Production React UI code SHALL render translated UI copy through the first
message form: `const m = useMessage(messageBag)` followed by `m.<message>()`.
The callable `m(messageFn, inputs?)` form SHALL NOT be the standard migration
target for production UI copy in this change.

#### Scenario: Component renders with local message bag

- **WHEN** a production React component renders a translated button label
- **THEN** it SHALL define or import an explicit message bag
- **AND** it SHALL call the local `m.<message>()` wrapper returned by
  `useMessage()`

#### Scenario: Direct generated namespace call is rejected

- **WHEN** production React source calls `m.common_save()` from an imported
  generated message namespace
- **THEN** convention checks SHALL reject the callsite
- **AND** the code SHALL be migrated to a `useMessage()` message bag
