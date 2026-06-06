export const THEME_STYLES: Record<
  string,
  { background: string; color: string; selection: string }
> = {
  light: {
    background: "#ffffff",
    color: "#1a1a1a",
    selection: "rgba(59, 130, 246, 0.2)",
  },
  dark: {
    background: "#1a1a1a",
    color: "#e0e0e0",
    selection: "rgba(99, 170, 255, 0.3)",
  },
  sepia: {
    background: "#f4ecd8",
    color: "#5b4636",
    selection: "rgba(139, 90, 43, 0.2)",
  },
};

export function getThemeVars(theme: string): React.CSSProperties {
  const t = THEME_STYLES[theme] ?? THEME_STYLES.light;
  return {
    "--folio-bg": t.background,
    "--folio-color": t.color,
    "--folio-selection": t.selection,
    background: t.background,
    color: t.color,
  } as React.CSSProperties;
}
