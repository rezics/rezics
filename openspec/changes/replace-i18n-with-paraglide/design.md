## Context

The frontend currently uses `react-i18next` and TypeScript locale modules under `package/app/src/locale/`. Several reusable UI components in `package/ui` also import `react-i18next` directly, while other UI package code imports Rezics product/domain dependencies such as `@rezics/contract`, `@rezics/api`, and TanStack Router. This makes it difficult to share `@rezics/ui` with multiple Rezics projects that need the visual system but not the same product catalog, router, API client, or app-level translation resources.

The target architecture separates locale ownership from message ownership:

```txt
app/admin shell
  owns active locale selection
        |
        | sync locale
        v
+----------------------+       +----------------------+
| @rezics/i18n         |       | @rezics/ui/i18n      |
| product/domain text  |       | UI component text    |
+----------------------+       +----------------------+
        |                              |
        v                              v
app/admin features              @rezics/ui components
```

The app/admin shell remains responsible for current-locale state, persistence, routing strategy, and language switching. Message catalogs are split by ownership: app/admin share product/domain translations, while `@rezics/ui` owns only component-internal text. Both catalogs use Paraglide JS generated message functions compiled from JSON source files.

## Goals / Non-Goals

**Goals:**

- Replace frontend `react-i18next` usage with Paraglide JS generated message functions.
- Let app and admin share one product/domain i18n package.
- Let `@rezics/ui` translate its own generic component text without depending on app/admin translation files.
- Keep the active locale as a single app/admin shell state and synchronize it into all frontend i18n runtimes.
- Use official Paraglide/Inlang JSON message files rather than JSON5 or a custom file-format plugin.
- Preserve the canonical five locale codes and fallback behavior.
- Keep `@rezics/ui` portable by removing product/domain translation ownership from reusable UI components.

**Non-Goals:**

- Introducing JSON5, JSONC, YAML, or a custom Inlang plugin.
- Changing the canonical language registry in `@rezics/contract`.
- Translating server responses, email templates, or backend validation errors in this change.
- Redesigning UI components or changing visual design tokens.
- Introducing a third-party UI component library.
- Solving external translation management workflow beyond Paraglide/Inlang-compatible JSON source files.
- Decoupling `@rezics/ui` from `@rezics/server`, `@rezics/api`, `@rezics/contract` type imports, or `@tanstack/react-router`. Full UI portability across non-Rezics consumers requires follow-up changes on those axes; this change only resolves the i18n axis.

## Scope of UI Autonomy

`@rezics/ui` currently imports from four cross-package surfaces:

| Axis | Status after this change |
|---|---|
| `react-i18next` runtime | Removed (this change) |
| `@rezics/contract` types (`ContentRating`, `DEFAULT_LANGUAGE`, `UserDTO`, …) | Still coupled |
| `@rezics/api` client | Still coupled |
| `@rezics/server` (e.g. `RezicsUploadProvider`) | Still coupled |
| `@tanstack/react-router` (`Link`, `SafeLink`, `TextLink`, `GlobalProgressBar`) | Still coupled |

This change resolves the i18n axis only. The remaining axes are explicit follow-up work, not regressions introduced here.

## Decisions

### Decision 1: Use Paraglide JS as the frontend i18n compiler and runtime

Paraglide compiles JSON message files into tree-shakeable, typed message functions. Components import message functions directly instead of calling `t()` with string keys.

Alternative considered: keep `react-i18next` and introduce a UI-local i18next namespace. This would preserve the existing runtime API but continue to require a runtime translation resolver and would keep `@rezics/ui` tied to `react-i18next`.

### Decision 2: Split product/domain messages from UI component messages

Create a shared app/admin product/domain i18n package, likely `package/i18n`, for feature copy, domain labels, and product workflows. Keep `package/ui` message files scoped to reusable UI component internals only.

Examples owned by `@rezics/ui`:

- `ui.password.show`
- `ui.password.hide`
- `ui.dialog.close`
- `ui.pagination.next`
- `ui.select.no_options`

Examples owned by product/domain i18n:

- `auth.login.title`
- `book.detail.metadata`
- `content_rating.general`
- `attribution.credit.author`
- `search.scope.book`

Alternative considered: put all messages in the app/admin i18n package. This makes UI consumers pass labels or wrappers for every reusable component, which weakens UI package portability.

### Decision 3: App/admin own the active locale and synchronize package runtimes

Each Paraglide output has its own runtime. App/admin language switching SHALL update the shared product/domain runtime and the UI runtime from one shell-level locale state.

Implementation shape:

```ts
setProductLocale(locale, { reload: false });
setUiLocale(locale, { reload: false });
```

The concrete helper can live in the app/admin shell or the shared i18n package. The important boundary is that `@rezics/ui` does not independently infer locale from URL, cookie, or localStorage.

Alternative considered: let `@rezics/ui` auto-detect locale. This risks mismatches where app/admin render one language while UI components render another.

