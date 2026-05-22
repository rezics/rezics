## Why

`@rezics/ui` is now i18n-independent, but it still mixes shared Rezics UI with app-shell runtime assumptions: router imports, API client calls, and product workflow wiring live inside package exports that other Rezics projects are expected to consume. This makes the UI package harder to reuse across Rezics projects that share the design system and product vocabulary but own different routing, data fetching, upload, search, and shell behavior.

The package should become a Rezics ecosystem UI package: product-aware where useful, but not app-bound.

## What Changes

- **BREAKING** Reclassify `@rezics/ui` exports into core reusable surfaces and explicit adapter surfaces so core exports, `@rezics/ui/shadcn`, `@rezics/ui/uno.config`, and common composites no longer import router or API clients directly.
- Keep Base UI as the interactive primitive foundation for shadcn-derived components.
- Allow `@rezics/contract` as shared Rezics domain vocabulary, but reduce casual dependencies and prefer type-only or enum/constant-level usage where possible.
- Replace direct `@tanstack/react-router` dependencies in reusable UI components with host-provided navigation adapters or app-owned wrappers.
- Replace direct `@rezics/api` usage in UI components with injected capabilities such as user search and image upload functions.
- Move app-bound route progress, router links, upload providers, and API-backed mention search behind explicit adapter entrypoints or into app/admin-owned wrappers.
- Keep product-related components in `@rezics/ui` when they are useful across Rezics projects, but require app capabilities to be injected instead of imported.
- Pure shadcn exports SHALL NOT re-export demo/dashboard sections that import product contracts or app-specific helpers.
- Add convention checks that guard the package boundary against new router/API/server/app-shell imports in core UI surfaces.

## Capabilities

### New Capabilities

- `ui-package-autonomy`: Defines `@rezics/ui` dependency tiers, export surface boundaries, host-capability injection rules, and package-level convention enforcement for Rezics ecosystem reuse.

### Modified Capabilities

- `ui-component-foundation`: Clarify that `@rezics/ui/shadcn` is the pure shadcn primitive surface, Base UI remains the primitive foundation, and demo/product sections cannot be re-exported from the main shadcn barrel.
- `outbound-link-protection`: Change `<SafeLink>` from a TanStack Router-bound primitive to a host-adapted link component that receives app navigation capability from the consuming shell.

## Impact

- Affected packages:
  - `package/ui`: reorganize exports, remove direct router/API/server/app-shell dependencies from core surfaces, add adapter props/context where needed, and update package dependency declarations.
  - `package/app`: provide TanStack Router link wrappers, route progress wrappers, user search adapters, and upload adapters for UI components that need app capabilities.
  - `package/admin`: provide equivalent app-owned adapters for admin routing and API-backed UI behavior.
  - `package/folio`: continue consuming `@rezics/ui/uno.config` and safe link helpers without inheriting app/admin router assumptions.
  - `package/contract`: remains allowed as shared Rezics vocabulary; no broad contract rewrite is required by this change.
- Dependency impact:
  - `@rezics/ui` SHALL NOT depend directly on `@rezics/api`, `@rezics/server`, or app/admin internals.
  - Direct `@tanstack/react-router` usage SHALL be removed from core UI exports and isolated to explicit adapter surfaces or app/admin wrappers.
  - `@rezics/contract` MAY remain a dependency for shared domain vocabulary, but product components SHALL avoid importing contract behavior when a local type, prop, or host-provided policy is more appropriate.
- Backward compatibility:
  - Internal imports are expected to change in one clear cutover because the project is still in development.
  - Public subpath imports may be retargeted or renamed where they currently expose app-bound behavior.
- Migration needs:
  - Inventory current `@rezics/ui` imports and classify them by core, product-aware, router-adapted, editor-adapted, or app-owned wrapper.
  - Update app/admin callsites to pass router/API capabilities into UI components.
  - Update docs and Storybook examples to show host adapter usage.
  - Run package-level checks and convention enforcement to verify the new boundary.
