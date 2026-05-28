## Context

**Current state**: `@rezics/i18n` and `@rezics/ui` each own an
`@inlang/paraglide-js` project. Source JSON lives in
`package/{i18n,ui}/messages/{locale}.json` (six locales: `zh-hant`,
`zh-hans`, `en`, `ja`, `de`, `ko`). A pre-build `i18n:compile` step
generates ESM modules under `src/paraglide/` that expose typed
`m.<key>()` functions and a runtime module. Apps consume them through
`@rezics/i18n/messages`, `@rezics/i18n/runtime`, `@rezics/i18n/react`,
`@rezics/ui/i18n/messages`, and `@rezics/ui/i18n/runtime`. A custom
`useMessage(messageBag)` hook in `@rezics/i18n/react` re-renders React
trees when the active locale changes.

**Hard data from this repo** (measured for this design):

- `package/i18n/messages/en.json`: 1,940 keys, ~108 KB raw JSON. Other
  locales: 106–131 KB.
- `package/ui/messages/en.json`: 7 keys, ~310 bytes.
- App uses 886 unique keys (45.6%). Admin uses 372 (95% are
  `admin_*`). Overlap between app and admin: 28 keys.
- 200 duplicate value groups across the en catalog (e.g., `Tags` used
  by 9 distinct keys, `Title` by 7, `Search` by 6); 293 keys are
  redundant in the sense that another key carries the same English
  string.
- Top-15 underscore prefixes account for ~1,610 keys (83%). 57 distinct
  prefixes exist; the long tail (single-digit-key prefixes) is the
  primary source of fragmentation.

**Constraints**:

- Bun + TypeScript ESM, React 19, Vite. The build pipeline must keep
  `bun --filter=@rezics/{app,admin} run dev` working without a
  pre-compile step that touches generated TypeScript output.
- Authoritative locale codes live in `@rezics/contract` as
  `LANGUAGES`. The canonical six-locale set is not changing.
- `@rezics/ui` must remain reusable across Rezics projects (per
  existing `ui-package-autonomy` spec). The i18n integration must
  honor that boundary: UI may import a neutral i18n adapter subpath,
  but must not import app/admin shells.
- The repo is in development-stage cutover mode (per `AGENTS.md`):
  internal call-site renames are clean cutovers, not deprecation
  cycles.

**Stakeholders**: app, admin, ui, storybook-config, contract, and any
package that imports `@rezics/i18n` or `@rezics/ui/i18n`.

## Goals / Non-Goals

**Goals:**

- Make UI library locales fully autonomous: `@rezics/ui` ships per-locale
  ES modules; downstream products ship only the locales they need; adding
  a new UI locale requires no consumer-side rebuild beyond a version
  bump.
- Enable pure client-side locale switching without route remounts or
  SSR coupling: `i18next.changeLanguage(locale)` swaps every loaded
  namespace in a single batch.
- Cut initial bundle for active-locale-only first paint from ~80–100 KB
  gzip to ~12–15 KB gzip via namespace-based code splitting and runtime
  fetching of locale JSON.
- Replace tree-shake-by-message with namespace-bundled JSON that loads
  on demand per route, with bootstrap namespaces preloaded at app boot.
- Preserve the flat key style (e.g. `t('book:tag_label')`) and the
  six-locale registry. No nested JSON, no schema rewrite.
- Replace Paraglide's compile-time key-typing check with a static
  validation script (`bun run check:i18n`) that runs in pre-commit
  hooks and CI, so wrong keys are caught equally early — just at lint
  time instead of compile time.
- Deduplicate ~120 truly-mergeable redundant key groups into `common`
  during the namespace split (e.g., the nine variants of "Tags").

**Non-Goals:**

- Changing the canonical locale set, locale code format, or
  `language-registry` contract.
- Migrating backend, email, or seed translations. Those packages are
  outside the frontend i18n stack and are not affected.
- Introducing nested JSON, ICU-only macros, or a translation-management
  SaaS integration. The flat-key + JSON model is intentional.
- Server-side rendering of localized markup for crawler audiences. The
  app is a client-rendered SPA; SSR is out of scope.
- Live translation editing in the UI (CMS-style). Translations remain
  source-controlled JSON.
- Visual regression of UI strings beyond what existing Storybook stories
  cover.

## Decisions

### D1: Use i18next + react-i18next + i18next-http-backend

**Choice**: Adopt `i18next` as the runtime, `react-i18next` for React
binding, `i18next-http-backend` for dynamic JSON loading, and
`i18next-browser-languagedetector` for locale resolution.

**Why**:
- Mature ecosystem with the `ResourceNamespaceMap` TypeScript pattern
  (i18next ≥ 26.3) that gives ~80% of the type safety we lose by leaving
  Paraglide (autocomplete + parameter checking).
