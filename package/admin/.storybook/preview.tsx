import { CssBaseline, ThemeProvider } from "@mui/material";
import { StyledEngineProvider } from "@mui/material/styles";
import { getTheme } from "@rezics/ui";
import type { Decorator, Preview } from "@storybook/react-vite";
import { useEffect } from "react";

import "virtual:uno.css";

type ThemeMode = "light" | "dark";

const withRezicsTheme: Decorator = (Story, context) => {
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
        <Story />
      </ThemeProvider>
    </StyledEngineProvider>
  );
};

const preview: Preview = {
  globalTypes: {
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
  },
  decorators: [withRezicsTheme],
  parameters: {
    layout: "padded",
    controls: { expanded: true },
  },
};

export default preview;
