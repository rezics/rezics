## Context

The project currently uses i18next + react-i18next across `package/app` (~71 files) and `package/admin` (separate locale directory). Translations are stored as monolithic TypeScript objects per language (5 languages: en-US, zh-SC, zh-TC, de-DE, ja-JP), all eagerly imported at startup. Type safety is achieved through i18next module augmentation against the en-US locale file.

Both app and admin maintain independent locale directories and i18n initialization logic. The translation keys are already semantically organized by feature domain within each monolithic file (e.g., `page.home.*`, `page.book_edit.*`, `review.*`).

Vite is configured with aggressive tree-shaking (`preset: 'smallest'`, `moduleSideEffects: false`), and TanStack Router provides route-level code splitting via `beforeLoad` hooks.

## Goals / Non-Goals

**Goals:**
- Create a standalone `@package/i18n` that both app and admin consume
- Migrate from i18next to typesafe-i18n for native TypeScript-first type generation
- Split translations into feature-aligned namespaces (~12) for per-route code splitting
- Lazy-load locales so only the active language is in the initial bundle
- Load namespaces on demand in route loaders via `Promise.all`
- Eliminate duplicate locale directories across app and admin

**Non-Goals:**
- Server-side i18n (backend packages do not use translations)
- Adding new languages or translations (content migration only)
- Integrating with external translation management platforms (Crowdin, Inlang)
- Changing the translation content itself (keys/values preserved, structure reorganized)

## Decisions

### D1: Base locale is en-US

**Choice**: Use `en-US` as the typesafe-i18n base locale. The default display language remains `zh-SC`.

**Rationale**: typesafe-i18n generates all types from the base locale. Using English as the base is the industry convention — it ensures compatibility with any future translation tooling, and English keys produce more readable generated type names and JSDoc hints. The runtime default language (`zh-SC`) is independent of the base locale choice.

**Alternative considered**: Using `zh-SC` as base since it's the primary audience language. Rejected because it would make generated type documentation less accessible to contributors and tooling.

### D2: Namespace-per-feature aligned with existing feature boundaries

**Choice**: ~12 namespaces mapped to existing feature domains.

| Namespace | Content | Consumers |
|-----------|---------|-----------|
| *(root)* | `title`, `motto`, `layout.*`, `common.*` | app, admin |
| `home` | `page.home.*` | app |
| `book` | `page.book.*`, `book_detail.*` | app |
| `book-edit` | `page.book_edit.*` | app |
| `readlist` | `page.readlist.*` | app |
| `review` | `review.*` | app |
| `quote` | `quote.*` | app |
| `comment` | `comment.*` | app |
| `search` | `search.*` | app |
| `user` | `user.*`, `auth.*`, `verify.*` | app, admin |
| `engagement` | `engagement.*`, `reaction.*` | app |
| `tag` | `tag.*` | app |
| `admin` | admin-dashboard-specific keys | admin |

**Rationale**: Matches the existing semantic grouping already present in the monolithic files. Features are self-contained — a book page uses book translations, not readlist translations. Cross-feature pages (like Home, which shows readlist/review/quote previews) load multiple namespaces in parallel via `Promise.all`, avoiding waterfall. Each namespace is ~1-2KB, small enough that parallel loading has negligible overhead.

**Alternative considered**: Fewer, coarser namespaces (e.g., merging quote+comment+engagement into "social"). Rejected because the current feature boundaries are clean and the chunk size is already small — merging would reduce tree-shaking benefit without meaningful performance gain.

### D3: Package structure with generator output at src/i18n/

**Choice**: The typesafe-i18n generator outputs to `package/i18n/src/i18n/`. The package re-exports the public API from `package/i18n/src/index.ts`.

```
package/i18n/
├── .typesafe-i18n.json
├── package.json
├── src/
│   ├── i18n/                        ← generator outputPath
│   │   ├── en-US/                   ← base locale
│   │   │   ├── index.ts
│   │   │   ├── home/index.ts
│   │   │   ├── book/index.ts
│   │   │   └── ...
│   │   ├── zh-SC/                   ← derived locales
│   │   ├── zh-TC/
│   │   ├── de-DE/
│   │   ├── ja-JP/
│   │   ├── formatters.ts
│   │   ├── custom-types.ts
│   │   ├── i18n-types.ts           ← generated
│   │   ├── i18n-util.ts            ← generated
│   │   ├── i18n-util.async.ts      ← generated
│   │   └── i18n-react.tsx          ← generated
│   └── index.ts                     ← public API
└── tsconfig.json
```

**Rationale**: Keeps user-editable files (locale content, formatters) and generated files co-located under `src/i18n/` as typesafe-i18n expects. The top-level `src/index.ts` provides a clean public API surface that re-exports only what consumers need.