### Decision 4: Use official JSON message files

Language source files SHALL be JSON files accepted by the official Paraglide/Inlang plugin path. JSON5 is not part of this change.

Alternative considered: JSON5 with a custom Inlang plugin. This would allow comments but would add plugin maintenance and increase risk for Sherlock/Fink/CLI compatibility. The project can revisit a metadata or custom format later if translation context becomes painful.

### Decision 5: Keep contract as the language registry, not the UI message dependency

`@rezics/contract` continues to define canonical language codes and language metadata. `@rezics/ui` can align with those locale codes at package integration boundaries, but reusable UI components SHALL NOT import contract domain registries or DTOs to translate generic component text.

Alternative considered: continue importing contract types/enums in UI components. This keeps the UI package coupled to Rezics product semantics and works against multi-project reuse.

### Decision 6: Contract domain enums resolve labels through `@rezics/i18n` explicit maps

Backend-driven discriminator keys (entity kind, license, subject attribution role, credit role, and any future contract enum that ships with a displayable label) SHALL resolve their localized label through hand-written maps in `@rezics/i18n`, guarded by `satisfies Record<EnumKey, () => string>` for exhaustiveness:

```ts
// package/i18n/src/maps/entity-kind.ts
import { type EntityKindKey } from "@rezics/contract";
import { m } from "../paraglide/messages.js";

const ENTITY_KIND_MESSAGE = {
  person:       m.entity_kind_person,
  organization: m.entity_kind_organization,
  circle:       m.entity_kind_circle,
  // ...
} as const satisfies Record<EntityKindKey, () => string>;

export const entityKindLabel = (kind: EntityKindKey): string =>
  ENTITY_KIND_MESSAGE[kind]();
```

The `i18nKey` field SHALL be removed from `@rezics/contract` (`entity.ts`, `license.ts`, `subject-attribution.ts`, `credit-attribution.ts`); message identity is owned by `@rezics/i18n`, not contract. Contract retains only the discriminator `key` (and any non-display metadata like license URLs).

Dynamic bracket access (`m[runtimeString]()`) SHALL NOT be used. Paraglide v2 supports it as an "if-needed" escape hatch, but it defeats tree-shaking by preventing the bundler from statically determining which messages are referenced. Keeping this invariant strong is more valuable than the savings at any individual callsite.

**Why this shape rather than alternatives:**

- *Codegen the map from contract metadata* — rejected for now. Four maps with ~10–30 entries each don't justify a codegen step, and `satisfies Record<...>` already gives exhaustiveness for free. Revisit if enum count or churn grows.
- *ICU `select` message form* (`m.entity_kind({ kind })` resolving to a single message with branches) — viable for enums where cross-locale wording consistency is critical (e.g. license names). Treated as an opt-in per enum, not the default; map form is the default because TS exhaustiveness is more visible than ICU branch coverage.
- *Keep `i18nKey` on contract and re-resolve via Paraglide* — rejected. There is no type-safe, tree-shake-preserving way to do this; bridging belongs in `@rezics/i18n`.

This pattern is the canonical industry answer for compiler-based i18n libraries (Paraglide, Lingui macros, Angular `$localize`), and matches Paraglide's own documented "explicit mapping" recommendation for dynamic discriminators.

### Decision 7: Shell-level locale helper lives in the app/admin shell

The `setRezicsLocale(locale)` helper that fans out a locale change to all Paraglide runtimes SHALL live in `package/app/src/app/` (and the analogous admin shell location), not in `@rezics/i18n` or `@rezics/ui`.

Rationale: the helper must import both `@rezics/i18n` Paraglide runtime and `@rezics/ui` Paraglide runtime. Placing it in either of the two i18n packages would create a back-edge dependency (`@rezics/i18n` knowing about `@rezics/ui` or vice versa). Keeping it in the shell preserves both i18n packages as leaves and makes the dependency direction one-way: shell → both i18n runtimes.

```
package/app/src/app/locale.ts
    │
    ├─▶ setProductLocale  (from @rezics/i18n)
    └─▶ setUiLocale       (from @rezics/ui/i18n)
```

`@rezics/i18n` and `@rezics/ui` SHALL NOT import each other.

Alternative considered: place the helper in `@rezics/i18n`. Rejected because it requires `@rezics/i18n` to import `@rezics/ui`, which inverts the natural layering (UI consumes i18n, not the other way around) and prevents future reuse of `@rezics/ui` without `@rezics/i18n`.

## Risks / Trade-offs