- `i18next-http-backend` is the standard way to fetch per-locale JSON
  on demand and matches our namespace-per-route strategy exactly.
- React 19 + Suspense story is well supported via `useTranslation`'s
  `useSuspense: true` mode.

**Alternatives considered**:
- *LinguiJS*: Compile-time like Paraglide. Solves bundle size but not
  the SSR-coupling or per-locale lazy-load problems that motivated this
  change.
- *next-intl*: Excellent for Next.js but our frontend is Vite + React
  Router-style. The Next-specific affordances are unused weight.
- *FormatJS / react-intl*: ICU-strict, larger runtime (~13 KB gzip vs
  ~8 KB for i18next). We do not have an existing ICU-trained
  translator workflow; the larger runtime buys nothing here.

### D2: File layout `public/locales/{lng}/{ns}.json`

**Choice**: Store source JSON as `public/locales/{lng}/{ns}.json` and
serve as static assets. This is the path `i18next-http-backend`
expects by default.

**Why**:
- One folder per locale matches how translators work (a translator
  receives `public/locales/ja/`).
- CDN/cache invalidation can be done per locale folder.
- `ls public/locales/` makes the supported-language set self-evident.
- `i18next-http-backend` defaults Just Work; less configuration to
  maintain.

**Alternatives considered**:
- *`{ns}.{locale}.json`*: Common in some codebases but non-standard for
  i18next, and it complicates the "what languages exist" question
  (you have to grep across files). Rejected.
- *Per-package locale folders*: e.g.,
  `package/i18n/locales/{lng}/{ns}.json`. Would require the dev server
  to mount each package's locales under the same public prefix. Adds
  complexity with no real benefit for app/admin namespaces. Rejected
  for the central catalog but kept for `@rezics/ui` (see D5).

### D3: Curated 9 + 2 namespace map

**Choice**: Consolidate the 57 underscore prefixes into 9 product
namespaces plus `admin` (admin-only) plus `ui` (UI-package-owned).

**Bootstrap namespaces** (always loaded on boot, ~14 KB raw / ~4 KB
gzip per locale combined):

| Namespace | Source prefixes | Keys |
|-----------|-----------------|------|
| `common` | `common` + `accessibility` + deduped cross-domain words (Tags, Title, Search, Save, Cancel, etc.) | ~180 |
| `shell` | `layout` + `navigation` + `home` + `theme` + `app` + `language` + `media` | ~75 |
| `auth` | `auth` | 94 |

**Route-lazy namespaces** (loaded by `useTranslation` or
`loadNamespaces`):

| Namespace | Source prefixes | Keys |
|-----------|-----------------|------|
| `book` | `book` + `chapter` + `chapters` + `pages` + `release` + `units` + `title` | ~180 |
| `page` | `page` + `remark` | ~145 |
| `entity` | `entity` + `work` + `attribution` + `collection` + `realm` + `shelf` + `pinboard` | ~330 |
| `community` | `feedback` + `review` + `progress` + `post` + `comment` + `reactions` + `tag` + `excerpt` + `rating` + `score` + `discussion` + `engagement` | ~165 |
| `search` | `search` + `history` + `zone` | ~131 |
| `settings` | `settings` + `profile` + `notifications` + `notify` + `ai` + `edit` + `user` + `license` + leftover `theme` | ~165 |
| `editor` | `editor` + `placeholders` + `authority` | ~57 |

**Owned by specific consumers**:

| Namespace | Owner | Keys |
|-----------|-------|------|
| `admin` | `package/admin` only | 409 |
| `ui` | `package/ui` (ships per-locale ES modules) | 7+ |

**Why this granularity**:
- Bootstrap stays under 5 KB gzip total per locale, so first paint is
  fast even on slow networks.
- No single route fetch exceeds ~12 KB raw / ~3 KB gzip. HTTP/2
  multiplexes 2–4 parallel namespace fetches without queueing.
- Tiny prefixes (<15 keys) are absorbed into the closest domain
  namespace. The long tail of 1–2-key prefixes had become noise that
  did not justify per-namespace lazy loading.
- `admin` is fully isolated: admin app loads only `common`, `shell`,
  `auth`, and `admin`; it never pays for `book`, `entity`, `community`,
  etc.

