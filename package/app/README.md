# @rezics/app

Main user-facing application for the Rezics platform — a community-driven, cross-language catalog of works spanning books, games, and other media. Provides catalog browsing and search, collective tag classification, community realms, reading and authoring, reviews and excerpts, shelves and collections, and social engagement features.

## Overview

A React SPA built with Vite that serves as the primary interface for readers and authors. Uses a feature-folder architecture with clear layering between model, hooks, state, components, and pages.

## Features

- **Catalog & Search** — Browse, search, and discover works (books, games, media) with Meilisearch-powered full-text search
- **Collective Classification** — Global tag voting plus realm-scoped tag votes on individual works
- **Realms** — Community spaces where people gather, discuss, and collectively classify the works they care about
- **Reading** — Read works with the `@rezics/folio` reader
- **Authoring** — Author and edit content with the `@rezics/editor`
- **Reviews & Excerpts** — Write and browse reviews and highlighted passages
- **Shelves & Collections** — Curate works, paired with the curator's review so a shelf explains why each work was collected
- **Comments & Reactions** — Community engagement on content
- **User Preferences** — Theme customization, reading settings, and profile management

## Feature Architecture

Features follow a layered structure (see `docs/feature standard.md`):

```
feature/
  model/      # Pure business types and selectors (no React)
  hooks/      # React logic and side effects
  state/      # Jotai atoms or Zustand stores
  component/  # Pure UI components
  section/    # Business sections (wire state into components)
  page/       # Thin route-level entry points
  index.ts    # Public API for the feature
```

**Key rule:** `model` must never import from `hooks` or `state`. External consumers must go through `index.ts`.

## Scripts

```bash
bun run dev           # Start Vite dev server (port 35001)
bun run build         # Production build
bun run preview       # Preview production build
bun run cosmos        # Launch React Cosmos for component development
```

## Tech Stack

- [React 19](https://react.dev) + [Vite](https://vite.dev)
- [TanStack Router](https://tanstack.com/router) for file-based routing
- [TanStack Query](https://tanstack.com/query) for data fetching via `@rezics/api`
- [UnoCSS](https://unocss.dev) for styling
- [Jotai](https://jotai.org) + [Zustand](https://zustand.docs.pmnd.rs) for state management
- [Meilisearch](https://www.meilisearch.com) (via react-instantsearch) for search
