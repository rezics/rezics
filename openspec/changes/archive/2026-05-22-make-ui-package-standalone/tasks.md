## 1. Inventory And Boundary Classification

- [x] 1.1 Inventory all `package/ui/src` imports from `@tanstack/react-router`, `@rezics/api`, `@rezics/server`, `@rezics/contract`, `@rezics/editor`, and app/admin internals.
- [x] 1.2 Classify each affected module as core reusable, product-aware reusable, router-adapted, editor-adapted, story/mock/test-only, or app-owned wrapper.
- [x] 1.3 Document the classification in the change implementation notes or a short `package/ui` boundary doc.
- [x] 1.4 Identify all app/admin/folio imports from root `@rezics/ui`, `@rezics/ui/shadcn`, `@rezics/ui/link`, `@rezics/ui/editor`, and `@rezics/ui/primitive/link`.

## 2. Export Surface Cleanup

- [x] 2.1 Remove demo/dashboard `sections` exports from `package/ui/src/shadcn/index.ts`.
- [x] 2.2 Move any remaining shadcn demo sections behind an explicit demo/documentation subpath if they are still needed.
- [x] 2.3 Tighten `package/ui/src/index.ts` so root exports include only common reusable surfaces that do not require router/API/server/app-shell dependencies.
- [x] 2.4 Update `package/ui/package.json` exports to expose any new explicit adapter or demo subpaths.
- [x] 2.5 Update app/admin callsites that relied on removed root or shadcn barrel exports.

## 3. Router Capability Injection

- [x] 3.1 Introduce shared link-renderer adapter types for UI components that need host navigation.
- [x] 3.2 Refactor `package/ui/src/link/SafeLink.tsx` so app-route rendering uses a host-provided link renderer or falls back to a normal anchor.
- [x] 3.3 Move TanStack Router-specific `Link`, `TextLink`, and internal-link wrappers into app/admin-owned wrappers or explicit adapter-only surfaces.
- [x] 3.4 Refactor `GlobalProgressBar` so route progress is app-owned or driven by an injected progress source.
- [x] 3.5 Update markdown/rich-text renderers and app/admin wrappers to provide host navigation where SPA navigation is required.
- [x] 3.6 Add or update tests for `SafeLink` external, rezics, blocked, app-route fallback, and app-route injected-renderer behavior.

## 4. API Capability Injection

- [x] 4.1 Introduce a user search adapter type for mention autocomplete.
- [x] 4.2 Refactor `package/ui/src/editor/plugins/EditorMention.tsx` to call the injected user search adapter instead of `@rezics/api`.
- [x] 4.3 Introduce an image upload adapter type for editor image upload.
- [x] 4.4 Refactor `package/ui/src/editor/image/RezicsUploadProvider.tsx` or its replacement to call the injected image upload adapter instead of `@rezics/api`.
- [x] 4.5 Add app/admin adapter implementations that wrap the current `@rezics/api` user search and upload clients.
- [x] 4.6 Update editor stories to use mock adapters.

## 5. Contract Dependency Reduction

- [x] 5.1 Review `@rezics/contract` imports in `package/ui/src` and separate shared vocabulary usage from app policy usage.
- [x] 5.2 Remove low-value contract imports such as defaults that can be local constants or props.
- [x] 5.3 Keep acceptable domain vocabulary imports where they improve type safety across Rezics projects.
- [x] 5.4 Refactor any contract behavior helper usage that represents app policy into local pure UI logic or host-provided policy.

## 6. Package Dependency Cleanup

- [x] 6.1 Remove `@rezics/api` from `package/ui/package.json` dependencies after UI source no longer imports it.
- [x] 6.2 Remove `@rezics/server` from `package/ui/package.json` dependencies if no source import requires it.
- [x] 6.3 Reclassify router/editor dependencies as direct, peer, optional peer, or consumer-owned according to the final adapter surface.
- [x] 6.4 Run dependency searches to confirm core UI surfaces do not import forbidden host runtime dependencies.

## 7. Convention Enforcement

- [x] 7.1 Add or update `bun run check:convention` rules to flag forbidden router/API/server/app-shell imports from core `package/ui` surfaces.
- [x] 7.2 Add documented allowlists for story, mock, test, and explicit adapter paths.
- [x] 7.3 Add convention coverage for `@rezics/ui/shadcn` so the main shadcn barrel cannot re-export demo/product sections.
- [x] 7.4 Run the convention check and fix any violations introduced by the migration.

## 8. Documentation And Storybook

- [x] 8.1 Update `package/ui` documentation to describe core exports, product-aware components, and host capability injection.
- [x] 8.2 Update Storybook examples for `SafeLink`, editor mention search, and image upload to show injected adapters.
- [x] 8.3 Update app/admin usage examples where components moved from direct router/API imports to host wrappers.
- [x] 8.4 Ensure docs emphasize Base UI as the primitive foundation without introducing a new primitive-system dependency direction.

## 9. Verification

- [x] 9.1 Run repo-wide searches for forbidden imports in `package/ui/src`.
- [x] 9.2 Run targeted tests for safe links, editor mention behavior, image upload adapter behavior, and any migrated product-aware components.
- [x] 9.3 Run package-level TypeScript/build checks for `@rezics/ui`, `@rezics/app`, `@rezics/admin`, and `@rezics/folio`.
- [x] 9.4 Run `bun run format:check`.
- [x] 9.5 Run `bun run check:convention`.
- [x] 9.6 Run `bun run knip` or targeted dependency checks to confirm removed dependencies are not still required.
- [x] 9.7 Smoke-check relevant Storybook stories for shadcn primitives, `SafeLink`, and editor adapters.
