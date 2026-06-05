import { createAuthDb } from "@rezics/auth/db/factory";
import { createServerDb } from "@rezics/server/db/factory";

export type AuthDbClient = ReturnType<typeof createAuthDb>;
export type ServerDbClient = ReturnType<typeof createServerDb>;

export function createAuthDbClient(connectionString: string): AuthDbClient {
  return createAuthDb(connectionString);
}

export function createServerDbClient(connectionString: string): ServerDbClient {
  return createServerDb(connectionString);
}
