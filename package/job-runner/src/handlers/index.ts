import type { SearchClient } from "@rezics/search";
import type { HistoryOutboxConsumer } from "@rezics/history/outbox";
import { createHistoryHandlers } from "./history/handlers";
import { createMaintenanceHandlers } from "./maintenance/handlers";
import { createSearchHandlers } from "./search/handlers";

export function createJobHandlers(options: {
  searchClient: SearchClient;
  historyConsumer: HistoryOutboxConsumer;
}) {
  return {
    ...createSearchHandlers(options.searchClient),
    ...createHistoryHandlers(options.historyConsumer),
    ...createMaintenanceHandlers(),
  };
}
