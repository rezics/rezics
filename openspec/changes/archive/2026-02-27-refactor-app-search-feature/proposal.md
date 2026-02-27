## Why
The current app search feature mixes feature API design, domain rules, and UI composition in a way that makes internal boundaries hard to maintain. The existing `index.ts` exports both direct symbols and an aggregated object-style `Search` namespace, which encourages unstable call-site patterns and deep coupling to internal files.

At the same time, homepage search capability needs to be expanded to support responsive entry behavior in `MainLayout` header: desktop should render an always-visible search bar, while mobile should render a search button that expands a search bar below the top bar when activated.

This change improves maintainability and feature scalability by aligning search with the `app-feature` layering contract and by defining clear component/section responsibilities for both existing search surfaces and new homepage header search behavior.

## What Changes

- Remove object-style and alias-heavy exports from search `index.ts`, including:
	- `SearchInputShow as Show`
	- `SearchInputContainer as Container`
	- `BookSearchFilter as Filter`
	- `SearchPanelShow as panelShow`
	- `SearchPanelContainer as panelContainer`
	- `Search` aggregated object (`Search.Show`, `Search.Container`, `Search.Filter`, `Search.panel.*`)
- Keep `index.ts` as a pure feature export surface with explicit, stable named exports only.
- Reorganize search files into correct feature-layer folders (`model/hooks/util/state/component/section/page/index.ts`) based on responsibility.
- Move business/domain logic (query rules, filter derivation, selector-like computations) into `model` and keep presentational components side-effect free.
- Introduce independent homepage search bar component abstractions and responsive wrappers:
	- desktop header search component (always visible in main header)
	- mobile header search trigger + expandable search bar under top bar
- Compose behavior in `section` where wiring is needed, without overloading `section` as a generic container for all logic.

## Feature Scope

- Feature name: `app/search`
- Affected layers:
	- model
	- hooks
	- util
	- state
	- component
	- section
	- page
	- index.ts

## Package Scope

- `package/app` (primary implementation)
- `package/ui` (only if shared presentational primitives are required by refactored search components)
- `package/api` (no contract change expected; only consumption-path adjustments if needed)

## Impact

- Backward compatibility:
	- User-facing search behavior SHALL remain functionally equivalent for existing search flows.
	- Import API changes are expected for internal consumers that currently rely on removed alias/object exports.
- Migration needed:
	- Update all call sites in `package/app` to use explicit named exports from search `index.ts`.
	- Remove any deep imports and any usage of aggregated `Search.*` namespace patterns.
	- No database/data migration.
