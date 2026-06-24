import type { HistoryOutboxConsumer } from "@rezics/history/outbox";
import type { SearchClient } from "@rezics/search";
import { createHistoryHandlers } from "./history/handlers";
import { createMaintenanceHandlers } from "./maintenance/handlers";
import type { ServerMaintenanceRuntime } from "./maintenance/runtime";
import {
  createRankingHandlers,
  type RankingCommandDispatcher,
} from "./ranking/handlers";
import { createSearchHandlers } from "./search/handlers";

export function createJobHandlers(options: {
  searchClient: SearchClient;
  historyConsumer: HistoryOutboxConsumer;
  serverMaintenanceRuntime?: ServerMaintenanceRuntime;
  rankingDispatcher?: RankingCommandDispatcher;
}) {
  return {
    ...createSearchHandlers(options.searchClient),
    ...createHistoryHandlers(options.historyConsumer),
    ...createMaintenanceHandlers({
      serverMaintenanceRuntime: options.serverMaintenanceRuntime,
    }),
    ...(options.rankingDispatcher
      ? createRankingHandlers(options.rankingDispatcher)
      : {}),
  };
}
