# @rezics/frontend

ViNext-powered, Next.js-compatible frontend workspace. The current entry point provides a working REZICS application shell and separates routing, feature composition, and shared UI consumers so the app can grow by domain.

## Directory conventions

- `app/`: Thin Next.js-compatible framework adapters. Keep App Router special files and only the routing/request glue they require here; `(app)` and `(auth)` organize routes without changing public URLs.
- `features/`: Product UI and behavior composed by business capability, including page and application-shell implementations. New capabilities should have their own directory here rather than accumulating in route entry points.
- `lib/` and `i18n/`: Cross-cutting frontend infrastructure that does not belong to a product capability. Route entries may adapt request-derived values into these owners, but ordinary implementation modules should not live under `app/`.
- `@rezics/ui`: SharkUI and custom shared components in `libraries/ui`; import directly from the package root.

Loading boundaries control which UI is replaced while a soft navigation is
pending; they do not determine whether navigation is client-side. Place each
boundary inside the shared layout that must remain mounted, at the narrowest
route segment whose descendants may be replaced. Keep the general application
fallback at `(app)/loading.tsx` so the application shell remains interactive,
and add narrower feature fallbacks where they can preserve more context. Do not
add a root `app/loading.tsx` while the application shell is owned by
`(app)/layout.tsx`. Delegate fallback UI to the owning feature.

The fixed viewport progress bar reports the real App Router pending lifecycle;
it remains indeterminate because a streamed route has no measurable total.
Feature modules must use the application-shell `AppLink` and
`useApplicationRouter` owners rather than importing `next/link` or
`useRouter` directly. Segment fallbacks and local query states remain
responsible for the destination content after navigation commits.

## Common commands

Run from the repository root:

```sh
task frontend:dev
task frontend:build
task frontend:typecheck
```

## Component workspace

Run React Cosmos from the repository root:

```sh
yarn workspace @rezics/frontend cosmos
```

Cosmos opens on `http://localhost:5000`. Add colocated `*.fixture.tsx` files for
the component states you want to develop or debug. The workspace loads the app's
global Tailwind styles and resolves the same `@/` imports as the frontend. Its
Vite renderer is rooted at the monorepo level so its HTML entry cannot shadow
the Vinext application inside `apps/web`.

Keep each product component and its fixture together under the owning feature,
for example `features/content-feed/feed-card.tsx` and
`features/content-feed/feed-card.fixture.tsx`. Reserve `cosmos.decorator.tsx`
files for shared fixture providers or canvas setup; Cosmos does not own product
components.

Reusable, deterministic scenario content belongs to `@rezics/fixture-data`, and
shared React access belongs to `@rezics/fixture-client`. Both are development-only
dependencies: import them only from fixture, test, or Cosmos setup modules. Keep
product interface copy in `@rezics/i18n`; localized fixture content is data, not a
production translation namespace. Cosmos exposes UI locale and content language
as independent controls so mixed-language product states remain representable.

## Authentication and backend routing

The frontend accesses the backend through same-origin `/api` and `/image-assets`
routes, keeping Better Auth session cookies first-party. The development server
proxies those routes directly. Production builds serve equivalent route handlers,
which forward to the internal HTTP(S) origin configured by `REZICS_API_ORIGIN`.
Set `BETTER_AUTH_URL` to the public frontend origin so authentication redirects and
secure cookie policy use the browser-facing URL.

## PWA

Production builds use `vite-plugin-pwa` to generate a Chinese- and English-language Web App Manifest and Workbox service worker. The development server does not register the service worker by default, preventing cached assets from disrupting hot updates. Use a production build over HTTPS or localhost to verify installation, updates, and the offline fallback. The PWA does not cache API responses, RSC responses, or page data; it precaches only versioned client static assets and the offline page.

## Using and adding UI components

Use components directly from the shared package:

```tsx
import { Button, Card } from "@rezics/ui";
```

Add or update SharkUI components in `libraries/ui`, and review changes with `--dry-run` and `--diff` before writing. The shared theme is imported by `styles/global.css`.
