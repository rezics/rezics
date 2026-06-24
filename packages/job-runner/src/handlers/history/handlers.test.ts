import { describe, expect, mock, test } from "bun:test";
import {
  createHistoryOutboxIngestBatchCommand,
  createHistoryOutboxIngestCommand,
} from "@rezics/job";
import { createHistoryHandlers } from "./handlers";

describe("history handlers", () => {
  test("ingests the requested outbox row by id", async () => {
    const consumer = {
      consumeOutboxId: mock(async () => ({
        claimed: 1,
        processed: 1,
        failed: 0,
      })),
      consumeBatch: mock(async () => ({
        claimed: 0,
        processed: 0,
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

  test("ingests retry-ready pending outbox rows in batches", async () => {
    const consumer = {
      consumeOutboxId: mock(async () => ({
        claimed: 0,
        processed: 0,
        failed: 0,
      })),
      consumeBatch: mock(async () => ({
        claimed: 2,
        processed: 2,
        failed: 0,
      })),
    };
    const handlers = createHistoryHandlers(consumer as never);
    const command = createHistoryOutboxIngestBatchCommand({ batchSize: 50 });

    const result = await handlers[command.kind]?.(command, {
      enqueue: async () => undefined,
    });

    expect(result).toEqual({ claimed: 2, processed: 2, failed: 0 });
    expect(consumer.consumeBatch).toHaveBeenCalledWith({ batchSize: 50 });
  });
});