- Runtime synchronization bugs -> Centralize language switching in one helper (Decision 7) and add tests that verify app/admin and UI runtimes render the same active locale after a language change.
- Large migration surface -> Migrate package by package and keep the change as an internal clear cutover rather than supporting both `react-i18next` and Paraglide long term.
- Dynamic message lookup can harm tree-shaking -> Decision 6 forbids `m[runtimeString]()` outright; all dynamic discriminators route through explicit maps in `@rezics/i18n`. Enforce via convention check or ESLint rule (see Migration Plan step 11).
- Missing JSON comments/context -> Use clear key naming and, if needed, add adjacent metadata documentation later without blocking the official JSON path.
- Multiple Paraglide runtimes can reload unexpectedly -> Use `{ reload: false }` where locale updates happen inside an already-running SPA shell, and centralize any intentional full-page reload behavior. This is an invariant for the helper from Decision 7.
- Storybook stories need i18n setup -> Add a Storybook preview decorator in `@rezics/ui` that initializes the UI Paraglide runtime and exposes a locale switcher in the toolbar (see Migration Plan step 4).
- CI ordering trap -> Paraglide generated output must exist before `tsc` runs. New contributors cloning the repo will hit type errors if compile is skipped. Wire compile into `postinstall` or run it as the first step in `bun run dev` and CI workflows.
- Contract `i18nKey` removal touches callsites broadly -> Use grep to enumerate `i18nKey` callsites before migration; the search-and-replace target is mechanical (`t(x.i18nKey)` → `<enum>Label(x.key)`) and can be done per-domain.
- `m.` namespace shadowing -> Paraglide's convention is to import generated messages as `import * as m from "..."`. This does not collide with `t.Object(...)` from `@rezics/contract` (TypeBox), so the `react-i18next` `t()` callsites and the contract `t.*` schema-builder usages can be migrated independently.

## Migration Plan

1. Scaffold `@rezics/i18n` workspace package (`package/i18n/`); add Paraglide configuration, JSON message source directory, and `package.json` exports for generated messages and runtime helpers.
2. Add Paraglide configuration for `package/ui` (component-internal messages) with a separate Inlang project so app/admin and UI compile independently.
3. Wire Paraglide compile into the build pipeline so generated output exists before `tsc`. Concretely: add compile to `postinstall` and to the dev/build scripts of any package consuming Paraglide output.
4. Add a Storybook preview decorator in `@rezics/ui` that initializes the UI Paraglide runtime and exposes a locale switcher in the toolbar.
5. Convert existing `package/app/src/locale/{en,zh-hant,zh-hans,ja,de}.ts` modules into Paraglide-compatible JSON message files under `package/i18n/messages/` while preserving canonical locale codes.
6. Author contract-enum label maps in `@rezics/i18n` for `EntityKind`, `License`, `SubjectAttributionRole`, and `CreditRole`. Each map is `as const satisfies Record<EnumKey, () => string>` and exposes a thin `<enum>Label(key)` helper.
7. Add the shell-level `setRezicsLocale(locale)` helper in `package/app/src/app/` per Decision 7. Add the analogous helper to admin when admin starts consuming i18n.
8. Introduce shell-owned active-locale state in `package/app` (current `lng: "zh-hant"` in `package/app/src/app/providers/i18n.ts` is hardcoded; replace with state read from persistence + URL).
9. Migrate app/admin providers and language toggles to use the Paraglide runtime and `setRezicsLocale`.
10. Replace `useTranslation()` and `t(key)` callsites with generated Paraglide message function imports across `package/app/src/`.
11. Replace `t(x.i18nKey)` callsites with `<enum>Label(x.key)` from `@rezics/i18n`. Domains in scope: entity kind, license, subject attribution role, credit role.
12. Remove `i18nKey` fields from `package/contract/src/{entity,license,subject-attribution,credit-attribution}.ts`.
13. Move generic UI component text (`PasswordField`, `Pagination`, etc.) into the UI message catalog and remove `react-i18next` imports from `package/ui`.
14. Move product/domain labels out of `package/ui` or provide domain adapter wrappers outside the portable UI surface.
15. Add a convention check (or ESLint rule) that flags dynamic `m[...]()` access and any remaining `t(*.i18nKey)` patterns, so the invariants from Decision 6 cannot regress.
16. Remove `i18next` and `react-i18next` dependencies once no callsites remain.
17. Run formatting, convention checks, targeted tests, and Storybook smoke checks for translated UI components.

Rollback is expected to happen by reverting this change during development. The migration is intentionally a clear internal cutover, not a dual-runtime compatibility layer.

## Open Questions

- Should `@rezics/ui` expose its i18n runtime as `@rezics/ui/i18n/runtime` or through a narrower helper such as `@rezics/ui/i18n`?
- For enums where cross-locale wording consistency is critical (e.g. license names), should we opt into ICU `select` form (`m.license({ slug })`) instead of an explicit map? Decision 6 allows both; deciding per-enum can wait until JSON catalog seeding surfaces concrete pain.
- When admin adopts i18n, does it want its own message namespace inside `@rezics/i18n` (e.g. `m.admin_*` prefix), or are admin-only screens rare enough that they can share the product/domain namespace?
