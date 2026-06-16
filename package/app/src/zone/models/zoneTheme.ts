import type { ZoneTheme } from "@rezics/contract";

/**
 * Zone theme tokens are injected as CSS custom properties at the portal
 * root and referenced via `var(--zone-color-*, fallback)`; raw values never
 * appear inline in components (tokens-only rule).
 * 专区主题 token 以 CSS 自定义属性注入门户根节点，通过
 * `var(--zone-color-*, fallback)` 引用；原始值绝不内联出现在组件中
 * （tokens-only 规则）。
 */
const ZONE_TOKEN_VARS = {
  background: "--zone-color-background",
  surface: "--zone-color-surface",
  text: "--zone-color-text",
  mutedText: "--zone-color-muted-text",
  accent: "--zone-color-accent",
  accentText: "--zone-color-accent-text",
} as const;

export function zoneThemeCssVars(
  theme: ZoneTheme | undefined,
): Record<string, string> {
  const tokens = theme?.tokens ?? {};
  const vars: Record<string, string> = {};
  for (const [token, varName] of Object.entries(ZONE_TOKEN_VARS)) {
    const value = tokens[token as keyof typeof tokens];
    if (value) vars[varName] = value;
  }
  return vars;
}

export function zoneContentWidthClass(theme: ZoneTheme | undefined): string {
  return theme?.layout?.contentWidth === "wide" ? "max-w-8xl" : "max-w-6xl";
}
