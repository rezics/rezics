import {createEnv} from '@t3-oss/env-core';
import * as v from 'valibot';

export const env = createEnv({
  server: {
    NODE_ENV: v.optional(
      v.union([
        v.literal('development'),
        v.literal('test'),
        v.literal('production'),
      ]),
    ),
    DATABASE_URL: v.string(),
    JWT_SECRET: v.string(),
    REFRESH_TOKEN_SECRET: v.string(),
    AUTH_JWKS_URL: v.optional(v.string()),
    AUTH_JWT_ISSUER: v.optional(v.string()),
    AUTH_JWT_AUDIENCE: v.optional(v.string()),
    AUTH_JWT_CLOCK_TOLERANCE_SECONDS: v.optional(v.string()),
    SMTP_HOST: v.optional(v.string()),
    SMTP_USER: v.optional(v.string()),
    SMTP_PASSWORD: v.optional(v.string()),
    SMTP_USER_NAME: v.optional(v.string()),
    PORT: v.optional(v.string()),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
