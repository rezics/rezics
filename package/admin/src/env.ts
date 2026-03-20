import {createEnv} from '@t3-oss/env-core';
import * as v from 'valibot';

export const env = createEnv({
  server: {},
  clientPrefix: 'VITE_',
  client: {
    VITE_API_URL: v.string(),
    VITE_AUTH_API_URL: v.string(),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});

export const adminRuntime = {
  appEnv: (import.meta.env.ICS_ENV ?? import.meta.env.NODE_ENV ?? 'development') as string,
} as const;
