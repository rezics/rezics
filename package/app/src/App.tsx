import { ThemeProvider } from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import { StyledEngineProvider } from "@mui/material/styles";
import { StrictMode, useEffect, useMemo } from "react";
import "github-markdown-css/github-markdown-light.css";

import { applyDynamicThemeToDOM, generateDynamicColors } from "./config/dynamicTheme.ts";
import { getDynamicTheme, getTheme } from "./config/theme.ts";
import { appStore } from "./global/appStore.ts";
import { PersistentSettingsLoader } from "./plugin/providers/PersistentSettingsLoader.tsx";
import { ReactQueryProvider } from "./plugin/providers/react-query.tsx";
import Router from "./router/router.tsx";

export default function App() {
  const themeMode = appStore((s) => s.theme);
  const customColor = appStore((s) => s.customColor);
  const useDynamicTheme = appStore((s) => s.useDynamicTheme);

  const theme = useMemo(() => {
    if (useDynamicTheme && customColor) {
      return getDynamicTheme(themeMode, customColor);
    }
    return getTheme(themeMode, customColor);
  }, [themeMode, customColor, useDynamicTheme]);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("dark", themeMode === "dark");

    if (useDynamicTheme && customColor) {
      const dynamicColors = generateDynamicColors(
        customColor,
        themeMode === "dark",
      );
      applyDynamicThemeToDOM(dynamicColors, themeMode === "dark");
    }
  }, [themeMode, customColor, useDynamicTheme]);

  return (
    <StrictMode>
      <StyledEngineProvider injectFirst>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <PersistentSettingsLoader />
          <ReactQueryProvider>{Router}</ReactQueryProvider>
        </ThemeProvider>
      </StyledEngineProvider>
    </StrictMode>
  );
}
