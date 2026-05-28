/**
 * Canonical i18next namespace registry shared by app, admin, ui, editor, and folio.
 * Mirrors the namespace table in
 * `openspec/specs/i18n-namespace-architecture/spec.md`.
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
