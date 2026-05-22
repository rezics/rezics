# @rezics/i18n

Shared product and domain translations for Rezics frontends.

## Paraglide

- Edit source messages in `messages/{locale}.json`.
- Run `bun --filter=@rezics/i18n run compile` after changing messages.
- Import product messages from `@rezics/i18n/messages` or helpers from `@rezics/i18n`.
- Do not edit `src/paraglide/` by hand.

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
