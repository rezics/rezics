import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { instrumentPostgresClient } from "@rezics/observability";

import { env } from "../config";

const databaseClient = instrumentPostgresClient(new Pool({ connectionString: env.DATABASE_URL }));

export const database = drizzle({ client: databaseClient });

export type DatabaseTransaction = Parameters<Parameters<typeof database.transaction>[0]>[0];
export type DatabaseExecutor = typeof database | DatabaseTransaction;
