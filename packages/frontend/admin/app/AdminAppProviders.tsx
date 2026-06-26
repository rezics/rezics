"use client";

import { ExternalLinkModal } from "@rezics/ui";
import { Component, StrictMode, useEffect, type ReactNode } from "react";
import { useTranslation } from "@rezics/i18n/react";
import { AuthProvider } from "@/admin/auth/session/AuthProvider";
import { WindowAlert } from "./components/WindowAlert";
import { PersistentSettingsLoader } from "./providers/PersistentSettingsLoader";
import "./providers/i18n";

class AdminErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export function AdminAppProviders({ children }: { children: ReactNode }) {
  const { t } = useTranslation(["shell"]);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

    return (
      <StrictMode>
      <AdminErrorBoundary
        fallback={<div>{t("shell:app_error_boundary_message")}</div>}
      >
        <PersistentSettingsLoader />
        <AuthProvider />
        <WindowAlert />
        <ExternalLinkModal />
        {children}
      </AdminErrorBoundary>
    </StrictMode>
  );
}
