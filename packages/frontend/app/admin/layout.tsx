"use client";

import { RezicsI18nProvider } from "@rezics/i18n/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AdminAuthGuard } from "@/admin/app/guard/AdminAuthGuard";
import { AdminAppProviders } from "@/admin/app/AdminAppProviders";
import AdminLayout from "@/admin/core/layouts/AdminLayout";

const migratedRoutes = new Set([
  "/admin",
  "/admin/auth/email",
  "/admin/auth/jwt-services",
  "/admin/auth/sessions",
  "/admin/auth/status",
  "/admin/auth/users",
  "/admin/authority",
  "/admin/book",
  "/admin/book/meili",
  "/admin/entity",
  "/admin/governance",
  "/admin/governance/audit",
  "/admin/governance/cases",
  "/admin/governance/enforcement",
  "/admin/jwt-services",
  "/admin/meili",
  "/admin/meili/observability",
  "/admin/misc/echokv",
  "/admin/post",
  "/admin/realm",
  "/admin/repair",
  "/admin/review",
  "/admin/settings",
  "/admin/shelf",
  "/admin/status",
  "/admin/status/cdc",
  "/admin/status/history",
  "/admin/status/queue",
  "/admin/status/services",
  "/admin/tag/low-score",
  "/admin/token",
  "/admin/unit",
  "/admin/unit/create",
  "/admin/unit/meili",
  "/admin/user",
  "/admin/user/create",
  "/admin/user/meili",
]);

function isMigratedRoute(pathname: string) {
  return (
    migratedRoutes.has(pathname) ||
    /^\/admin\/entity\/[^/]+$/.test(pathname) ||
    /^\/admin\/unit\/[^/]+$/.test(pathname) ||
    /^\/admin\/user\/[^/]+$/.test(pathname)
  );
}

export default function AdminRouteLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return (
      <RezicsI18nProvider>
        <AdminAppProviders>{children}</AdminAppProviders>
      </RezicsI18nProvider>
    );
  }

  if (!isMigratedRoute(pathname)) return children;

  return (
    <RezicsI18nProvider>
      <AdminAppProviders>
        <AdminLayout>
          <AdminAuthGuard />
          {children}
        </AdminLayout>
      </AdminAppProviders>
    </RezicsI18nProvider>
  );
}