### D4: Namespace loading via TanStack Router beforeLoad

**Choice**: Each route's `beforeLoad` hook calls `loadNamespaceAsync` for the namespaces it needs, wrapped in `Promise.all`.

```typescript
// Example: home route
export const Route = createFileRoute('/_mainLayout/')({
  beforeLoad: async () => {
    const locale = getLocale()
    await Promise.all([
      loadNamespaceAsync(locale, 'home'),
      loadNamespaceAsync(locale, 'readlist'),
      loadNamespaceAsync(locale, 'review'),
      loadNamespaceAsync(locale, 'quote'),
    ])
  },
})
```

**Rationale**: `beforeLoad` runs before the route component renders, ensuring translations are available synchronously during render (no loading flickers). `Promise.all` parallelizes the dynamic imports. Namespaces are cached after first load, so subsequent navigations to routes sharing namespaces incur no additional cost.

**Alternative considered**: Loading namespaces inside components via `useEffect`. Rejected because it causes a render-then-load-then-re-render cycle (flash of untranslated content).

### D5: Locale detection and persistence via app-shell

**Choice**: Retain the existing localStorage-based language persistence in `package/app-shell`. The detected/stored locale is passed to `loadLocaleAsync()` at app init and to `<TypesafeI18n locale={...}>` as a prop.

**Rationale**: `package/app-shell` already manages language selection and persistence via `useAppInit`. This responsibility stays there — only the underlying i18n library call changes (from `i18n.changeLanguage()` to `setLocale()` + `loadLocaleAsync()`).

### D6: Generator configuration

**Choice**: `.typesafe-i18n.json` at `package/i18n/` root:

```json
{
  "$schema": "https://unpkg.com/typesafe-i18n/schema/typesafe-i18n.json",
  "adapter": "react",
  "baseLocale": "en-US",
  "outputPath": "./src/i18n/",
  "outputFormat": "TypeScript",
  "esmImports": true
}
```

**Rationale**: `esmImports: true` adds `.js` extensions to generated imports, compatible with the project's ESM-only setup. The React adapter generates `i18n-react.tsx` with the provider and `useI18nContext` hook.

## Risks / Trade-offs

**[Library maintenance]** The original typesafe-i18n author passed away in 2023; the project is now community-maintained under `codingcommons`. → The library is stable and feature-complete. The runtime is ~1KB with no external dependencies, minimizing supply-chain risk. If the project becomes unmaintained, the generated code is self-contained and can be forked or frozen.

**[Migration scope]** ~71+ files must change their i18n hook calls and key access patterns. → Migration is mechanical: `useTranslation()` → `useI18nContext()`, `t('key.path')` → `LL.namespace.key()`. This can be done incrementally per feature directory, with both systems coexisting during transition if needed.

**[Key format change]** i18next uses dot-path strings (`t('page.home.hero.title')`), typesafe-i18n uses typed function chains (`LL.home.hero.title()`). → The key structure is preserved; only the access pattern changes. TypeScript will catch every missed migration at compile time since `t()` won't exist after removing i18next.

**[Build step dependency]** typesafe-i18n generator must run before TypeScript compilation to produce types. → Add `typesafe-i18n --no-watch` to the build script. In dev mode, the generator runs in watch mode alongside Vite. CI runs the generator once before `tsc`.

**[Namespace loading overhead]** Each namespace is a separate dynamic import / HTTP request. → Chunks are ~1-2KB each. HTTP/2 multiplexes concurrent requests. Namespaces are session-cached after first load. Worst case (home page) loads 5 namespaces in parallel — negligible overhead vs. the 17KB monolithic alternative.

## Migration Plan

1. **Phase 1 — Package scaffold**: Create `package/i18n` with typesafe-i18n config, migrate en-US translations as the base locale (splitting into namespaces), derive the other 4 locales.
2. **Phase 2 — Integration**: Wire `@package/i18n` into app and admin providers. Update route loaders with namespace loading. Update `app-shell` locale switching to use the new API.
3. **Phase 3 — Consumer migration**: Migrate all `useTranslation()` / `t()` call sites to `useI18nContext()` / `LL`. This is done per feature directory.
4. **Phase 4 — Cleanup**: Remove i18next and react-i18next dependencies, delete old locale directories and the i18next type declaration file.

Rollback: Since both systems can coexist (i18next and typesafe-i18n are independent), Phase 3 can be done incrementally. If issues arise, revert to i18next by restoring the old provider without losing translation content.

## Open Questions

- Should formatters replicate any i18next interpolation behavior (e.g., `{{year}}` in copyright string), or should these be converted to typesafe-i18n's `{year}` syntax during migration?
- Are there any i18next plugins in use beyond `initReactI18next` (e.g., pluralization rules, backend loaders) that need equivalent typesafe-i18n formatters?