**Alternatives considered**:
- *One namespace per underscore prefix*: 57 namespaces is too granular;
  most prefixes have fewer than 30 keys. The HTTP request overhead and
  the cognitive load on developers ("which namespace does `chapter` live
  in?") outweigh the per-route bundle wins.
- *3–4 mega-namespaces (`common`, `feature`, `admin`)*: Defeats the
  lazy-load value proposition; rejected for the same reason we are
  leaving Paraglide-with-all-locales-eager today.

### D4: Dedup rule (semantic vs accidental string collisions)

**Choice**: Merge a duplicate value group into a single canonical
`common:<key>` only when all call sites are semantically interchangeable.
When two prefixes share a string by accident (e.g., `book_title`,
`page_title`, `realm_title` all rendering "Title"), keep them separate.

**Rationale**: Translation divergence in other locales is the silent
risk. `book_title` translated to Japanese is plausibly different from
`page_title` even if both render "Title" in English. Merging on raw-string
equality would silently freeze that future divergence.

**Mechanism**:
1. Dedup script outputs a `dedup-report.json` listing each duplicate
   group, its callsite distribution by package, and a suggested
   classification (`semantic` vs `accidental`).
2. Human review confirms or overrides the classification.
3. Only `semantic` groups are merged into the canonical `common:<key>`,
   with all call sites rewritten by codemod.
4. Estimated outcome: ~120 of 200 groups merge (~60%), reducing 1,940 →
   ~1,820 keys (~6% catalog shrink). The win is correctness, not size.

### D5: UI library ships per-locale ES modules; consumer registers them

**Choice**: `@rezics/ui` does *not* serve JSON via the HTTP backend.
Instead it ships `package/ui/locales/{locale}.ts` as bundled ES modules,
each exporting the `ui` namespace's translation object for one locale.
Consumers dynamically import the current locale's module and call
`i18n.addResourceBundle(locale, 'ui', messages, true, true)` to
register it.

**Why**:
- Mirrors how Material UI, Ant Design, and Shopify Polaris ship
  locales — proven pattern at scale.
- Tree-shaking happens at the consumer level: an app that ships only
  `en` + `zh-hant` dynamically imports only those two modules; the rest
  never enter the bundle.
- Adding a UI locale is a one-file change inside `@rezics/ui` plus a
  publish. No consumer code change required.
- Decouples UI's locale lifecycle from app/admin's locale lifecycle;
  the UI library can support a superset of locales without forcing
  consumers to support them.

**Wiring**:

```ts
// package/ui/src/i18n/register.ts
export async function registerUiLocale(i18n, locale) {
  const messages = await import(`../../locales/${locale}.ts`)
  i18n.addResourceBundle(locale, 'ui', messages.default, true, true)
}
```

```ts
// package/app/src/i18n/boot.ts
import i18n from '@rezics/i18n/runtime'
import { registerUiLocale } from '@rezics/ui/i18n'

await registerUiLocale(i18n, i18n.language)
i18n.on('languageChanged', (lng) => registerUiLocale(i18n, lng))
```

**Alternative considered**: Have `@rezics/ui` publish JSON to a shared
`public/locales/{lng}/ui.json` path served via the same HTTP backend.
Rejected because it ties UI's distribution to the consumer's static
asset pipeline (where does the file end up at build time? whose CDN
serves it?). The ES-module approach uses the consumer's existing
module resolution, which is solved.

### D6: `check:i18n` script replaces compile-time key safety

**Choice**: Add `bun run check:i18n` that:
1. Statically scans `**/*.{ts,tsx}` for `t('<ns>:<key>')` and
   `useTranslation('<ns>')` patterns.
2. Loads every `public/locales/<lng>/<ns>.json` plus the
   `package/ui/locales/<lng>.ts` modules.
3. Reports: missing keys (callsite without entry), unused keys
   (entry without callsite), per-locale gaps (key exists in `en`
   but missing in `ja`), and forbidden patterns (dynamically
   constructed `t(varKey)` calls that the static scan cannot
   verify).
4. Exits non-zero on any failure. Wired into `lefthook` pre-commit
   and CI.

**Why**: Paraglide's compile-time check catches typos because every
key is a function name. Once we move to string-keyed `t('ns:key')`,
the same guarantee must come from a static tool. Running it at
lint/CI time is functionally equivalent to compile-time; the developer
loop cost is comparable (a few seconds).

**Implementation note**: Build on top of `i18next-parser`. It already
extracts keys from source; we add the cross-check against JSON files
and the per-locale gap report.

### D7: Bootstrap loads three namespaces in parallel, not bundled

**Choice**: At init time, `i18next.init` lists
`ns: ['common', 'shell', 'auth']`. The HTTP backend fetches three
JSON files in parallel via HTTP/2 multiplexing.

**Why not inline into HTML**: Inlining all three boot namespaces into
the HTML payload would save one round-trip but force a full HTML
refetch when any boot namespace changes. Three small JSON files
(~1–2 KB gzip each) cached separately is operationally cleaner.

**Why not one merged `_bootstrap.json`**: Translator workflow (one
file per concern) and cache granularity (a small change to `auth`
doesn't bust `common`).

**Locale detection priority**: `localStorage` → cookie → `navigator`.
Persisted writes go to `localStorage` only. Cookie is read-only for
compatibility with old links that used `?lang=` redirects setting a
cookie.

### D8: One-shot cutover, no Paraglide bridge

**Choice**: Migrate every call site in a single change. Do not keep
a temporary `m.<key>() → t('ns:key')` shim.

**Why**: The repo is in development stage (per `AGENTS.md`). A
bridge would force every developer to learn two APIs for the same
job. The codemod is straightforward (`m.foo_bar()` → `t('foo:bar')`),
so the cutover risk is concentrated in one PR review rather than
spread across many.

## Risks / Trade-offs

- **Risk**: First paint shows untranslated keys for a few hundred ms
  while bootstrap namespaces load. **Mitigation**: React Suspense
  boundary at the app root awaits the bootstrap loader before
  rendering. A neutral splash (logo only) shows during the boot
  fetch — same UX as today's app shell.

- **Risk**: Codemod rewrites a callsite incorrectly when the key
  contains a non-standard underscore split (e.g., `m.book_chapter_2()`
  could parse as `book:chapter_2` correctly or `chapter:2` wrongly
  depending on how we split). **Mitigation**: The namespace map is
  declared explicitly; the codemod looks up the prefix → namespace
  mapping rather than greedy-splitting on underscore. Edge keys
  that fall outside the map (none expected after dedup, but
  defensive) fail the codemod loudly.

- **Risk**: Dedup classification mistakes silently freeze translation
  divergence. **Mitigation**: Default to "accidental" for any group
  where call sites span ≥ 3 distinct namespaces. Human reviewer
  must explicitly opt-in to semantic merges. The `dedup-report.json`
  is committed for future archaeology.

- **Risk**: TypeScript loses key-level safety (`m.nonexistent()` no
  longer fails compile). **Mitigation**: `ResourceNamespaceMap`
  declaration provides autocomplete and parameter checks for known
  keys. `check:i18n` runs pre-commit and in CI, catching unknown
  keys before merge.

- **Risk**: `@rezics/ui` locale ES modules grow with each added
  locale, increasing UI lib package size. **Mitigation**: Modules
  are dynamically imported by consumers; never statically imported.
  Consumer bundlers code-split them per locale automatically.

- **Risk**: `i18next.loadNamespaces` is async and a route component
  rendering before its namespace is loaded shows raw keys.
  **Mitigation**: Use `useTranslation` with `useSuspense: true` (its
  default in i18next v23+) at the namespace consumer site, plus
  router-level prefetch hooks for primary navigation links.

- **Trade-off**: Three boot namespaces means three boot HTTP
  requests. HTTP/2 makes this cheap, but HTTP/1.1 fallbacks (rare on
  modern hosts) would serialize. We accept this trade since our
  production hosts speak HTTP/2+.

- **Trade-off**: 9 + 2 namespaces is more granular than
  i18next's typical "one or two" recommendation but less granular
  than the per-prefix theoretical maximum. The number is chosen
  empirically from the prefix-distribution data, not from
  framework convention.

## Migration Plan

The implementation tasks (in `tasks.md`) are sequenced so each step
is independently reviewable and bisectable:

1. **Dedup analysis** — script emits `dedup-report.json`; human
   review pins each group to `semantic` or `accidental`. No code
   changes yet. Committed as a single PR review artifact.
2. **Namespace split** — script reads the prefix → namespace map
   and the dedup report, produces `public/locales/{lng}/{ns}.json`.
   The old `package/i18n/messages/{locale}.json` files remain in
   place. No callsite changes yet.
3. **i18next runtime wire-up** — `@rezics/i18n` is rewritten to
   export i18next initialization, the React provider, and
   `useTranslation` re-exports. Paraglide deps remain installed.
   Apps still call `m.<key>()`; the new runtime is dormant.
4. **Callsite codemod** — `m.<key>()` → `t('<ns>:<key>')` across
   `package/app`, `package/admin`, `package/ui`, and any other
   consumer. This is the breaking commit; everything must pass after
   it lands.
5. **UI locale autonomy** — `package/ui/locales/{locale}.ts` ES
   modules added; `registerUiLocale` exported; consumers updated to
   register. `package/ui/messages/{locale}.json` and
   `package/ui/project.inlang/` removed.
6. **Static asset wiring** — Vite copies `public/locales/` to dist;
   dev server serves it. `bun run check:i18n` script added to
   `lefthook` pre-commit and root `package.json` scripts.
7. **Paraglide removal** — `@inlang/paraglide-js` uninstalled;
   `i18n:compile` scripts dropped from `dev`/`build`/`postinstall`;
   `project.inlang/` directories deleted; `package/i18n/src/paraglide/`
   and `package/ui/src/paraglide/` deleted; legacy exports purged.

**Rollback**: Steps 1–3 are non-breaking and individually reversible.
Step 4 is the cutover; rolling back means reverting steps 4–7
together. The dedup report from step 1 is the most expensive
artifact to recreate, so it stays committed even on rollback.
