## Context

Rezics already compiles product/domain messages in `@rezics/i18n` and
component-internal UI messages in `@rezics/ui` with Paraglide. Generated
message functions are tree-shakable because consumers can import explicit ESM
exports instead of resolving translations through runtime string keys.

The current dynamic language switching path is incomplete:

```text
app/admin language control
  -> shell-local setRezicsLocale()
  -> set @rezics/i18n runtime locale
  -> set @rezics/ui runtime locale
  -> notify a small React subscriber set
  -> rely on parent/router invalidation to make direct m.xxx() calls re-run
```

That model does not make each translated React component a locale subscriber.
TanStack Router and React memoization can keep route elements stable, and
`@rezics/ui` components have no independent subscription when they render
package-owned text. The migration needs a React adapter that preserves
Paraglide's message-level tree shaking while making locale changes reactive at
the component level.

## Goals / Non-Goals

**Goals:**

- Provide one shared React locale store and adapter API for app, admin, UI, and
  Storybook.
- Standardize React rendering on `const m = useMessage(messageBag)` followed by
  `m.xxx(inputs?)`.
- Keep message functions as explicit static imports so unused translations stay
  tree-shakable.
- Let `@rezics/ui` components render their own package-local messages and
  update dynamically when the host locale changes.
- Remove duplicated app/admin locale helper logic.
- Keep Paraglide runtime exports synchronized for non-React callers.

**Non-Goals:**

- Do not introduce `t("string.key")`, dynamic message lookup, or runtime
  dictionaries.
- Do not add a global message registry or provider-level `messages={...}` API.
- Do not require full-page reloads for normal language changes.
- Do not change the canonical locale set or message source file format.
- Do not merge UI package messages into product/domain message catalogs.

## Decisions

### Decision 1: `@rezics/i18n/react` is a neutral React adapter

`@rezics/i18n/react` will export locale-store and React APIs, but it must not
import generated product messages, generated UI messages, or Paraglide runtimes
by default.

The adapter surface should include:

```ts
useLocale(): Language
useSetLocale(): (locale: Language) => void
useMessage<TBag extends MessageBag>(bag: TBag): ReactiveMessageBag<TBag>
registerParaglideRuntime(runtime: RegisteredRuntime): () => void
initI18n(options: InitOptions): void
setLocale(locale: Language): void
getLocale(): Language
subscribeLocale(listener: () => void): () => void
```

`package/app` and `package/admin` will import product and UI runtimes and
register them with the adapter during bootstrap. `package/ui` components will
import only `useMessage` from `@rezics/i18n/react` and their own generated UI
message functions.

Alternative considered: keep shell-local helpers and only expose a hook from
each package. That would preserve the current split but duplicate active-locale
state and keep `@rezics/ui` dependent on host rerenders.

### Decision 2: React callsites use message bags and local `m.xxx()`

React components will import the specific generated message functions they need
and group them into explicit message bags:

```tsx
import { useMessage } from "@rezics/i18n/react";
import { common_save, common_cancel } from "@rezics/i18n/messages";

const settingsMessages = {
  common_save,
  common_cancel,
};

function SettingsActions() {
  const m = useMessage(settingsMessages);

  return <button>{m.common_save()}</button>;
}
```

`useMessage()` subscribes to the locale store and returns an object whose
properties preserve each message function's input signature. Each wrapper calls
the underlying message function with the current locale passed explicitly in
the options object. This avoids relying on mutable global runtime state during
React render.

Alternative considered: return a callable `m(messageFn, inputs?)` resolver.
That form is valid for tree shaking, but the project will standardize on the
first `m.xxx()` form for readability and lower migration ambiguity.

### Decision 3: Tree shaking is protected by API shape and conventions

The adapter must never import from `@rezics/i18n/messages`,
`@rezics/ui/i18n/messages`, or generated message indexes. It must not expose a
message registry, string-key resolver, Proxy over all messages, or provider API
that accepts full catalogs.

React production code must not import `* as m` from generated messages. It must
import named message functions and pass an explicit message bag to
`useMessage()`. Dynamic message selection must use statically-defined maps
whose values are direct message function references.

Alternatives considered:

- `import * as m` plus direct `m.xxx()` calls. This keeps old code but is not
  reactive unless a parent remounts or rerenders it.
- `import * as m` plus a proxy wrapper. This is easy to type poorly, can pull
  full catalogs into bundles, and cannot call hooks inside `m.xxx()`.
