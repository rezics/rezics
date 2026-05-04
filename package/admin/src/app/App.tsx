import "github-markdown-css/github-markdown-light.css";
import { AuthProvider } from "@rezics/api/providers";
import { ExternalLinkModal } from "@rezics/ui";
import { RouterProvider } from "@tanstack/react-router";
import { type ReactNode, StrictMode, useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { HelmetProvider } from "react-helmet-async";
import { router } from "@/router";
import { WindowAlert } from "./components/WindowAlert";
import { PersistentSettingsLoader } from "./providers/PersistentSettingsLoader";
import { ReactQueryProvider } from "./providers/react-query";
import { useAppInit } from "./providers/useAppInit";
import { useAppStore } from "./states/appStore";

import "virtual:uno.css";
import "@rezics/ui/config/tokens.css";
import "@rezics/ui/config/base.css";

function AppProviders({ children }: { children: ReactNode }) {
  const themeMode = useAppStore((s) => s.theme);

  useAppInit();

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("theme-rezics");
    html.classList.toggle("dark", themeMode === "dark");
    html.dataset.theme = themeMode;
  }, [themeMode]);

  return (
    <StrictMode>
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <HelmetProvider>
          <PersistentSettingsLoader />
          <ReactQueryProvider>
            <AuthProvider />
            <WindowAlert />
            <ExternalLinkModal />
            {children}
          </ReactQueryProvider>
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
