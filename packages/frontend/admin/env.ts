const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3000";

export const env = {
  VITE_API_URL: apiUrl,
  VITE_AUTH_ADMIN_URL: process.env.NEXT_PUBLIC_AUTH_ADMIN_URL,
  VITE_REACTION_SERVICE_URL: process.env.NEXT_PUBLIC_REACTION_SERVICE_URL,
} as const;

export const adminRuntime = {
  appEnv:
    process.env.NEXT_PUBLIC_ICS_ENV ?? process.env.NODE_ENV ?? "development",
} as const;
