## 1. Dedup analysis (non-breaking)

- [ ] 1.1 Add `scripts/i18n/analyze-duplicates.ts` that reads
  `package/i18n/messages/en.json`, groups keys by value, and emits
  `scripts/i18n/dedup-report.json` listing each duplicate group with
  callsite counts per package (via grep of `m\.<key>\(` in
  `package/{app,admin,ui}/src`).
- [ ] 1.2 Run the analyzer and review the output. Annotate each group
  in `dedup-report.json` with `classification: 'semantic' | 'accidental'`
  and a reviewer initial. Default to `accidental` for any group whose
  call sites span ≥3 distinct underscore prefixes.
- [ ] 1.3 Commit `scripts/i18n/analyze-duplicates.ts` and the annotated
  `dedup-report.json`. No source files are modified in this commit.

## 2. Namespace map and split (non-breaking)

- [ ] 2.1 Add `scripts/i18n/namespace-map.ts` exporting a typed
  `PREFIX_TO_NAMESPACE: Record<string, Namespace>` covering every
  underscore prefix listed in `i18n-namespace-architecture/spec.md`.
- [ ] 2.2 Add `scripts/i18n/split-locales.ts` that reads
  `package/i18n/messages/{locale}.json`, applies the namespace map,
  applies the `semantic` merges from `dedup-report.json` (rewriting
  merged keys to their canonical `common:*` form), and writes
  `public/locales/{locale}/{ns}.json` for every locale and namespace.
- [ ] 2.3 Add `scripts/i18n/key-map.json` emitted by the split:
  `{ "<old_flat_key>": "<ns>:<new_key>" }` for every original key,
  including identity mappings for unchanged keys. This file drives the
  callsite codemod in section 5.
- [ ] 2.4 Run the splitter. Verify by reloading the JSON output and
  counting keys per namespace per locale; numbers SHALL match the
  table in `design.md` decision D3 within a tolerance of the dedup
  delta.
- [ ] 2.5 Commit `scripts/i18n/{namespace-map.ts,split-locales.ts,key-map.json}`
  and the generated `public/locales/` tree. Do not delete
  `package/i18n/messages/` yet.

## 3. i18next runtime in `@rezics/i18n` (non-breaking)

- [ ] 3.1 Add runtime dependencies to `package/i18n/package.json`:
  `i18next`, `react-i18next`, `i18next-http-backend`,
  `i18next-browser-languagedetector`. Keep `@inlang/paraglide-js` for
  now.
- [ ] 3.2 Create `package/i18n/src/runtime.ts` that exports an
  initialized i18next instance with bootstrap NS
  `['common', 'shell', 'auth']`, `defaultNS: 'common'`,
  `fallbackLng: 'en'`, `load: 'currentOnly'`,
  `supportedLngs` matching `LANGUAGES`, locale detection order
  `localStorage → cookie → navigator`, `lookupLocalStorage: 'rezics-locale'`,
  and `backend.loadPath: '/locales/{{lng}}/{{ns}}.json'`.
- [ ] 3.3 Create `package/i18n/src/react.tsx` that re-exports
  `I18nextProvider`, `useTranslation`, `Trans`, and provides a
  `RezicsI18nProvider` component wrapping `I18nextProvider` with the
  runtime instance from step 3.2.
- [ ] 3.4 Add a `ResourceNamespaceMap` declaration in
  `package/i18n/src/types.d.ts` covering every namespace listed in
  `i18n-namespace-architecture/spec.md`. Types resolve from
  `public/locales/en/{ns}.json` via `import type` JSON modules.
- [ ] 3.5 Update `package/i18n/package.json` exports: add
  `./runtime` → `src/runtime.ts`, `./react` → `src/react.tsx`. Keep
  `./messages` exporting the existing Paraglide output for now (no
  consumer break).
- [ ] 3.6 Run `bun --filter=@rezics/i18n run build` and `tsc --noEmit`
  for the package; both SHALL succeed with the new runtime alongside
  the existing Paraglide output.

## 4. Static asset wiring

- [ ] 4.1 Update Vite config in `package/app/vite.config.ts` and
  `package/admin/vite.config.ts` to serve `public/locales/` and copy
  it to dist on build. Confirm `bun --filter=@rezics/app run dev`
  resolves `GET /locales/en/common.json`.
