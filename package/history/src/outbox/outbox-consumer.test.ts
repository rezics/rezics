import { describe, expect, mock, test } from "bun:test";
import { HistoryOutboxPayloadKind } from "@rezics/contract";
import { HistoryOutboxConsumer } from "./outbox-consumer";

function outboxRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "outbox-1",
    unitId: "unit-1",
    sequence: 1n,
    actorUserId: "user-1",
    category: HistoryOutboxPayloadKind.EDITORIAL_REVISION,
    payloadHash: "hash-1",
    attempts: 0,
    status: "pending",
    createdAt: new Date("2026-05-19T00:00:00.000Z"),
    payload: {
      kind: HistoryOutboxPayloadKind.EDITORIAL_REVISION,
      revision: {
        unitId: "unit-1",
        sequence: 1,
        actorUserId: "user-1",
        patch: { translations: { en: { title: "Captured" } } },
        message: null,
      },
    },
    ...overrides,
  };
}

function mainDbStub(rows: ReturnType<typeof outboxRow>[]) {
  const byId = new Map(rows.map((row) => [row.id, { ...row }]));
  return {
    historyOutbox: {
      findMany: mock(async ({ where }: any = {}) =>
        [...byId.values()].filter((row: any) => {
          if (where?.id && row.id !== where.id) return false;
          if (where?.status?.in && !where.status.in.includes(row.status)) {
            return false;
          }
          return true;
        }),
      ),
      updateMany: mock(async ({ where, data }: any) => {
        const row = byId.get(where.id);
        if (
          !row ||
          row.attempts !== where.attempts ||
          (where.status?.in && !where.status.in.includes(row.status))
        ) {
          return { count: 0 };
        }
        Object.assign(row, {
          ...data,
          attempts:
            typeof data.attempts === "object"
              ? row.attempts + data.attempts.increment
              : row.attempts,
        });
        return { count: 1 };
      }),
      update: mock(async ({ where, data }: any) => {
        const row = byId.get(where.id);
        if (!row) throw new Error("missing outbox row");
        Object.assign(row, data);
        return row;
      }),
    },
  };
}

function historyDbStub() {
  return {
    outboxProcessingFailure: {
      upsert: mock(async () => ({})),
    },
  };
}

