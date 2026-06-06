import type { HistoryOutboxConsumer } from "@rezics/history/outbox";
import {
  type AnyJobCommand,
  HISTORY_COMMAND_KINDS,
  type HistoryCommand,
} from "@rezics/job";
import type { JobHandler } from "../../worker";

export function createHistoryHandlers(consumer: HistoryOutboxConsumer) {
  return {
    [HISTORY_COMMAND_KINDS.outboxIngest]: async (command) => {
      const historyCommand = command as HistoryCommand;
      return consumer.consumeOutboxId(historyCommand.payload.outboxId);
    },
  } satisfies Partial<Record<AnyJobCommand["kind"], JobHandler>>;
}
