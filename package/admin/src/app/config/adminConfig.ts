export const adminConfig = {
  appName: 'REZICS Admin',
  // Vite config injects `process.env` via `loadEnv(..., 'ICS')`
  env: (import.meta.env?.ICS_ENV ??
    import.meta.env?.NODE_ENV ??
    'development') as string,
};
