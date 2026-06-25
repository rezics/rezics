export const adminRuntime = {
  appEnv:
    process.env.NEXT_PUBLIC_ICS_ENV ?? process.env.NODE_ENV ?? "development",
} as const;
