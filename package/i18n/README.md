# @rezics/i18n

Shared product and domain translations for Rezics frontends.

## Paraglide

- Edit source messages in `messages/{locale}.json`.
- Run `bun --filter=@rezics/i18n run compile` after changing messages.
- Import product messages from `@rezics/i18n/messages` or helpers from
  `@rezics/i18n`.
- Do not edit `src/paraglide/` by hand.
- Frontend UI copy must call generated message functions directly:

```ts
import * as m from "@rezics/i18n/messages";

m.common_save();
m.review_validation_min_chars();
m.book_hero_meta_chapter_count({ count });
```

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

For any new displayable contract enum, add messages for all five locales and a
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
