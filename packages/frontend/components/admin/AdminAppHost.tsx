"use client";

import App from "@/admin/app/App";
import { initI18n } from "@/admin/app/providers/i18n";

void initI18n();

export function AdminAppHost() {
  return <App />;
}
