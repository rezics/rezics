import { CssBaseline, ThemeProvider } from "@mui/material";
import { StyledEngineProvider } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import type { Decorator } from "@storybook/react-vite";
import { useEffect } from "react";

export type ThemeMode = "light" | "dark";

export type CanvasOption =
  | "none"
  | "padded"
  | "fullscreen"
  | { padding: number };

export interface WithRezicsThemeOptions {
  canvas?: CanvasOption;
}

export const themeGlobalTypes = {
  themeMode: {
    name: "Mode",
    description: "Theme mode (light/dark)",
    defaultValue: "light",
    toolbar: {
      icon: "circlehollow",
      items: [
        { value: "light", title: "Light", icon: "sun" },
        { value: "dark", title: "Dark", icon: "moon" },
      ],
      dynamicTitle: true,
    },
  },
} as const;

export const basePreviewParameters = {
  layout: "padded",
  controls: { expanded: true },
} as const;

function resolveCanvasStyle(canvas: CanvasOption): React.CSSProperties | null {
  if (canvas === "none") return null;
  const padding =
    canvas === "padded"
      ? 24
      : canvas === "fullscreen"
        ? 0
        : canvas.padding;
  return {
    minHeight: "100vh",
    padding,
    background: "var(--rzc-color-surface-canvas)",
    color: "var(--rzc-color-text-primary)",
  };
}

export function withRezicsTheme(
  getTheme: (mode: ThemeMode) => Theme,
  options: WithRezicsThemeOptions = {},
): Decorator {
  const canvasStyle = resolveCanvasStyle(options.canvas ?? "padded");

  return (Story, context) => {
    const mode = (context.globals.themeMode ?? "light") as ThemeMode;
    const theme = getTheme(mode);

    useEffect(() => {
      const root = document.documentElement;
      root.dataset.theme = mode;
      root.classList.toggle("dark", mode === "dark");
    }, [mode]);

    return (
      <StyledEngineProvider injectFirst>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {canvasStyle ? (
            <div style={canvasStyle}>
              <Story />
            </div>
          ) : (
            <Story />
          )}
        </ThemeProvider>
      </StyledEngineProvider>
    );
  };
}
