import type { HistoryOutboxConsumer } from "@rezics/backend/history/outbox";
import {
  type AnyJobCommand,
  HISTORY_COMMAND_KINDS,
  type HistoryCommand,
} from "@rezics/contract/job";
import type { JobHandler } from "../../worker";

export function createHistoryHandlers(consumer: HistoryOutboxConsumer) {
  return {
    [HISTORY_COMMAND_KINDS.outboxIngest]: async (command) => {
      const historyCommand = command as HistoryCommand;
      if (historyCommand.kind !== HISTORY_COMMAND_KINDS.outboxIngest) {
        throw new Error(
          `Unexpected history command kind: ${historyCommand.kind}`,
        );
      }
      return consumer.consumeOutboxId(historyCommand.payload.outboxId);
    },
    [HISTORY_COMMAND_KINDS.outboxIngestBatch]: async (command) => {
      const historyCommand = command as HistoryCommand;
      if (historyCommand.kind !== HISTORY_COMMAND_KINDS.outboxIngestBatch) {
        throw new Error(
          `Unexpected history command kind: ${historyCommand.kind}`,
        );
      }
      // Job-runner is the only runtime owner of HistoryOutbox ingestion; batch
      // ingest recovers retry-ready rows when CDC did not deliver explicit jobs.
      return consumer.consumeBatch({
        batchSize: historyCommand.payload.batchSize,
      });
    },
  } satisfies Partial<Record<AnyJobCommand["kind"], JobHandler>>;
}
