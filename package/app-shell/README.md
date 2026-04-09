# @rezics/app-shell

Shared application shell and infrastructure layer for Rezics frontend applications. Provides the root layout, theme system, authentication state, and global providers used by both `@rezics/app` and `@rezics/admin`.

## Overview

This package encapsulates the common bootstrapping logic that every Rezics frontend application needs: authentication, theming, query client setup, and the application shell layout.

## Exports

### Components

- **`AppShell`** — Root wrapper component providing the application layout
- **`WindowAlert`** — Global alert/notification overlay

### Providers

- **`AuthProvider`** — Authentication state and session management
- **`ReactQueryProvider`** — TanStack Query client with persistence
- **`PersistentSettingsLoader`** — User settings hydration from storage

### Theme

- **`getTheme` / `getDynamicTheme`** — Material-UI theme configuration
- **`generateDynamicColors`** — Dynamic color palette generation from seed colors
- **`extractColorFromImage`** — Extract dominant color from images for theming
- **`PRESET_COLORS`** — Built-in color presets

### State

- **`useAppStore`** — Global application state (Zustand)
- **`useAuthSessionStore`** — Authentication session state with hydration
- **`useAlertStore`** — Alert/notification state

### Hooks

- **`useAppInit`** — Application initialization lifecycle hook

### Configuration

- **`./uno.config`** — Shared UnoCSS configuration for consistent styling

## Usage

```typescript
import { AppShell, AuthProvider, ReactQueryProvider } from '@rezics/app-shell';

function App() {
  return (
    <ReactQueryProvider>
      <AuthProvider>
        <AppShell>{/* routes */}</AppShell>
      </AuthProvider>
    </ReactQueryProvider>
  );
}
```

## Tech Stack

- [React 19](https://react.dev) with provider composition
- [Material-UI 7](https://mui.com) + [Material Color Utilities](https://github.com/nickvdyck/material-color-utilities) for dynamic theming
- [Zustand](https://zustand.docs.pmnd.rs) for state management
- [UnoCSS](https://unocss.dev) with Tailwind/shadcn presets
