"use client";
import type { ReactNode } from "react";
import AdminPage from "./page";
import { AdminNav } from "./nav";

function AdminShell({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex gap-8">
      <AdminNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export default {
  Default: <AdminPage />,
  Mobile: (
    <div className="w-[320px] p-4">
      <AdminPage />
    </div>
  ),
  WithSidebarShell: (
    <div className="w-[1280px] p-4">
      <AdminShell>
        <AdminPage />
      </AdminShell>
    </div>
  ),
  UltraWide: (
    <div className="w-[1536px] p-4">
      <AdminShell>
        <AdminPage />
      </AdminShell>
    </div>
  ),
};
