## 1. Setup and Scope Lock

- [x] 1.1 Confirm `app/search` affected layers and map current files to target folders: `model/hooks/util/state/component/section/page/index.ts`.
- [x] 1.2 Inventory all current export consumers, including alias/object-style usage (`Show/Container/Filter/panelShow/panelContainer/Search.*`).
- [x] 1.3 Record baseline behavior checklist for existing search flows and home header behavior to verify parity after refactor.

## 2. model Layer

- [x] 2.1 Move query normalization, filter derivation, and result projection rules into `model` modules.
- [x] 2.2 Remove any React/state/router imports from `model` and ensure model API remains pure.

## 3. hooks Layer

- [x] 3.1 Refactor search hooks to consume `model` rules and coordinate request lifecycle without embedding business policy.
- [x] 3.2 Add/adjust hook APIs required by desktop/mobile header search wrappers.

## 4. util Layer

- [x] 4.1 Move technical helpers (parse/serialize/formatting) into `util` and remove business rules from util.
- [x] 4.2 Ensure util functions are reused by hooks/state where needed, avoiding duplicate implementations.

## 5. state Layer

- [x] 5.1 Normalize search state containers (query/filter/status/results) and align selectors/actions to refactored model contracts.
- [x] 5.2 Ensure mobile header expand/collapse state wiring is isolated to appropriate section/state usage.

## 6. component Layer

- [x] 6.1 If unnecessary container/show encapsulation is encountered, it should be removed. Here means removing all container/show encapsulation.
- [x] 6.2 Create/align an independent base home-search input component for shared behavior.
- [x] 6.3 Keep presentational search components side-effect free and free from direct API calls.

## 7. section Layer

- [x] 7.1 Compose desktop main-header search section that always shows the search bar.
- [x] 7.2 Compose mobile main-header search section with a search button and expandable bar below top bar.
- [x] 7.3 Keep section focused on composition/wiring only; avoid moving low-level pure logic into section.

## 8. page Layer

- [x] 8.1 Update home/page entry wiring to consume desktop/mobile search sections in `MainLayout` header.
- [x] 8.2 Verify route/page entries remain thin and delegate behavior to section/hooks/state.

## 9. index.ts Public Export Boundary

- [x] 9.1 Remove alias exports: `Show`, `Container`, `Filter`, `panelShow`, `panelContainer`.
- [x] 9.2 Remove aggregated object export `Search` and nested `Search.panel` API.
- [x] 9.3 Export explicit named modules/types only from search `index.ts` and update feature-level external import contract.

## 10. Import Boundary and Migration

- [x] 10.1 Migrate all call sites to explicit named imports from search `index.ts`.
- [x] 10.2 Verify no deep imports into search internals remain outside the feature.
- [x] 10.3 Verify no usages of removed object-style/alias exports remain in monorepo app surfaces.

## 11. Validation

- [x] 11.1 Run targeted checks for `package/app` (`lint`, `typecheck`, and related tests/build tasks available in package scripts).
- [x] 11.2 Validate behavior parity: query/filter/result/loading/empty/error flows.
- [x] 11.3 Validate responsive behavior: desktop always-visible header search, mobile button-triggered expandable search below top bar.
- [x] 11.4 Validate localization and accessibility semantics for status messages and search input interactions.

## 12. Documentation and Rollout

- [x] 12.1 Update relevant docs in `package/app/docs` for search feature entry/usage changes.
- [x] 12.2 Add migration notes for removed alias/object exports and required import updates.
