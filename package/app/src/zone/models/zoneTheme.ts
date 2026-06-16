import type { ZoneTheme } from "@rezics/contract";

/**
 * Zone theme tokens are injected as CSS custom properties at the portal
 * root and referenced via `var(--zone-color-*, fallback)`; raw values never
 * appear inline in components (tokens-only rule). Theme-driven layout values
 * use CSS custom properties plus inline style instead of runtime-selected
 * utility classes because UnoCSS only generates CSS for statically scanned
 * class literals.
 * 专区主题 token 以 CSS 自定义属性注入门户根节点，通过
 * `var(--zone-color-*, fallback)` 引用；原始值绝不内联出现在组件中
 * （tokens-only 规则）。主题驱动的布局值使用 CSS 自定义属性和 inline
 * style，而不是运行时选择的 utility class，因为 UnoCSS 只会为静态扫描到
 * 的 class 字面量生成 CSS。
 */
const ZONE_TOKEN_VARS = {
  background: "--zone-color-background",
  surface: "--zone-color-surface",
  text: "--zone-color-text",
  mutedText: "--zone-color-muted-text",
  accent: "--zone-color-accent",
  accentText: "--zone-color-accent-text",
} as const;

export const ZONE_CONTENT_MAX_WIDTH_DEFAULT = 1440;

export function zoneThemeCssVars(
  theme: ZoneTheme | undefined,
): Record<string, string> {
  const tokens = theme?.tokens ?? {};
  const vars: Record<string, string> = {};
  for (const [token, varName] of Object.entries(ZONE_TOKEN_VARS)) {
    const value = tokens[token as keyof typeof tokens];
    if (value) vars[varName] = value;
  }
  const contentMaxWidth = theme?.layout?.contentMaxWidth;
  if (contentMaxWidth !== undefined) {
    vars["--zone-content-max-width"] = `${contentMaxWidth}px`;
  }
  return vars;
}
