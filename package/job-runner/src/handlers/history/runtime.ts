import { PrismaPg } from "@prisma/adapter-pg";
import { HistoryOutboxConsumer } from "@rezics/history/outbox";
import { PrismaClient as HistoryPrismaClient } from "@rezics/history/prisma/generated/client";
import { RevisionService } from "@rezics/history/revision/revision.service";
import { PrismaClient as MainPrismaClient } from "@rezics/server/prisma/generated/client";

export interface HistoryRuntime {
  consumer: HistoryOutboxConsumer;
  disconnect(): Promise<void>;
}

export function createHistoryRuntime(options: {
  serverDatabaseUrl: string;
  historyDatabaseUrl: string;
}): HistoryRuntime {
  const mainPrisma = new MainPrismaClient({
    adapter: new PrismaPg({
      connectionString: options.serverDatabaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 2_000,
    }),
  });
  const historyPrisma = new HistoryPrismaClient({
    adapter: new PrismaPg({
      connectionString: options.historyDatabaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 2_000,
    }),
  });

  return {
    consumer: new HistoryOutboxConsumer(
      mainPrisma as never,
      historyPrisma as never,
      new RevisionService(historyPrisma as never),
    ),
    disconnect: async () => {
      await Promise.all([
        mainPrisma.$disconnect(),
        historyPrisma.$disconnect(),
      ]);
    },
  };
}
