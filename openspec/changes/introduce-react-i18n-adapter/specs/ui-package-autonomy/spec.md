## ADDED Requirements

### Requirement: UI package may use neutral i18n React adapter

`@rezics/ui` MAY import `@rezics/i18n/react` for active-locale subscriptions
and message binding. That adapter subpath SHALL remain neutral: it SHALL NOT
import app/admin shell code, routers, API clients, product/domain generated
messages, or UI generated messages.

#### Scenario: UI component imports the adapter

- **WHEN** a reusable UI component needs dynamic localization for
  component-internal copy
- **THEN** it MAY import `useMessage` from `@rezics/i18n/react`
- **AND** it SHALL import its message functions from the UI package's generated
  message output

#### Scenario: UI package avoids product messages

- **WHEN** source under `package/ui/src/` is inspected
- **THEN** it SHALL NOT import generated product/domain messages from
  `@rezics/i18n/messages`
- **AND** it SHALL NOT import app/admin locale helpers

## MODIFIED Requirements

### Requirement: Core UI export surfaces avoid host runtime imports

The following `@rezics/ui` surfaces SHALL NOT import `@tanstack/react-router`,
`@rezics/api`, `@rezics/server`, app/admin feature internals, product/domain
generated messages, or app/admin locale helpers:

- Root core exports intended for common UI consumption.
- `@rezics/ui/shadcn`.
- `@rezics/ui/uno.config`.
- `@rezics/ui/config/*`.
- UI-local i18n exports.
- Common primitive and composite exports that do not explicitly document
  themselves as host adapters.

These surfaces MAY import the neutral `@rezics/i18n/react` adapter for locale
reactivity, provided the imported adapter subpath does not load generated
message catalogs or host-owned runtime code.

#### Scenario: Consumer imports shadcn primitives

- **WHEN** a consumer imports `Button`, `Dialog`, or `Select` from
  `@rezics/ui/shadcn`
- **THEN** that import surface SHALL NOT require router, API, server, or
  app/admin feature modules

#### Scenario: Consumer imports UnoCSS config

- **WHEN** a consumer imports `createUnoConfig` from `@rezics/ui/uno.config`
- **THEN** the config import SHALL NOT require router, API, server, editor, or
  app/admin feature modules

#### Scenario: Consumer imports translated UI component

- **WHEN** a consumer imports a UI component that renders package-owned
  translated text
- **THEN** that component MAY require the neutral React i18n adapter
- **AND** it SHALL NOT require product/domain message catalogs
