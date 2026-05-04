import type { Decorator } from "@storybook/react-vite";
import { useEffect } from "react";
import { GLOBALS_UPDATED } from "storybook/internal/core-events";
import { addons } from "storybook/preview-api";

export type ThemeMode = "light" | "dark";
export type Density = "compact" | "comfortable" | "spacious";

export const THEME_BROADCAST_EVENT = "rezics:theme-mode";

const THEME_LISTENERS_FLAG = "__rezicsThemeListenersAttached";

function applyDensity(value: unknown) {
  const resolved: Density =
    value === "compact" || value === "spacious" ? value : "comfortable";
  const list = document.documentElement.classList;
  list.toggle("density-compact", resolved === "compact");
  list.toggle("density-spacious", resolved === "spacious");
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const w = window as typeof window & { [THEME_LISTENERS_FLAG]?: boolean };
  if (!w[THEME_LISTENERS_FLAG]) {
    w[THEME_LISTENERS_FLAG] = true;
    const applyThemeMode = (mode: unknown) => {
      const resolved: ThemeMode = mode === "dark" ? "dark" : "light";
      document.documentElement.classList.toggle("dark", resolved === "dark");
    };
    addons
      .getChannel()
      .on(
        GLOBALS_UPDATED,
        ({
          globals,
        }: {
          globals?: { themeMode?: unknown; density?: unknown };
        }) => {
          applyThemeMode(globals?.themeMode);
          applyDensity(globals?.density);
        },
      );
    window.addEventListener("message", (event: MessageEvent) => {
      const data = event.data;
      if (
        data &&
        typeof data === "object" &&
        (data as { type?: unknown }).type === THEME_BROADCAST_EVENT
      ) {
        applyThemeMode((data as { mode?: unknown }).mode);
      }
    });
  }
}

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
  density: {
    name: "Density",
    description: "Spacing density (compact/comfortable/spacious)",
    defaultValue: "comfortable",
    toolbar: {
      icon: "expand",
      items: [
        { value: "compact", title: "Compact" },
        { value: "comfortable", title: "Comfortable" },
        { value: "spacious", title: "Spacious" },
      ],
      dynamicTitle: true,
    },
  },
} as const;

export const basePreviewParameters = {
  layout: "padded",
  controls: { expanded: true },
  actions: { argTypesRegex: "^on.*" },
  a11y: {
    test: "todo",
  },
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
    background: "var(--colors-surface-canvas)",
    color: "var(--colors-text-primary)",
  };
}

export function withRezicsTheme(
  options: WithRezicsThemeOptions = {},
): Decorator {
  const canvasStyle = resolveCanvasStyle(options.canvas ?? "padded");

  return (Story, context) => {
    const mode = (context.globals.themeMode ?? "light") as ThemeMode;
    const density = (context.globals.density ?? "comfortable") as Density;

    useEffect(() => {
      document.documentElement.classList.toggle("dark", mode === "dark");
    }, [mode]);

    useEffect(() => {
      applyDensity(density);
    }, [density]);

    return canvasStyle ? (
      <div style={canvasStyle}>
        <Story />
      </div>
    ) : (
      <Story />
    );
  };
}