describe("HistoryOutboxConsumer", () => {
  test("claims pending rows and inserts editorial revisions idempotently", async () => {
    const mainDb = mainDbStub([outboxRow()]);
    const historyDb = historyDbStub();
    const revisions = {
      insertUnitRevision: mock(async () => ({})),
      insertStructureEvent: mock(async () => ({})),
    };
    const consumer = new HistoryOutboxConsumer(
      mainDb as never,
      historyDb as never,
      revisions as never,
    );

    const result = await consumer.consumeBatch();

    expect(result).toEqual({ claimed: 1, processed: 1, failed: 0 });
    expect(revisions.insertUnitRevision).toHaveBeenCalledWith({
      payload: (outboxRow().payload as any).revision,
      contentHash: "hash-1",
      createdAt: new Date("2026-05-19T00:00:00.000Z"),
    });
    expect(mainDb.historyOutbox.update).toHaveBeenLastCalledWith({
      where: { id: "outbox-1" },
      data: {
        status: "processed",
        processedAt: expect.any(Date),
        nextAttemptAt: null,
        lastError: null,
      },
    });
  });

  test("records retry metadata when processing fails", async () => {
    const mainDb = mainDbStub([outboxRow()]);
    const historyDb = historyDbStub();
    const revisions = {
      insertUnitRevision: mock(async () => {
        throw new Error("history db unavailable");
      }),
      insertStructureEvent: mock(async () => ({})),
    };
    const consumer = new HistoryOutboxConsumer(
      mainDb as never,
      historyDb as never,
      revisions as never,
    );

    const result = await consumer.consumeBatch({
      now: new Date("2026-05-19T00:00:00.000Z"),
    });

    expect(result).toEqual({ claimed: 1, processed: 0, failed: 1 });
    expect(historyDb.outboxProcessingFailure.upsert).toHaveBeenCalledWith({
      where: { outboxId: "outbox-1" },
      update: {
        attempts: 1,
        lastError: "history db unavailable",
        retryAfter: new Date("2026-05-19T00:00:30.000Z"),
      },
      create: {
        outboxId: "outbox-1",
        attempts: 1,
        lastError: "history db unavailable",
        retryAfter: new Date("2026-05-19T00:00:30.000Z"),
      },
    });
  });

  test("routes structure event payloads to structure event storage", async () => {
    const payload = {
      kind: HistoryOutboxPayloadKind.STRUCTURE_EVENT,
      event: {
        unitId: "unit-1",
        sequence: 2,
        actorUserId: "user-1",
        eventType: "book.contentStructure.node.update",
        changedFieldKeys: ["translations.en.title"],
        payload: { nodeId: "node-1", title: "Captured" },
        message: null,
      },
    };
    const mainDb = mainDbStub([
      outboxRow({
        id: "outbox-2",
        sequence: 2n,
        category: HistoryOutboxPayloadKind.STRUCTURE_EVENT,
        payload,
      }),
    ]);
    const historyDb = historyDbStub();
    const revisions = {
      insertUnitRevision: mock(async () => ({})),
      insertStructureEvent: mock(async () => ({})),
    };
    const consumer = new HistoryOutboxConsumer(
      mainDb as never,
      historyDb as never,
      revisions as never,
    );

    const result = await consumer.consumeBatch();

    expect(result.processed).toBe(1);
    expect(revisions.insertStructureEvent).toHaveBeenCalledWith({
      payload: payload.event,
      createdAt: new Date("2026-05-19T00:00:00.000Z"),
    });
    expect(revisions.insertUnitRevision).not.toHaveBeenCalled();
  });

  test("can consume one explicit outbox id", async () => {
    const mainDb = mainDbStub([outboxRow({ id: "outbox-2" })]);
    const historyDb = historyDbStub();
    const revisions = {
      insertUnitRevision: mock(async () => ({})),
      insertStructureEvent: mock(async () => ({})),
    };
    const consumer = new HistoryOutboxConsumer(
      mainDb as never,
      historyDb as never,
      revisions as never,
    );

    const result = await consumer.consumeOutboxId("outbox-2");

    expect(result).toEqual({ claimed: 1, processed: 1, failed: 0 });
    expect(mainDb.historyOutbox.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "outbox-2" }),
      }),
    );
  });

  test("duplicate explicit ingest converges after row is processed", async () => {
    const mainDb = mainDbStub([outboxRow()]);
    const historyDb = historyDbStub();
    const revisions = {
      insertUnitRevision: mock(async () => ({})),
      insertStructureEvent: mock(async () => ({})),
    };
    const consumer = new HistoryOutboxConsumer(
      mainDb as never,
      historyDb as never,
      revisions as never,
    );

    expect(await consumer.consumeOutboxId("outbox-1")).toEqual({
      claimed: 1,
      processed: 1,
      failed: 0,
    });
    expect(await consumer.consumeOutboxId("outbox-1")).toEqual({
      claimed: 0,
      processed: 0,
      failed: 0,
    });
    expect(revisions.insertUnitRevision).toHaveBeenCalledTimes(1);
  });

  test("missing explicit outbox id is a no-op", async () => {
    const consumer = new HistoryOutboxConsumer(
      mainDbStub([]) as never,
      historyDbStub() as never,
      {
        insertUnitRevision: mock(async () => ({})),
        insertStructureEvent: mock(async () => ({})),
      } as never,
    );

    expect(await consumer.consumeOutboxId("missing")).toEqual({
      claimed: 0,
      processed: 0,
      failed: 0,
    });
  });
});
