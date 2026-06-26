"use client";

import { RezicsI18nProvider } from "@rezics/i18n/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AdminAuthGuard } from "@/admin/app/guard/AdminAuthGuard";
import { AdminAppProviders } from "@/admin/app/AdminAppProviders";
import AdminLayout from "@/admin/core/layouts/AdminLayout";

export default function AdminRouteLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return (
      <RezicsI18nProvider>
        <AdminAppProviders>{children}</AdminAppProviders>
      </RezicsI18nProvider>
    );
  }

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
