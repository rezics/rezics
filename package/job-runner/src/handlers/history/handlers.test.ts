import { describe, expect, mock, test } from "bun:test";
import { createHistoryOutboxIngestCommand } from "@rezics/job";
import { createHistoryHandlers } from "./handlers";

describe("history handlers", () => {
  test("ingests the requested outbox row by id", async () => {
    const consumer = {
      consumeOutboxId: mock(async () => ({
        claimed: 1,
        processed: 1,
        failed: 0,
      })),
    };
    const handlers = createHistoryHandlers(consumer as never);
    const command = createHistoryOutboxIngestCommand("outbox-1");

    const result = await handlers[command.kind]?.(command, {
      enqueue: async () => undefined,
    });

    expect(result).toEqual({ claimed: 1, processed: 1, failed: 0 });
    expect(consumer.consumeOutboxId).toHaveBeenCalledWith("outbox-1");
  });
});
