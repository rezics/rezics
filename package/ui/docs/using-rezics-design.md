# Using the rezics design system

This guide is for packages or external repositories that consume `@rezics/ui`
and want the same design-token behavior as the rezics app packages.

## What `@rezics/ui` provides

`@rezics/ui` exposes two public integration surfaces:

| Entry point | Role |
| --- | --- |
| `@rezics/ui/uno.config` | Creates the shared UnoCSS config. It emits rezics design tokens as CSS variables and exposes the curated utility names. |
| `@rezics/ui/config/base.css` | Applies app-shell globals: page background/foreground, scrollbar styling, CJK font routing, and reduced-motion behavior. |

The package owns the UnoCSS presets required to evaluate
`@rezics/ui/uno.config`. Consumer apps only own their build integration.

## Install

Install `@rezics/ui` and the host build tooling used by your app. For a Vite app,
that normally means `vite`, `@vitejs/plugin-react`, and `unocss`.

```bash
bun add @rezics/ui
bun add -d unocss
```

## UnoCSS config

Create a local `uno.config.ts` that delegates to the shared config:

```ts
import { createUnoConfig } from "@rezics/ui/uno.config";

export default createUnoConfig();
```

Then load UnoCSS from your Vite config:

```ts
import react from "@vitejs/plugin-react";
import UnoCSS from "unocss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [UnoCSS(), react()],
});
```

If your Vite setup does not auto-discover `uno.config.ts`, pass the config path
to `UnoCSS(...)`.

## App entry CSS

Import the generated UnoCSS sheet before the shared baseline CSS:

```ts
import "virtual:uno.css";
import "@rezics/ui/config/base.css";
```

The generated sheet defines the token variables. `base.css` consumes those
variables for global page behavior.

## Dark mode

Dark mode is class-based. Toggle the `dark` class on the document element:

```ts
document.documentElement.classList.toggle("dark", isDark);
```

Components should not receive a JavaScript theme object. Token values resolve
through CSS custom properties emitted by the shared UnoCSS config.

## Writing styles

Prefer curated UnoCSS token utilities:

```tsx
<section className="bg-surface-canvas text-text-primary">
  <button className="bg-brand-fill text-text-on-brand">Save</button>
</section>
```

For raw CSS, use the flat custom properties emitted by the config:

```css
.panel {
  background: var(--colors-surface-elevated);
  color: var(--colors-text-primary);
  box-shadow: var(--shadow-modal);
}
```

Do not copy token files, hardcode rezics hex values, or depend on private paths
under `@rezics/ui/src/config/tokens`. If a token or utility is missing, extend
the shared config through an OpenSpec-backed change in `@rezics/ui`.

## Minimal checklist

- `uno.config.ts` calls `createUnoConfig()` from `@rezics/ui/uno.config`.
- The app's bundler loads the UnoCSS plugin.
- The app entry imports `virtual:uno.css`.
- The app entry imports `@rezics/ui/config/base.css`.
- Dark mode toggles `html.dark`.
- Components use token utilities such as `bg-surface-canvas`,
  `text-text-primary`, `border-border-whisper`, and `bg-brand-fill`.
