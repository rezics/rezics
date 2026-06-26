"use client";

import { ExternalLinkModal } from "@rezics/ui";
import type { ReactNode } from "react";
import { StrictMode, useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { HelmetProvider } from "react-helmet-async";
import { useTranslation } from "@rezics/i18n/react";
import { AuthProvider } from "@/admin/auth/session/AuthProvider";
import { WindowAlert } from "./components/WindowAlert";
import { PersistentSettingsLoader } from "./providers/PersistentSettingsLoader";
import "./providers/i18n";
import { useAppInit } from "./providers/useAppInit";
import { useAppStore } from "./states/appStore";

export function AdminAppProviders({ children }: { children: ReactNode }) {
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
          <AuthProvider />
          <WindowAlert />
          <ExternalLinkModal />
          {children}
        </HelmetProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}
