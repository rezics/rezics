## Why

The Paraglide-based frontend i18n stack blocks two of our most important
delivery patterns. First, Paraglide tightly couples locale to build output: the
React adapter and SSR pipeline must agree on the active locale at compile time,
which makes pure client-side locale switching brittle and unable to lazy-load
per-locale data on demand. Second, every consumer of `@rezics/i18n` and
`@rezics/ui` is forced to bundle all six locales, which destroys library
autonomy: a downstream product that ships with three languages still pays for
the messages of products it does not ship.

The repository now has 1,940 message keys × 6 locales, ~108–131 KB raw JSON per
locale, and ~293 redundant keys (200 duplicate value groups). At this scale,
runtime i18n with namespace-based code splitting cuts initial bundle to
~12–15 KB gzip (current locale only) versus ~80–100 KB today, while removing
the SSR coupling and unlocking real package-level locale autonomy.

## What Changes

- **BREAKING**: Replace the Paraglide toolchain (`@inlang/paraglide-js`,
  `project.inlang/`, generated `paraglide/messages.js` outputs) with
  `i18next` + `react-i18next` + `i18next-http-backend` +
  `i18next-browser-languagedetector`.
- **BREAKING**: Re-architect translation source layout from monolithic
  `package/i18n/messages/{locale}.json` to per-locale, per-namespace files
  under `public/locales/{lng}/{ns}.json` served statically as fetchable
  assets.
- **BREAKING**: Replace tree-shakable Paraglide `m.<key>()` call sites with
  `useTranslation('<ns>').t('<ns>:<key>')` in app, admin, and UI packages.
  Flat key style is preserved (no nested JSON objects); namespace prefix
  replaces the underscore-prefix convention.
- **BREAKING**: Collapse the 57 underscore prefixes into a curated set of
  ~9 product namespaces + `admin` + `ui`, merging tiny prefixes (<15 keys)
  into the closest domain bucket and deduplicating ~120 redundant key groups
  into `common`.
- Add a bootstrap loader that fetches `common`, `shell`, and `auth`
  namespaces in parallel on app boot, with all other namespaces loaded
  lazily on first route/component use via `i18next.loadNamespaces` or
  `useTranslation` suspense.
- Add pure-frontend locale switching: `i18next.changeLanguage(locale)` swaps
  every already-loaded namespace in a single batch fetch, persisting the
  selection to `localStorage`.
- Add `@rezics/ui` locale autonomy: the UI package ships its own
  `locales/{locale}.ts` ES modules, dynamically imported and registered by
  consumers via `i18n.addResourceBundle(locale, 'ui', messages)`. Adding a
  new UI locale does not require any consumer rebuild beyond version bump.
- Add `bun run check:i18n` script that statically scans all `t('ns:key')`
  call sites, compares against namespace JSON files, and reports missing
  keys, unused keys, and per-locale gaps. Replaces Paraglide's compile-time
  key check; wired into `lefthook` pre-commit and CI.
- Remove `@inlang/paraglide-js` dependency, `i18n:compile` build steps,
  `project.inlang/` directories, and the `package/i18n/src/paraglide/`
  generated output. `@rezics/i18n` becomes a thin runtime wrapper around
  i18next plus the locale registry adapter.

## Capabilities

### New Capabilities

- `i18n-namespace-architecture`: Defines the canonical namespace map (which
  underscore prefixes consolidate into which namespace), the file layout
  `public/locales/{lng}/{ns}.json`, the bootstrap namespace list, and the
  route-lazy loading rules. Also defines the dedup classification (semantic
  vs accidental string collisions) used when collapsing duplicate keys into
  `common`.

### Modified Capabilities

- `i18n-toolchain`: Replace Paraglide compile-time generation with runtime
  i18next loading. Toolchain now publishes static JSON assets, not
  generated message functions. Locale codes and source-file format
  requirements carry over.
- `react-i18n-adapter`: Re-base the adapter on `react-i18next`'s
  `I18nextProvider` and `useTranslation`. Adapter still owns active-locale
  state and provides a single subscription point shared across app, admin,
  UI, and Storybook, but the underlying mechanism switches from
  Paraglide runtime registration to i18next namespace registration plus
  `addResourceBundle` injection.
- `ui-package-autonomy`: Replace the Paraglide-based UI message generation
  requirement with the new UI locale-bundle distribution model: `@rezics/ui`
  ships per-locale ES modules, consumers dynamically import and register
  them, and the UI package can add new locales independently of any
  consuming app's build.
- `multilingual-ui`: Replace `m.<key>()` resolution requirements with
  `t('<ns>:<key>')` resolution. The canonical locale set, fallback chain
  semantics, and per-component coverage requirements (homepage sections,
  search components) carry over unchanged.

## Impact

**Affected packages**:

- `package/i18n/` — heavy rewrite. Removes `project.inlang/`, the
  `src/paraglide/` generated output, and Paraglide deps. Adds i18next
  initialization, namespace registry, locale detector wiring, and the React
  adapter wrapper. The `./messages`, `./runtime`, and `./react` subpath
  exports are redefined.
- `package/ui/` — removes its own `project.inlang/`, adds
  `package/ui/locales/{locale}.ts` ES modules and a `registerUiLocale(i18n)`
  helper. Replaces internal `m.<key>()` calls with `t('ui:<key>')`.
- `package/app/` and `package/admin/` — every `m.<key>()` call site
  rewritten to `t('<ns>:<key>')`. Each app gains a bootstrap module that
  initializes i18next, registers the UI locale bundle for the active
  locale, and primes the namespace loader.
- `package/storybook-config/` — refactors its locale shim to use the
  i18next-based adapter.
- `package/contract/` — `LANGUAGES` and `languageSchema` are unchanged; the
  canonical six-locale set carries over.
- Build pipeline — `bun run i18n:compile` becomes a no-op or is removed
  from root `postinstall` and per-package `dev`/`build` scripts. The new
  `bun run check:i18n` script runs in `lefthook` pre-commit and CI.

**Affected dependencies**:

- Removed: `@inlang/paraglide-js`.
- Added: `i18next`, `react-i18next`, `i18next-http-backend`,
  `i18next-browser-languagedetector`, and `i18next-parser` (for the
  `check:i18n` script).

**Backward compatibility**: Not preserved. This is a clean cutover. All
internal call sites are migrated in a single change; no Paraglide bridge
is kept. Public-facing locale codes (`zh-hant`, `zh-hans`, `en`, `ja`,
`de`, `ko`) and the persisted `localStorage` locale key are preserved so
existing users keep their language preference.

**Migration safety**: The dedup step (~120 truly mergeable duplicate
groups) is performed in a dedicated commit with a human-reviewable report
before any callsite codemod runs, so the namespace split, key renames,
and runtime swap can be bisected independently if regressions surface.
