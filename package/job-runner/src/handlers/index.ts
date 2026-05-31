import type { HistoryOutboxConsumer } from "@rezics/history/outbox";
import type { SearchClient } from "@rezics/search";
import { createHistoryHandlers } from "./history/handlers";
import { createMaintenanceHandlers } from "./maintenance/handlers";
import type { ServerPrismaRuntime } from "./maintenance/runtime";
import {
  createRankingHandlers,
  type RankingCommandDispatcher,
} from "./ranking/handlers";
import { createSearchHandlers } from "./search/handlers";

export function createJobHandlers(options: {
  searchClient: SearchClient;
  historyConsumer: HistoryOutboxConsumer;
  serverPrismaRuntime?: ServerPrismaRuntime;
  rankingDispatcher?: RankingCommandDispatcher;
}) {
  return {
    ...createSearchHandlers(options.searchClient),
    ...createHistoryHandlers(options.historyConsumer),
    ...createMaintenanceHandlers({
      serverPrismaRuntime: options.serverPrismaRuntime,
    }),
    ...(options.rankingDispatcher
      ? createRankingHandlers(options.rankingDispatcher)
      : {}),
  };
}
