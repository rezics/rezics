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

The React i18n adapter SHALL provide a single active-locale store shared
by app, admin, UI components, and Storybook. The store SHALL be the
shared `i18next` instance owned by `@rezics/i18n`, accessed by React
components via the `I18nextProvider` rooted at each app/admin shell.
The adapter SHALL validate all locale writes through the canonical
language registry before delegating to `i18next.changeLanguage`.

#### Scenario: Component observes language change

- **WHEN** a React component uses `useTranslation('<ns>')` and the
  active locale changes from `zh-hant` to `en`
- **THEN** the component SHALL re-render from the new locale snapshot
- **AND** no full page reload SHALL be required

#### Scenario: Invalid locale is rejected

- **WHEN** a caller attempts to set the active locale to `en-US`
- **THEN** the adapter SHALL reject or normalize the value according to
  the canonical language registry
- **AND** `i18next.changeLanguage` SHALL only be invoked with a
  canonical Rezics language code

### Requirement: Adapter does not import generated messages

The React i18n adapter source SHALL NOT statically import any
namespace JSON file. All translation resources SHALL reach the
runtime through the HTTP backend (for app/admin namespaces) or
through `i18next.addResourceBundle` (for the UI package's locale
bundles).

#### Scenario: Adapter source is inspected

- **WHEN** source for `@rezics/i18n/react` is inspected
- **THEN** it SHALL NOT import any JSON file under
  `public/locales/`
- **AND** it SHALL NOT import any `@rezics/ui/locales/*` module

#### Scenario: Unused namespace remains unfetched

- **WHEN** an app boots and only the bootstrap namespaces are used
  on first paint
- **THEN** no HTTP fetch SHALL be issued for non-bootstrap namespace
  JSON files until a component requests them

### Requirement: UI package components remain dynamically localized

Reusable `@rezics/ui` components that render package-owned text SHALL
call `useTranslation('ui')` against the shared i18next instance. When
a host application changes the active locale, those components SHALL
update without host-level remounting.

#### Scenario: UI component updates inside app

- **WHEN** app renders a `@rezics/ui` password field that defaults
  its label from the `ui` namespace
- **AND** the user changes the active locale from `en` to `zh-hant`
- **THEN** the password field's default label and visibility text
  SHALL render in Traditional Chinese
- **AND** the component instance SHALL NOT remount

#### Scenario: Host override remains host-owned

- **WHEN** a host passes an explicit string override prop to a UI
  component
- **THEN** the UI component SHALL render that override as supplied
- **AND** dynamic localization of the override SHALL be the host's
  responsibility

### Requirement: Translation binding via useTranslation

The React i18n adapter SHALL re-export `useTranslation` from
`react-i18next` as the canonical React binding for namespace-scoped
translation. Callers SHALL request one or more namespaces via the
hook argument and SHALL resolve keys via the returned `t` function.

#### Scenario: Component renders a static message

- **WHEN** a component calls `const { t } = useTranslation('common')`
  and renders `t('common:save')`
- **THEN** the rendered string SHALL be the `save` value from
  `public/locales/<active-locale>/common.json`

#### Scenario: Component requests multiple namespaces

- **WHEN** a component calls `useTranslation(['book', 'common'])`
- **THEN** the hook SHALL trigger lazy loading for `book` if not
  already loaded
- **AND** the returned `t` SHALL resolve keys from both namespaces

#### Scenario: Message inputs are passed via t options

- **WHEN** a key contains interpolation placeholders such as
  `{{count}}`
- **THEN** the caller SHALL pass values through `t(key, { count })`
- **AND** the rendered string SHALL substitute interpolation values
  according to i18next semantics

### Requirement: UI locale bundles register via addResourceBundle

The adapter SHALL accept package-owned locale bundles registered via
`i18next.addResourceBundle(locale, namespace, resources, true, true)`.
Registered bundles SHALL receive active-locale updates without
requiring the registering package to fetch JSON from the HTTP
backend.

#### Scenario: UI package registers its locale

- **WHEN** an app or admin bootstrap calls
  `await registerUiLocale(i18n, i18n.language)` from
  `@rezics/ui/i18n`
- **THEN** the `ui` namespace for that locale SHALL be available via
  `i18next.t('ui:<key>')`
- **AND** the registration SHALL NOT issue any HTTP request

#### Scenario: UI locale updates on language change

- **WHEN** the app changes language to `ja` and a `languageChanged`
  listener calls `registerUiLocale(i18n, 'ja')`
- **THEN** the `ui` namespace SHALL be replaced with the Japanese
  bundle in place
- **AND** `@rezics/ui` components SHALL re-render with Japanese copy
  without remount

