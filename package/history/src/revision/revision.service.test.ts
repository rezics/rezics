import { describe, expect, mock, test } from "bun:test";
import {
  RevisionService,
  computeRevisionContentHash,
} from "./revision.service";

function dbStub() {
  const content = new Map<string, unknown>();
  const revisions: any[] = [];
  const structureEvents: any[] = [];
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
      upsert: mock(async ({ where, create }: any) => {
        const existing = structureEvents.find(
          (row) =>
            row.unitId === where.unitId_sequence_eventType.unitId &&
            row.sequence === where.unitId_sequence_eventType.sequence &&
            row.eventType === where.unitId_sequence_eventType.eventType,
        );
        if (existing) return existing;
        const row = {
          id: `event-${structureEvents.length + 1}`,
          ...create,
          ingestedAt: new Date("2026-05-19T00:00:00.000Z"),
        };
        structureEvents.push(row);
        return row;
      }),
      findMany: mock(async ({ take }: any) => structureEvents.slice(0, take)),
      findUnique: mock(
        async ({ where }: any) =>
          structureEvents.find(
            (row) =>
              row.unitId === where.unitId_sequence_eventType.unitId &&
              row.sequence === where.unitId_sequence_eventType.sequence &&
              row.eventType === where.unitId_sequence_eventType.eventType,
          ) ?? null,
      ),
    },
  };
}

describe("RevisionService", () => {
  test("computes canonical content hash from revision patch", async () => {
    const db = dbStub();
    const service = new RevisionService(db as never);
    const payload = {
      unitId: "unit-1",
      sequence: 1,
      actorUserId: "user-1",
      patch: { translations: { en: { title: "Canonical" } } },
      message: null,
    };
    const contentHash = computeRevisionContentHash(payload.patch);

    const revision = await service.insertUnitRevision({
      payload,
      contentHash: "metadata-derived-old-hash",
    });

    expect(revision.contentHash).toBe(contentHash);
    expect(db.revisionContent.upsert).toHaveBeenCalledWith({
      where: { hash: contentHash },
      update: {},
      create: { hash: contentHash, payload: payload.patch },
    });
  });

  test("deduplicates duplicate canonical content hashes", async () => {
    const db = dbStub();
    const service = new RevisionService(db as never);

    const payload = {
      unitId: "unit-1",
      sequence: 1,
      actorUserId: "user-1",
      patch: { translations: { en: { title: "Same" } } },
      message: null,
    };

    const contentHash = computeRevisionContentHash(payload.patch);

    await service.insertUnitRevision({ payload, contentHash: "wrong-1" });
    await service.insertUnitRevision({
      payload: { ...payload, sequence: 2, actorUserId: "user-2" },
      contentHash: "wrong-2",
    });

    expect(db.revisionContent.upsert).toHaveBeenCalledTimes(2);
    expect(db.unitRevision.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        create: expect.objectContaining({ contentHash }),
      }),
    );
    expect(db.unitRevision.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        create: expect.objectContaining({ contentHash }),
      }),
    );
    expect(db.unitRevision.upsert).toHaveBeenCalledTimes(2);
  });

  test("duplicate unit sequence ingestion is idempotent", async () => {
    const db = dbStub();
    const service = new RevisionService(db as never);
    const payload = {
      unitId: "unit-1",
      sequence: 1,
      actorUserId: "user-1",
      patch: { translations: { en: { title: "Captured" } } },
      message: null,
    };

    const first = await service.insertUnitRevision({
      payload,
      contentHash: "hash-1",
    });
    const retry = await service.insertUnitRevision({
      payload,
      contentHash: "hash-1",
    });

    expect(retry.id).toBe(first.id);
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
        patch: { translations: { en: { title: "Captured" } } },
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
      translations: { en: { title: "Captured" } },
    });
  });

  test("stores restore source metadata separately from content payload", async () => {
    const db = dbStub();
    const service = new RevisionService(db as never);
    const patch = { post: { body: "Restored" } };
    const contentHash = computeRevisionContentHash(patch);

    const revision = await service.insertUnitRevision({
      payload: {
        unitId: "unit-1",
        sequence: 12,
        actorUserId: "user-1",
        patch,
        message: "restore",
        restoreSource: {
          kind: "revision",
          unitId: "unit-1",
          sequence: 7,
          paths: ["post.body"],
        },
      },
    });

    expect(revision.contentHash).toBe(contentHash);
    expect(revision.restoreSource).toEqual({
      kind: "revision",
      unitId: "unit-1",
      sequence: 7,
      paths: ["post.body"],
    });
    expect(revision.content?.payload).toEqual(patch);
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
        changedFieldKeys: ["translations.en.title"],
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
          patch: { translations: { en: { sequence } } },
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
    expect(page.revisions[0]?.content).toBeUndefined();
  });

  test("timeline can include content when raw payload access is requested", async () => {
    const db = dbStub();
    const service = new RevisionService(db as never);

    await service.insertUnitRevision({
      payload: {
        unitId: "unit-1",
        sequence: 1,
        actorUserId: "user-1",
        patch: { translations: { en: { title: "Visible" } } },
        message: null,
      },
      contentHash: "hash-1",
    });

    const page = await service.listUnitRevisions({
      unitId: "unit-1",
      includeContent: true,
    });

    expect(page.revisions[0]?.content?.payload).toEqual({
      translations: { en: { title: "Visible" } },
    });
  });

  test("lists and reads structure events", async () => {
    const db = dbStub();
    const service = new RevisionService(db as never);

    await service.insertStructureEvent({
      payload: {
        unitId: "unit-1",
        sequence: 1,
        actorUserId: "user-1",
        eventType: "book.contentStructure.batch",
        changedFieldKeys: ["book.contentStructure"],
        payload: {
          operations: [
            {
              op: "node.update",
              nodeId: "node-1",
              before: { title: "Before" },
              after: { title: "Captured" },
            },
          ],
        },
        message: null,
      },
      createdAt: new Date("2026-05-19T00:00:00.000Z"),
    });

    const page = await service.listStructureEvents({
      unitId: "unit-1",
      limit: 10,
    });
    const event = await service.getStructureEvent({
      unitId: "unit-1",
      sequence: 1,
      eventType: "book.contentStructure.batch",
    });

    expect(page.events).toHaveLength(1);
    expect(page.events[0]?.payload).toBeUndefined();
    expect(event?.payload).toEqual({
      operations: [
        {
          op: "node.update",
          nodeId: "node-1",
          before: { title: "Before" },
          after: { title: "Captured" },
        },
      ],
    });
  });
});
