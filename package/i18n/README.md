# @rezics/i18n

Shared product and domain translations for Rezics frontends.

## Paraglide

- Edit source messages in `messages/{locale}.json`.
- Run `bun --filter=@rezics/i18n run compile` after changing messages.
- Import product messages by name from `@rezics/i18n/messages` or helpers from
  `@rezics/i18n`.
- Do not edit `src/paraglide/` by hand.
- React UI copy must bind explicit message bags through `@rezics/i18n/react`:

```tsx
import { common_save } from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";

const messages = { common_save };

export function SaveButton() {
  const m = useMessage(messages);
  return <button>{m.common_save()}</button>;
}
```

- App/admin bootstrap must register Paraglide runtimes before React renders:

```ts
import { initI18n, registerParaglideRuntime } from "@rezics/i18n/react";
import * as productRuntime from "@rezics/i18n/runtime";
import * as uiRuntime from "@rezics/ui/i18n/runtime";

registerParaglideRuntime(productRuntime);
registerParaglideRuntime(uiRuntime);
initI18n();
```

- `@rezics/i18n/react` is a neutral adapter. It must not import generated
  message catalogs, UI package code, routers, API clients, or app/admin shell
  modules.
- Named imports and module-scope message bags keep Paraglide output
  tree-shakeable. Do not import `* as m` from generated message catalogs in
  production React code, and do not introduce global message registries.
- Do not use runtime string-key resolvers, fallback string arguments, or
  `useTranslation().t(...)` for UI copy.

## Contract Enum Labels

Contract packages expose discriminator keys, not translation keys. Display labels
live here as explicit maps:

```ts
const ENTITY_KIND_MESSAGE = {
  person: m.entity_kind_person,
} as const satisfies Record<EntityKind, () => string>;

export const entityKindLabel = (kind: EntityKind) =>
  ENTITY_KIND_MESSAGE[kind]();
```

For any new displayable contract enum, add messages for all six supported UI
locales (`zh-hant`, `zh-hans`, `en`, `ja`, `de`, and `ko`) and a
`<enum>Label(key)` helper guarded with `satisfies Record<EnumKey, () => string>`.
Do not use dynamic Paraglide access such as `m[runtimeKey]()`.

## Dynamic Slug Labels

When a runtime slug selects one label from a known set, normalize it to a typed
union and dispatch through a static slug-to-function map:

```ts
const PROVIDER_LABEL = {
  github: m.auth_flow_providers_github,
  google: m.auth_flow_providers_google,
} as const satisfies Record<AuthProviderSlug, () => string>;

export function providerLabel(provider: AuthProviderSlug) {
  return PROVIDER_LABEL[provider]();
}
```

Shared domain slug maps belong in this package. Feature-local UI slug maps can
stay near their feature, but they must use the same explicit map pattern.
