import "github-markdown-css/github-markdown-light.css";
import "./index.css";
import { AuthProvider } from "@rezics/api/providers";
import { ExternalLinkModal } from "@rezics/ui";
import { RouterProvider } from "@tanstack/react-router";
import { type ReactNode, StrictMode, useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "sonner";
import { router } from "@/router";
import { WindowAlert } from "./components/WindowAlert";
import { PersistentSettingsLoader } from "./providers/PersistentSettingsLoader";
import { ReactQueryProvider } from "./providers/react-query";
import { useAppInit } from "./providers/useAppInit";
import { useAppStore } from "./states/appStore";

import "virtual:uno.css";
import "@rezics/ui/config/base.css";

function AppInit({ children }: { children: ReactNode }) {
  useAppInit();
  return children;
}

function AppProviders({ children }: { children: ReactNode }) {
  const themeMode = useAppStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", themeMode === "dark");
  }, [themeMode]);

  return (
    <StrictMode>
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <HelmetProvider>
          <PersistentSettingsLoader />
          <ReactQueryProvider>
            <AppInit>
              <AuthProvider />
              <WindowAlert />
              <ExternalLinkModal />
              <Toaster position="bottom-right" richColors />
              {children}
            </AppInit>
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
