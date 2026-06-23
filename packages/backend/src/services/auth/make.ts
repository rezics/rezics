import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

import * as schema from "../database/schema/all.ts";

export const make = (pool: Pool, baseURL: string) =>
  betterAuth({
    baseURL,
    trustedOrigins: ["*"],
    database: drizzleAdapter(drizzle({ client: pool }), {
      provider: "pg",
      camelCase: false,
      usePlural: true,
      transaction: true,
      schema,
    }),
    advanced: {
      database: {
        generateId: "uuid",
      },
    },
    user: {
      additionalFields: {
        displayName: { type: "string", required: false },
      },
    },
    emailAndPassword: {
      enabled: true,
    },
  });
