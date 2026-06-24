"use client";

import { configureApi } from "@rezics/contract/api/config";
import { adminRuntime, env } from "@/admin/env";
import App from "@/admin/app/App";
import { initI18n } from "@/admin/app/providers/i18n";

configureApi({
  apiBaseUrl: env.VITE_API_URL,
  authBaseUrl: env.VITE_API_URL,
  authAdminBaseUrl:
    env.VITE_AUTH_ADMIN_URL ??
    (adminRuntime.appEnv === "development" ? "http://localhost:3001" : ""),
  reactionServiceUrl: env.VITE_REACTION_SERVICE_URL ?? env.VITE_API_URL,
});
void initI18n();

export function AdminAppHost() {
  return <App />;
}
