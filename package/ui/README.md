# @rezics/ui

Shared React UI component library for the Rezics platform. Combines shadcn/ui primitives with custom composite components for a consistent design system.

## Overview

This package provides all reusable UI components used across `@rezics/app` and `@rezics/admin`. It layers custom composite components on top of [shadcn/ui](https://ui.shadcn.com) (Radix UI + Tailwind CSS) primitives.

## Exports

| Entry Point        | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `.`                | Composite components (main entry)                    |
| `./shadcn`         | shadcn/ui primitives (Radix UI-based)                |
| `./editor`         | Editor integration components                        |
| `./primitive/link` | Link primitive                                       |
| `./uno.config`     | Shared UnoCSS config factory for rezics design tokens |
| `./config/base.css` | Shared baseline CSS for app shells                  |

## Design System Setup

Consumer apps should use the shared UnoCSS config and baseline CSS instead of
copying token definitions.

```ts
// uno.config.ts
import { createUnoConfig } from "@rezics/ui/uno.config";

export default createUnoConfig();
```

```ts
// app entry
import "virtual:uno.css";
import "@rezics/ui/config/base.css";
```

See [docs/using-rezics-design.md](./docs/using-rezics-design.md) for the full
integration guide.

## Component Categories

### Composite (`./`)

High-level, feature-ready components organized by concern:

| Category       | Description                                   |
| -------------- | --------------------------------------------- |
| `auth`         | Authentication-related UI                     |
| `button`       | Button variants and actions                   |
| `content`      | Content display components                    |
| `form`         | Form controls and layouts                     |
| `layout`       | Page and section layouts                      |
| `navigation`   | Navigation bars, menus, breadcrumbs           |
| `pagination`   | Pagination controls                           |
| `surface`      | Cards, panels, and surface containers         |
| `typography`   | Text, headings, and typographic elements      |

### shadcn (`./shadcn`)

Accessible primitives built on Radix UI: Avatar, Checkbox, Dialog, Dropdown Menu, Select, Tabs, Tooltip, and more.

## Scripts

```bash
bun run dev      # Watch mode build
bun run test     # Run tests
bun run cosmos   # Launch React Cosmos for component development
```

## Tech Stack

- [Radix UI](https://www.radix-ui.com) for accessible primitives
- [shadcn/ui](https://ui.shadcn.com) component patterns
- [dnd-kit](https://dndkit.com) for drag-and-drop
- [Recharts](https://recharts.org) for charting
- [Embla Carousel](https://www.embla-carousel.com) for carousels
- [Tailwind Merge](https://github.com/dcastil/tailwind-merge) for class composition
- [React Cosmos](https://reactcosmos.org) for component development
