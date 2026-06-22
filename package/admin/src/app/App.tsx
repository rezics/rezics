import "github-markdown-css/github-markdown-light.css";
import { AuthProvider } from "@rezics/api/providers";
import {
  RezicsI18nProvider,
  useLocale,
  useTranslation,
} from "@rezics/i18n/react";
import { getTextDirection } from "@rezics/i18n/runtime";
import { ExternalLinkModal } from "@rezics/ui";
import { RouterProvider } from "@tanstack/react-router";
import { type ReactNode, StrictMode, Suspense, useEffect, useRef } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { HelmetProvider } from "react-helmet-async";
import { router } from "@/router";
import { Toaster } from "sonner";
import { PersistentSettingsLoader } from "./providers/PersistentSettingsLoader";
import "./providers/i18n";
import { ReactQueryProvider } from "./providers/react-query";
import { useAppInit } from "./providers/useAppInit";
import { useAppStore } from "./states/appStore";

import "virtual:uno.css";
import "@rezics/ui/config/base.css";
function AppProviders({ children }: { children: ReactNode }) {
  const { t } = useTranslation(["shell"]);
  const themeMode = useAppStore((s) => s.theme);

  useAppInit();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", themeMode === "dark");
  }, [themeMode]);

  return (
    <StrictMode>
      <ErrorBoundary
        fallback={<div>{t("shell:app_error_boundary_message")}</div>}
      >
        <HelmetProvider>
          <PersistentSettingsLoader />
          <ReactQueryProvider>
            <AuthProvider />
            <Toaster position="bottom-right" richColors />
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
    <RezicsI18nProvider>
      <Suspense fallback={null}>
        <AppProviders>
          <LocalizedRouterProvider />
        </AppProviders>
      </Suspense>
    </RezicsI18nProvider>
  );
}

function LocalizedRouterProvider() {
  const locale = useLocale();
  const previousLocaleRef = useRef(locale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = getTextDirection(locale);

    if (previousLocaleRef.current !== locale) {
      previousLocaleRef.current = locale;
      void router.invalidate();
    }
  }, [locale]);

  return <RouterProvider router={router} />;
}
