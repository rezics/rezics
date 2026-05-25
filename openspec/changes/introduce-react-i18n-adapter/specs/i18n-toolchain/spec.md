## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Active locale is shell-owned

**Reason**: Shell-local ownership cannot make package-local UI components and
route components independently reactive while preserving Paraglide tree
shaking.

**Migration**: App/admin shells SHALL initialize the shared React adapter,
register the product/domain and UI runtimes, and call the adapter setter from
language controls.

### Requirement: Shell-level locale helper lives in the app/admin shell

**Reason**: Duplicated shell helpers keep active-locale fanout outside the
React adapter and prevent `@rezics/ui` components from sharing the same
subscription source in app, admin, and Storybook.

**Migration**: Replace shell-local `setRezicsLocale`/`initRezicsLocale`
helpers with the shared adapter initialization and runtime registration APIs.
