# @rezics/frontend

ViNext-powered, Next.js-compatible frontend workspace. The current entry point provides a working REZICS application shell and separates routing, feature composition, and shared UI consumers so the app can grow by domain.

## Directory conventions

- `app/`: Next.js-compatible routes, the root layout, and global theme. `(app)` and `(auth)` organize application and authentication pages without changing public URLs.
- `features/`: UI composition by business capability. New capabilities should have their own directory here rather than accumulating in page entry points.
- `app/(app)/app-shell.tsx` and `app/providers.tsx`: Application adapters that provide routing, authentication, translations, and API access to the shared UI.
- `@rezics/ui`: SharkUI and custom shared components in `libraries/ui`; import directly from the package root.
- `lib/`: Stateless utilities shared across features.

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
global Tailwind styles and resolves the same `@/` imports as the frontend.

Keep each product component and its fixture together under the owning feature,
for example `features/content-feed/feed-card.tsx` and
`features/content-feed/feed-card.fixture.tsx`. Reserve `cosmos.decorator.tsx`
files for shared fixture providers or canvas setup; Cosmos does not own product
components.

## Authentication development

The frontend accesses Better Auth through `/api/auth`. The development server proxies that path to `http://localhost:3001`, keeping session cookies first-party. Start the backend alongside the frontend, and configure an equivalent reverse proxy for `/api/auth` in deployed environments.

## PWA

Production builds use `vite-plugin-pwa` to generate a Chinese- and English-language Web App Manifest and Workbox service worker. The development server does not register the service worker by default, preventing cached assets from disrupting hot updates. Use a production build over HTTPS or localhost to verify installation, updates, and the offline fallback. The PWA does not cache API responses, RSC responses, or page data; it precaches only versioned client static assets and the offline page.

## Using and adding UI components

Use components directly from the shared package:

```tsx
import { Button, Card } from "@rezics/ui";
```

Add or update SharkUI components in `libraries/ui`, and review changes with `--dry-run` and `--diff` before writing. The shared theme is imported by `app/styles.css`.
