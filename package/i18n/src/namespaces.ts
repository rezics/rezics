/**
 * Canonical i18next namespace registry shared by app, admin, ui, editor, and folio.
 * This is the single source of truth for the namespace set; the arrays below
 * also encode each namespace's loading tier: BOOTSTRAP loads in parallel during
 * `i18next.init`, LAZY loads on demand per route, and UI ships bundled with
 * `@rezics/ui`. New keys go in the namespace whose domain matches closest.
 */

export const BOOTSTRAP_NAMESPACES = ["common", "shell", "auth"] as const;

export const LAZY_NAMESPACES = [
  "book",
  "page",
  "entity",
  "community",
  "search",
  "settings",
  "editor",
  "admin",
  "zone",
] as const;

export const UI_NAMESPACES = ["ui"] as const;

export const NAMESPACES = [
  ...BOOTSTRAP_NAMESPACES,
  ...LAZY_NAMESPACES,
  ...UI_NAMESPACES,
] as const;

export type BootstrapNamespace = (typeof BOOTSTRAP_NAMESPACES)[number];
export type LazyNamespace = (typeof LAZY_NAMESPACES)[number];
export type UiNamespace = (typeof UI_NAMESPACES)[number];
export type Namespace = (typeof NAMESPACES)[number];

export const DEFAULT_NAMESPACE: Namespace = "common";
