# @rezics/ui Boundary

`@rezics/ui` is a Rezics ecosystem UI package. It owns design tokens, shadcn/Base UI primitives, reusable composites, generic editor presentation, and shared Rezics product presentation. It does not own app shell capabilities such as routing, API clients, upload, search, auth, cache, or route progress.

## Export Tiers

- Core reusable: root exports, `@rezics/ui/shadcn`, `@rezics/ui/uno.config`, config, i18n, primitives, and composites that only need local UI behavior.
- Product-aware reusable: components typed with shared `@rezics/contract` vocabulary such as content ratings or URL classification.
- Editor-adapted: editor UI exports accept host capabilities such as `userSearch`, `imageProviders`, and `createRezicsUploadProvider(uploadImage)`.
- Router-adapted: `SafeLink` accepts a `linkRenderer` for app-route navigation and falls back to a normal anchor. Concrete TanStack Router links live in app/admin wrappers.
- Story/mock/test-only: Storybook route fixtures and link stories may import TanStack Router to demonstrate host integration.
- App-owned wrappers: app/admin provide router links, route progress triggers, user search, and upload adapters.

## Current Classification

| Module | Classification | Boundary note |
| --- | --- | --- |
| `src/link/SafeLink.tsx` | Core/product-aware reusable | Uses `classifyUrl` shared vocabulary; app-route navigation is injected with `linkRenderer`. |
| `src/primitive/link/*` | Core reusable | Exposes plain anchor-style primitives and URL helpers only. TanStack wrappers are app/admin-owned. |
| `src/primitive/progress/GlobalProgressBar.tsx` | Core reusable | Progress is driven by an injected `loadingKey`; route state belongs to the host. |
| `src/editor/RezicsMarkdownEditor.tsx` | Editor-adapted | Accepts `userSearch` and `imageProviders` from the host. |
| `src/editor/plugins/EditorMention.tsx` | Editor-adapted | Uses `UserSearchAdapter`; no API client import. |
| `src/editor/image/RezicsUploadProvider.tsx` | Editor-adapted | Exports `createRezicsUploadProvider(uploadImage)`; no API mutation import. |
| `src/composite/content/RatingBadge.tsx` and `RatingSelector.tsx` | Product-aware reusable | Keeps `ContentRating` as shared Rezics vocabulary. |
| `src/composite/content/MarkdownContent.tsx` | Core reusable | Uses editor markdown rendering plus delegated safe external-link handling. |
| `src/translation/TranslationEditor.tsx` | Core reusable | Uses a local fallback language instead of importing app/product defaults. |
| `src/shadcn/sections/*` | Demo/documentation | Not exported from `@rezics/ui/shadcn`; available through explicit source/subpath imports only. |
| `src/mocks/*`, `*.stories.tsx`, `*.test.tsx` | Story/mock/test-only | May import router or fixture dependencies. |

## Consumer Responsibilities

- App/admin wrappers should import TanStack Router and pass link rendering to `SafeLink` when SPA navigation is required.
- App/admin wrappers should import `@rezics/api` and pass user search/upload adapters to editor UI.
- New core UI source must not import `@tanstack/react-router`, `@rezics/api`, `@rezics/server`, or app/admin internals. `task check:convention` enforces this boundary.
- `@rezics/contract` imports are acceptable for stable shared vocabulary, not for app policy, workflow ownership, fetching, or navigation.
- Core UI source may import `@rezics/i18n/react` for active-locale subscriptions
  and `useMessage(messageBag)`. This subpath is intentionally neutral and must
  not import generated product messages, UI message catalogs, routers, API
  clients, or app/admin shell modules.
