import { describe, expect, mock, test } from "bun:test";
import { HistoryOutboxPayloadKind, UnitCommonFieldKey } from "@rezics/contract";
import { RevisionService } from "./revision.service";

function dbStub() {
  const content = new Map<string, unknown>();
  const revisions: any[] = [];
  return {
    revisionContent: {
      upsert: mock(async ({ where, create }: any) => {
        if (!content.has(where.hash)) content.set(where.hash, create.payload);
        return {};
      }),
    },
    unitRevision: {
      upsert: mock(async ({ where, create, include }: any) => {
        const existing = revisions.find(
          (row) =>
            row.unitId === where.unitId_sequence.unitId &&
            row.sequence === where.unitId_sequence.sequence,
        );
        if (existing) return existing;
        const row = {
          id: `revision-${revisions.length + 1}`,
          ...create,
          ingestedAt: new Date("2026-05-19T00:00:00.000Z"),
          content: include?.content
            ? {
                hash: create.contentHash,
                payload: content.get(create.contentHash),
                createdAt: new Date("2026-05-19T00:00:00.000Z"),
              }
            : undefined,
        };
        revisions.push(row);
        return row;
      }),
      findMany: mock(async ({ take }: any) => revisions.slice(0, take)),
      findUnique: mock(
        async ({ where }: any) =>
          revisions.find(
            (row) =>
              row.unitId === where.unitId_sequence.unitId &&
              row.sequence === where.unitId_sequence.sequence,
          ) ?? null,
      ),
    },
    structureEvent: {
      upsert: mock(async () => ({})),
    },
  };
}

describe("RevisionService", () => {
  test("deduplicates duplicate content hashes", async () => {
    const db = dbStub();
    const service = new RevisionService(db as never);

    const payload = {
      unitId: "unit-1",
      sequence: 1,
      actorUserId: "user-1",
      changedFieldKeys: [UnitCommonFieldKey.TITLE],
      slots: { unit: { title: "Same" } },
      message: null,
    };

    await service.insertUnitRevision({ payload, contentHash: "hash-1" });
    await service.insertUnitRevision({
      payload: { ...payload, sequence: 2 },
      contentHash: "hash-1",
    });

    expect(db.revisionContent.upsert).toHaveBeenCalledTimes(2);
    expect(db.unitRevision.upsert).toHaveBeenCalledTimes(2);
  });

  test("single revision read returns content payload", async () => {
    const db = dbStub();
    const service = new RevisionService(db as never);

    await service.insertUnitRevision({
      payload: {
        unitId: "unit-1",
        sequence: 1,
        actorUserId: "user-1",
        changedFieldKeys: [UnitCommonFieldKey.TITLE],
        slots: { unit: { title: "Captured" } },
        message: null,
      },
      contentHash: "hash-1",
      createdAt: new Date("2026-05-19T00:00:00.000Z"),
    });

    const revision = await service.getUnitRevision({
      unitId: "unit-1",
      sequence: 1,
    });

    expect(revision?.content?.payload).toEqual({
      unit: { title: "Captured" },
    });
  });

  test("structure event ingestion is idempotent by unit sequence event type", async () => {
    const db = dbStub();
    const service = new RevisionService(db as never);

    await service.insertStructureEvent({
      payload: {
        unitId: "unit-1",
        sequence: 1,
        actorUserId: "user-1",
        eventType: "book.contentStructure.node.update",
        changedFieldKeys: [UnitCommonFieldKey.TITLE],
        payload: { nodeId: "node-1" },
        message: null,
      },
    });

    expect(db.structureEvent.upsert).toHaveBeenCalledTimes(1);
  });

  test("timeline returns next cursor when extra row exists", async () => {
    const db = dbStub();
    const service = new RevisionService(db as never);

    for (const sequence of [1, 2]) {
      await service.insertUnitRevision({
        payload: {
          unitId: "unit-1",
          sequence,
          actorUserId: "user-1",
          changedFieldKeys: [UnitCommonFieldKey.TITLE],
          slots: { unit: { sequence } },
          message: null,
        },
        contentHash: `hash-${sequence}`,
      });
    }

    const page = await service.listUnitRevisions({
      unitId: "unit-1",
      limit: 1,
    });

    expect(page.revisions).toHaveLength(1);
    expect(page.nextCursor).toBe("revision-2");
  });
});