- `t("key")`. This loses Paraglide's key-static model and tree shaking.

### Decision 4: Runtime registration synchronizes package-local Paraglide state

The adapter will own active locale. Registered runtimes receive fanout updates:

```text
setLocale("ja")
  -> normalize and persist adapter locale
  -> call original @rezics/i18n setLocale("ja", { reload: false })
  -> call original @rezics/ui setLocale("ja", { reload: false })
  -> emit React subscribers
```

Registration captures each runtime's original `getLocale`, `setLocale`,
`overwriteGetLocale`, and `overwriteSetLocale` functions. After registration,
runtime-level `getLocale()` and `setLocale()` should delegate to the shared
adapter store, while fanout uses the captured originals to avoid recursion.

Alternative considered: call package runtimes directly from app/admin whenever
language changes. That does not help `@rezics/ui` components in standalone
Storybook and keeps locale ownership split.

### Decision 5: `@rezics/ui` may depend on the neutral adapter subpath

`@rezics/ui` remains autonomous from app/admin shells, routers, API clients, and
product/domain message catalogs. It may import `@rezics/i18n/react` for locale
reactivity because that subpath is a neutral shared adapter and does not import
product messages or shell code.

UI package components must import their own generated messages from
`#/paraglide/messages.js` or `@rezics/ui/i18n/messages` and bind them through
`useMessage()`.

Alternative considered: add `@rezics/ui/i18n/react` with a separate locale
store. That would keep package boundaries stricter but would break coordinated
dynamic switching unless the host bridged two React stores.

## Risks / Trade-offs

- [Risk] Passing inline object literals to `useMessage()` can recreate wrapper
  objects every render. → Mitigation: convention and examples require
  module-scope message bags; tests should cover stable behavior with
  module-scope bags.
- [Risk] Existing module-scope resolved strings will not update dynamically. →
  Mitigation: migration tasks require moving localized string resolution into
  React render paths or storing message functions/descriptors instead of
  strings.
- [Risk] `@rezics/ui` gains a dependency on `@rezics/i18n`. → Mitigation: limit
  the dependency to the neutral `@rezics/i18n/react` subpath and enforce that
  the subpath imports no generated messages or shell code.
- [Risk] Type inference for generated message inputs can regress if wrapper
  types are too broad. → Mitigation: add type-level tests for no-input,
  required-input, optional-input, and options-preserving messages.
- [Risk] Runtime registration can recurse if overwritten setters call the
  adapter fanout path incorrectly. → Mitigation: capture original runtime
  setters before overwriting and use those originals only for fanout.
- [Risk] Bundle size can regress if migration introduces namespace imports or
  registries. → Mitigation: add convention checks and a bundle fixture that
  proves an unused sentinel message is not included.

## Migration Plan

1. Implement the neutral adapter in `package/i18n/src/react.ts` without
   importing generated messages or UI package code.
2. Add adapter tests for locale store behavior, runtime registration,
   `useMessage()` reactivity, and TypeScript inference.
3. Add a small bundle/tree-shaking fixture that imports one message and
   verifies unrelated generated messages are not emitted.
4. Register product/domain and UI Paraglide runtimes in app/admin bootstrap and
   Storybook setup.
5. Migrate `package/ui` components with package-owned copy to UI message bags
   and `useMessage()`.
6. Migrate app/admin React UI copy from generated namespace imports and direct
   `m.xxx()` calls to named imports, module-scope message bags, and
   `const m = useMessage(bag)`.
7. Convert config arrays and helper maps that currently store localized strings
   so they store message functions or descriptors and resolve through
   `useMessage()` in render.
8. Remove duplicated app/admin locale helpers and update language controls to
   call the shared adapter `setLocale()`.
9. Extend convention checks to reject new direct generated namespace imports in
   React production UI code, runtime-key lookup, and adapter-to-message imports.
10. Run app/admin/UI tests, format, convention checks, and a targeted manual
    verification pass through app and admin language switching.

Rollback is not a target because this is an internal development-stage cutover.
If implementation discovers an issue, revert the change branch before merging
rather than keeping a compatibility layer in production source.

## Open Questions

- Should the convention check allow `import * as productMessages` in tests only,
  or require named imports everywhere except generated files?
- Should app/admin initialize from `localStorage`, cookie, or both? The adapter
  should preserve the current `lang` localStorage behavior unless a separate
  routing/i18n proposal changes persistence.
