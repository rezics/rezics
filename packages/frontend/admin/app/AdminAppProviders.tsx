"use client";

import { ExternalLinkModal } from "@rezics/ui";
import type { ReactNode } from "react";
import { StrictMode, useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useTranslation } from "@rezics/i18n/react";
import { AuthProvider } from "@/admin/auth/session/AuthProvider";
import { WindowAlert } from "./components/WindowAlert";
import { PersistentSettingsLoader } from "./providers/PersistentSettingsLoader";
import "./providers/i18n";

export function AdminAppProviders({ children }: { children: ReactNode }) {
  const { t } = useTranslation(["shell"]);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  return (
    <StrictMode>
      <ErrorBoundary
        fallback={<div>{t("shell:app_error_boundary_message")}</div>}
      >
        <PersistentSettingsLoader />
        <AuthProvider />
        <WindowAlert />
        <ExternalLinkModal />
        {children}
      </ErrorBoundary>
    </StrictMode>
  );
}
