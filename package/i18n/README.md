# @rezics/i18n

Shared product and domain translations for Rezics frontends. The runtime is
`i18next` + `react-i18next` with namespace-scoped lazy loading.

## Layout

- Source translations live under `package/i18n/locales/{locale}/{ns}.json`.
- Namespaces are: `common`, `shell`, `auth` (bootstrap); `book`, `page`,
  `entity`, `community`, `search`, `settings`, `editor`, `admin`
  (route-lazy, `admin` admin-only); `ui` (bundled with `@rezics/ui`). New
  keys use the namespace matching the closest existing prefix; cross-domain
  generic words go in `common`. `task check:i18n` enforces coverage.
- Vite serves the tree at `/locales/<lng>/<ns>.json` via the
  `rezicsI18nLocales()` plugin from `@rezics/i18n/vite`.

## Bootstrap

App and admin mount the shared runtime once at the React root:

```tsx
import { RezicsI18nProvider } from "@rezics/i18n/react";

export default function App() {
  return (
    <RezicsI18nProvider>
      <Suspense fallback={null}>
        <Router />
      </Suspense>
    </RezicsI18nProvider>
  );
}
```

The provider triggers a parallel fetch of the bootstrap namespaces
(`common`, `shell`, `auth`) for the detected locale and suspends the React
tree until they resolve.

## Translation in components

```tsx
import { useTranslation } from "@rezics/i18n/react";

export function SaveButton() {
  const { t } = useTranslation(["common"]);
  return <button>{t("common:save")}</button>;
}
```

For dynamic slugs, dispatch through a typed `<slug>:` map:

```ts
const PROVIDER_KEY = {
  github: "auth:flow_providers_github",
  google: "auth:flow_providers_google",
} as const satisfies Record<AuthProviderSlug, `auth:${string}`>;

export const providerLabel = (provider: AuthProviderSlug): string =>
  getI18nRuntime().i18n.t(PROVIDER_KEY[provider]);
```

## Contract enum labels

Contract definitions stay free of translation keys. Labels live here as
typed maps that resolve via i18next:

```ts
const ENTITY_KIND_KEY = {
  person: "entity:kind_person",
} as const satisfies Record<EntityKind, `entity:${string}`>;

export const entityKindLabel = (kind: EntityKind): string =>
  getI18nRuntime().i18n.t(ENTITY_KIND_KEY[kind]);
```

When adding a displayable contract enum, add entries for every supported
locale and a `<enum>Label(key)` helper guarded with `satisfies` so missing
entries are caught at type-check time.

## Locale switching

Use `setLocale(locale)` from `@rezics/i18n/react`. It calls
`i18next.changeLanguage`, fetches every loaded namespace's copy for the
new locale, and persists the selection to
`localStorage['rezics-locale']`. No reload or remount is required.

## Adding a key

1. Add the key to `package/i18n/locales/en/<ns>.json` and every other
   locale file.
2. Reference it from React with `t('<ns>:<key>')`.
3. Run `task check:i18n` to catch missing entries or unused keys
   before commit; the same check runs in lefthook pre-commit.
