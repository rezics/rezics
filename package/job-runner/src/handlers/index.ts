import type { HistoryOutboxConsumer } from "@rezics/history/outbox";
import type { SearchClient } from "@rezics/search";
import type { AdminWorkMergeRuntime } from "./admin-work-merge/runtime";
import { createHistoryHandlers } from "./history/handlers";
import { createMaintenanceHandlers } from "./maintenance/handlers";
import {
  createRankingHandlers,
  type RankingCommandDispatcher,
} from "./ranking/handlers";
import { createSearchHandlers } from "./search/handlers";

export function createJobHandlers(options: {
  searchClient: SearchClient;
  historyConsumer: HistoryOutboxConsumer;
  adminWorkMergeRuntime?: AdminWorkMergeRuntime;
  rankingDispatcher?: RankingCommandDispatcher;
}) {
  return {
    ...createSearchHandlers(options.searchClient),
    ...createHistoryHandlers(options.historyConsumer),
    ...createMaintenanceHandlers({
      adminWorkMergeRuntime: options.adminWorkMergeRuntime,
    }),
    ...(options.rankingDispatcher
      ? createRankingHandlers(options.rankingDispatcher)
      : {}),
  };
}
