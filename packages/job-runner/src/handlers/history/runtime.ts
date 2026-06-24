import { HistoryOutboxConsumer } from "@rezics/backend/history/outbox";
import { createServerDb } from "@rezics/server/db/factory";
import { createServerHistoryOutboxRepository } from "@rezics/server/db/history-outbox.repository";

export interface HistoryRuntime {
  consumer: HistoryOutboxConsumer;
  disconnect(): Promise<void>;
}

export async function createHistoryRuntime(options: {
  serverDatabaseUrl: string;
  historyDatabaseUrl: string;
}): Promise<HistoryRuntime> {
  process.env.HISTORY_DATABASE_URL ??= options.historyDatabaseUrl;
  const [{ historyRepository }, { revisionService }] = await Promise.all([
    import("@rezics/backend/history/db"),
    import("@rezics/backend/history/revision/revision.service"),
  ]);
  const mainDb = createServerDb(options.serverDatabaseUrl, 10);
  const mainOutbox = createServerHistoryOutboxRepository(mainDb.db);

  return {
    consumer: new HistoryOutboxConsumer(
      mainOutbox as never,
      historyRepository as never,
      revisionService,
    ),
    disconnect: async () => {
      await mainDb.disconnect();
    },
  };
}
