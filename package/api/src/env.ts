import {createEnv} from '@t3-oss/env-core';
import * as v from 'valibot';

const runtimeEnv =
  typeof process !== 'undefined'
    ? {...process.env, ...import.meta.env}
    : import.meta.env;

export const env = createEnv({
  server: {},
  clientPrefix: 'VITE_',
  client: {
    VITE_API_URL: v.string(),
    VITE_AUTH_API_URL: v.string(),
    VITE_TURNSTILE_SITE_KEY: v.string(),
    VITE_APP_VERSION: v.optional(v.string()),
  },
  runtimeEnv,
  emptyStringAsUndefined: true,
});
