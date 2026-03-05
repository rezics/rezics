import {createEnv} from '@t3-oss/env-core';
import {t} from '@package/contract';

export const env = createEnv({
  server: {},
  clientPrefix: 'VITE_',
  client: {
    VITE_API_URL: t.Optional(t.String()) as any,
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
