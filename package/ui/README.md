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

## Localized Component Copy

Reusable UI components that own default copy import their own generated UI
messages by name and bind them through the neutral adapter:

```tsx
import { useMessage } from "@rezics/i18n/react";
import { ui_password_label } from "#/paraglide/messages.js";

const messages = { ui_password_label };

function Example() {
  const m = useMessage(messages);
  return <span>{m.ui_password_label()}</span>;
}
```

Host string override props stay host-owned. If a host passes a label or helper
text, the UI component renders that string as supplied.

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