- [ ] 4.2 Add an HTTP cache header strategy: long max-age on the
  per-locale JSONs, served as static assets. Document the deploy
  expectation in `package/app/README.md` and `package/admin/README.md`
  if those READMEs cover deploy.
- [ ] 4.3 Add a Storybook locale-provider shim in
  `package/storybook-config/src/i18n.tsx`: an alternative
  `RezicsI18nProvider` that preloads bootstrap namespaces from
  `public/locales/` via `fs`/import for the static Storybook build.

## 5. Callsite codemod (breaking commit)

- [ ] 5.1 Add `scripts/i18n/codemod-paraglide-to-i18next.ts` (jscodeshift
  or simple AST/regex) that:
  - Replaces `m.<key>()` with `t('<ns>:<key>')` using `key-map.json`.
  - Replaces `useMessage({ ... })` with
    `const { t } = useTranslation([...namespaces])`.
  - Removes `import { ... } from '@rezics/i18n/messages'` lines whose
    only purpose was message-bag construction.
  - Adds the appropriate `useTranslation` import from
    `@rezics/i18n/react`.
  - Reports any `m[<dynamic>]()` patterns that need manual conversion
    to typed slug-to-key maps and exits non-zero.
- [ ] 5.2 Run the codemod against `package/app/src/`,
  `package/admin/src/`, `package/ui/src/`. Resolve all reports of
  dynamic key access by introducing
  `satisfies Record<Slug, \`<ns>:${string}\`>` maps in `@rezics/i18n`
  or in the feature's `models/` layer.
- [ ] 5.3 Wrap each app's root in `RezicsI18nProvider`. In
  `package/app/src/main.tsx` and `package/admin/src/main.tsx`, mount
  the provider above the router, gated on a `<Suspense>` boundary that
  renders a neutral splash while bootstrap NS load.
- [ ] 5.4 Replace any remaining usages of `useMessage` from
  `@rezics/i18n/react` with `useTranslation`. Delete the
  `useMessage` export.
- [ ] 5.5 Run `bun run check:convention`, `bun run format:check`,
  `bun --filter=@rezics/app run typecheck`,
  `bun --filter=@rezics/admin run typecheck`,
  `bun --filter=@rezics/ui run typecheck`. Resolve all type errors
  from the codemod fallout before proceeding.

## 6. UI library locale autonomy

- [ ] 6.1 Create `package/ui/locales/en.ts` etc. by reading the seven
  `ui_*` keys from `package/ui/messages/{locale}.json` and emitting
  one default-export object per locale module. Use
  `satisfies Record<UiKey, string>` typing keyed on the union of UI
  message keys.
- [ ] 6.2 Add `package/ui/src/i18n/register.ts` exporting
  `registerUiLocale(i18n, locale)` that dynamically imports
  `../../locales/${locale}.ts` and calls
  `i18n.addResourceBundle(locale, 'ui', module.default, true, true)`.
- [ ] 6.3 Update `package/ui/package.json` exports: replace
  `./i18n/messages` and `./i18n/runtime` with `./i18n` →
  `src/i18n/register.ts`. Remove the `./i18n` Paraglide message
  export.
- [ ] 6.4 In `package/app/src/main.tsx` and
  `package/admin/src/main.tsx`, after `RezicsI18nProvider` is
  mounted, call `await registerUiLocale(i18n, i18n.language)` once at
  boot and add `i18n.on('languageChanged', lng => registerUiLocale(i18n, lng))`.
- [ ] 6.5 Update the Storybook locale shim from task 4.3 to also call
  `registerUiLocale`.
- [ ] 6.6 Delete `package/ui/messages/`, `package/ui/project.inlang/`,
  `package/ui/src/paraglide/`, and the `i18n:compile` script in
  `package/ui/package.json`.

## 7. `check:i18n` script

- [ ] 7.1 Add `scripts/i18n/check-i18n.ts` that:
  - Scans `package/{app,admin,ui,editor,folio}/src/**/*.{ts,tsx}`
    for `t('<ns>:<key>')` literals and `useTranslation('<ns>')`
    namespace declarations.
  - Loads every `public/locales/<lng>/<ns>.json` and every
    `package/ui/locales/<lng>.ts` default export.
  - Reports: missing keys (callsite without entry), per-locale gaps
    (key in `en` but missing in other locales), unused keys
    (entry without callsite), forbidden dynamic key patterns
    (e.g., `t(varKey)` where `varKey` is not a typed key map value).
  - Exits non-zero on any failure; unused keys are advisory by default
    and become errors with `--strict-unused`.
