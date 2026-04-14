import "github-markdown-css/github-markdown-light.css";
import "./index.css";
import { ThemeProvider } from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import { StyledEngineProvider } from "@mui/material/styles";
import { AuthProvider } from "@rezics/api/provider";
import {
  applyDynamicThemeToDOM,
  generateDynamicColors,
  getDynamicTheme,
  getTheme,
} from "@rezics/ui";
import { RouterProvider } from "@tanstack/react-router";
import { type ReactNode, StrictMode, useEffect, useMemo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { HelmetProvider } from "react-helmet-async";
import { router } from "@/router";
import { WindowAlert } from "./component/WindowAlert";
import { PersistentSettingsLoader } from "./provider/PersistentSettingsLoader";
import { ReactQueryProvider } from "./provider/react-query";
import { useAppInit } from "./provider/useAppInit";
import { useAppStore } from "./state/appStore";

import "virtual:uno.css";
import "@rezics/ui/shared/style/layers.css";

function AppProviders({ children }: { children: ReactNode }) {
  const themeMode = useAppStore((s) => s.theme);
  const customColor = useAppStore((s) => s.customColor);
  const useDynamicTheme = useAppStore((s) => s.useDynamicTheme);

  useAppInit();

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
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <HelmetProvider>
          <StyledEngineProvider injectFirst>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <PersistentSettingsLoader />
              <ReactQueryProvider>
                <AuthProvider />
                <WindowAlert />
                {children}
              </ReactQueryProvider>
            </ThemeProvider>
          </StyledEngineProvider>
        </HelmetProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}

export default function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
