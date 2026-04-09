# @rezics/admin

Admin dashboard for the Rezics platform. Provides operational management interfaces for user administration, JWT service configuration, and system monitoring.

## Overview

A standalone React SPA built with Vite and Material-UI. Connects to the auth and server backends via `@rezics/api` for administrative operations.

## Features

- **User Management** — List, create, update, ban/unban users; manage sessions and roles
- **JWT Service** — Configure and monitor JWT service metadata and key rotation
- **Statistics** — Platform usage analytics and charts
- **Organization Management** — Create and manage organizations, members, and invitations

## Scripts

```bash
bun run dev           # Start Vite dev server
bun run build         # Production build
bun run preview       # Preview production build
bun run cosmos        # Launch React Cosmos for component development
```

## Tech Stack

- [React 19](https://react.dev) + [Vite](https://vite.dev)
- [Material-UI 7](https://mui.com) for UI components
- [TanStack Router](https://tanstack.com/router) for file-based routing
- [TanStack Query](https://tanstack.com/query) for data fetching
- [Chart.js](https://www.chartjs.org) for data visualization
- [UnoCSS](https://unocss.dev) with Tailwind and shadcn presets
