import { drizzle } from "drizzle-orm/node-postgres";

import { env } from "../config";

export const database = drizzle(env.DATABASE_URL);

export type DatabaseTransaction = Parameters<Parameters<typeof database.transaction>[0]>[0];
