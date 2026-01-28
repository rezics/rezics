export const adminConfig = {
  appName: 'REZICS Admin',
  // Vite config injects `process.env` via `loadEnv(..., 'ICS')`
  env: (process.env?.ICS_ENV ?? process.env?.NODE_ENV ?? 'development') as string,
};

