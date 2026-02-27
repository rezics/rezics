## Context
`app/search` currently exposes alias exports and an aggregated object-style API from `index.ts`, while internal files mix domain logic and UI wiring. This weakens feature boundaries and complicates migration safety. We need a layer-correct feature structure and a stable explicit export surface.

In parallel, home search needs responsive behavior in `MainLayout` header:
- desktop: visible inline search bar in header
- mobile: search button in header, expanding search bar under top bar

The design keeps existing search behavior parity while improving architecture and adding the new header search composition.

## Goals / Non-Goals
**Goals**
- Enforce `app-feature` layering for `app/search` with clear placement rules.
- Make `index.ts` a pure, explicit component/feature export module (no alias API and no aggregated `Search` object).
- Move business rules to `model`; keep components presentational and side-effect free.
- Add independent home-search base component and responsive desktop/mobile wrappers for header integration.
- Preserve current search behavior, i18n behavior, and accessibility semantics.

**Non-Goals**
- No backend contract redesign.
- No unrelated feature refactor outside search and home header search integration.
- No visual redesign beyond responsive behavior required for desktop/mobile entry patterns.

## Layered Design

### model
- Own query normalization, filter derivation, input validation rules, and result projection selectors.
- Export pure functions and types only.
- Must not import from `hooks`, `state`, or React runtime.

### hooks
- Own feature-local effects and event handling for search submit, debounce, and request lifecycle triggers.
- Consume `model` functions and `state` actions/selectors.
- Provide composed handlers to `section` level.

### util
- Own technical helpers only (URL param parse/serialize helpers, platform helpers, formatting wrappers).
- Keep business policy out of util.

### state
- Own atoms/stores for query text, active filter, request status, and result cache references.
- Provide selector-like accessors using `model` where business derivation is required.

### component
- Own reusable presentational pieces:
   - base search input UI component (independent home search component contract)
   - filter UI primitives
   - panel/result list visual components
- No API calls or direct side effects.
- If unnecessary container/show encapsulation is encountered, it should be removed. Here means removing all container/show encapsulation.

### section
- Own business composition and wiring:
   - existing search page/area composition
   - desktop header search section (always visible)
   - mobile header search section (button + expandable bar below top bar)
- Use hooks/state/model/component to build use-case-level UI.
- Do not move every component to section; keep only composition-level units here.

### page
- Keep route entry thin.
- Assemble page-level layout and consume section exports.

### index.ts
- Export explicit named feature API only.
- Remove and forbid:
   - alias exports (`Show`, `Container`, `Filter`, `panelShow`, `panelContainer`)
   - aggregated object export `Search` and nested object API.
- External consumers import search feature only from this entry.

## Data and State Flow

1. User input enters base search component.
2. Section wrapper (desktop or mobile) binds input handlers from hooks.
3. Hooks normalize query/filter via `model` and dispatch to `state`.
4. Hooks trigger search request through existing API consumption path.
5. Request status and results update `state`; section selects and maps data via `model` selectors.
6. Presentational components render loading/empty/error/result states with existing localization keys and accessibility semantics.

Header-specific flow:
- Desktop section mounts active search bar in header at all times.
- Mobile section toggles visibility state for expandable bar below top bar, while reusing the same base input semantics.

## Risks / Trade-offs

- Export breakage at internal call sites: mitigated by repo-wide import migration checks and explicit replacement map.
- Responsive header behavior drift across breakpoints: mitigated by desktop/mobile scenario validation.
- Over-centralization risk in `section`: mitigated by explicitly keeping low-level presentational and pure logic in their dedicated layers.

## Validation Plan

- Targeted checks in `package/app`: lint, typecheck, and tests touching search/home header composition.
- Static boundary checks:
   - no `model` imports from React/hooks/state
   - no deep imports into search internals from external features
   - no usage of removed `Search.*` aggregated API
- Behavioral validation:
   - existing search parity (query/filter/loading/empty/error)
   - desktop header always-visible search bar
   - mobile button-triggered expandable bar below top bar
   - i18n/a11y parity on both surfaces.

## Rollout / Migration

1. Restructure search files into correct layers and create/align the independent base home-search component.
2. Introduce desktop/mobile header section wrappers and wire them into home main layout.
3. Replace old alias/object exports in `index.ts` with explicit named exports.
4. Migrate all call sites to explicit named imports from search `index.ts`.
5. Remove compatibility exports in the same change to prevent mixed usage patterns.
6. Rollback: revert change set; no data migration involved.
