import {createEnv} from '@t3-oss/env-core';
import * as v from 'valibot';

export const env = createEnv({
  server: {
    SERVER_PORT: v.string(),
    DATABASE_URL: v.string(),
  },
  clientPrefix: 'VITE_',
  client: {
    VITE_API_URL: v.optional(v.string()),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
