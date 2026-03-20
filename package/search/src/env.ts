import {createEnv} from '@t3-oss/env-core';
import * as v from 'valibot';

export const env = createEnv({
  server: {
    MEILI_HOST: v.fallback(v.string(), 'http://localhost:7700'),
    MEILI_MASTER_KEY: v.fallback(v.string(), 'masterKey'),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
