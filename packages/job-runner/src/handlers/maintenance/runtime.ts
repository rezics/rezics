import { createServerDb } from "@rezics/backend/server/db/factory";
import {
  createServerMaintenanceRepository,
  type ServerMaintenanceRepository,
} from "@rezics/backend/server/db/maintenance.repository";

export interface ServerMaintenanceRuntime {
  maintenance: ServerMaintenanceRepository;
  disconnect(): Promise<void>;
}

export function createServerMaintenanceRuntime(options: {
  serverDatabaseUrl: string;
}): ServerMaintenanceRuntime {
  const serverDb = createServerDb(options.serverDatabaseUrl, 5);

  return {
    maintenance: createServerMaintenanceRepository(serverDb.db),
    disconnect: () => serverDb.disconnect(),
  };
}