- [ ] 7.2 Add `"check:i18n": "bun scripts/i18n/check-i18n.ts"` to root
  `package.json`. Add the same script to `package/i18n/package.json`
  for local use.
- [ ] 7.3 Add `bun run check:i18n` to `lefthook.yml` pre-commit hook
  alongside existing `check:convention` and `check:tokens`. Add to
  the CI workflow that already runs `check:convention`.
- [ ] 7.4 Verify the script exits 0 against the current state after
  tasks 1–6 complete, then intentionally break a key in a fixture to
  confirm non-zero exit and helpful error output.

## 8. Paraglide removal

- [ ] 8.1 Remove `@inlang/paraglide-js` from `package/i18n/package.json`
  and `package/ui/package.json` devDependencies.
- [ ] 8.2 Delete `package/i18n/messages/`,
  `package/i18n/project.inlang/`, and `package/i18n/src/paraglide/`.
- [ ] 8.3 Remove `i18n:compile` scripts from
  `package/i18n/package.json`, `package/ui/package.json`,
  `package/app/package.json`, `package/admin/package.json`, and
  the root `package.json` `postinstall`/`i18n:compile` chain.
- [ ] 8.4 Update `package/i18n/package.json` exports to remove
  `./messages` and `./runtime` (the Paraglide-flavored runtime).
  Confirm no consumer imports those paths via
  `grep -r "@rezics/i18n/messages\|@rezics/i18n/runtime" package/`.
- [ ] 8.5 Run `bun install` to confirm the lockfile updates and no
  Paraglide-related warnings remain.

## 9. Validation

- [ ] 9.1 Run `bun run format:check`, `bun run check:convention`,
  `bun run check:tokens`, `bun run check:i18n`, and `bun run knip`
  from the repo root; all SHALL pass.
- [ ] 9.2 Run `bun --filter=@rezics/{app,admin,ui,i18n,storybook-config}
  run typecheck` (or the equivalent per-package check command). All
  SHALL pass with no `@inlang/paraglide-js` references and no
  `useMessage` references.
- [ ] 9.3 Run `bun --filter=@rezics/app run build` and
  `bun --filter=@rezics/admin run build`. Inspect dist asset sizes
  and confirm `assets/index-*.js` gzip is reduced relative to the
  pre-migration baseline; compare against the bundle estimates in
  `design.md` decision D1/D3.
- [ ] 9.4 Manual verification under `bun run dev`:
  - Load app, observe network panel: three parallel
    `/locales/<lng>/{common,shell,auth}.json` fetches at boot.
  - Navigate to a book route, observe `/locales/<lng>/book.json`
    fetch on first navigation, no refetch on second visit.
  - Switch language via LangToggle, observe parallel refetches of
    every loaded namespace for the new locale, no page reload, no
    component remount.
  - Repeat for admin.
- [ ] 9.5 Confirm `localStorage.getItem('rezics-locale')` persists the
  user's selected locale across reloads.

## 10. Documentation and cleanup

- [ ] 10.1 Update `CONTRIBUTING.md` (or equivalent) section on i18n:
  replace Paraglide instructions with the namespace + JSON + i18next
  workflow. Reference
  `openspec/specs/i18n-namespace-architecture/spec.md` once archived.
- [ ] 10.2 Update `AGENTS.md` if it contains any Paraglide-specific
  guidance.
- [ ] 10.3 Update the `rezics-design` skill (if it references i18n
  patterns) to use `t('<ns>:<key>')` in examples.
- [ ] 10.4 Delete obsolete helper scripts under `scripts/i18n/` that
  are only needed for the one-time migration (split-locales,
  codemod), keeping `check-i18n.ts`, `analyze-duplicates.ts` (useful
  for future audits), and `namespace-map.ts`. Move
  `dedup-report.json` to `docs/i18n/dedup-report-2026-05.json` as a
  historical artifact.
