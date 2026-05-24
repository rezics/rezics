import { describe, expect, mock, test } from "bun:test";
import {
  singleUnitRevisionResponseSchema,
  unitRevisionTimelinePageSchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import {
  RevisionService,
  computeRevisionContentHash,
} from "./revision.service";

async function responseValidationStatus(
  schema: unknown,
  payload: unknown,
): Promise<number> {
  const app = new Elysia().get("/validate", () => payload, {
    response: schema as never,
  });
  const response = await app.handle(new Request("http://localhost/validate"));
  return response.status;
}

function dbStub() {
  const content = new Map<string, unknown>();
  const revisions: any[] = [];
  const revisionPaths: any[] = [];
  const structureEvents: any[] = [];
  const withRevisionIncludes = (row: any, include?: any) => ({
    ...row,
    content: include?.content
      ? {
          hash: row.contentHash,
          payload: content.get(row.contentHash),
          createdAt: new Date("2026-05-19T00:00:00.000Z"),
        }
      : undefined,
    paths: include?.paths
      ? revisionPaths
          .filter(
            (path) =>
              path.unitId === row.unitId && path.sequence === row.sequence,
          )
          .map((path) => ({ path: path.path }))
      : undefined,
  });
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
        if (existing) return withRevisionIncludes(existing, include);
        const row = {
          id: `revision-${revisions.length + 1}`,
          ...create,
          ingestedAt: new Date("2026-05-19T00:00:00.000Z"),
        };
        revisions.push(row);
        return withRevisionIncludes(row, include);
      }),
      findMany: mock(async ({ where, take, include, orderBy }: any = {}) => {
        let rows = [...revisions];
        if (where?.unitId) {
          rows = rows.filter((row) => row.unitId === where.unitId);
        }
        if (Array.isArray(orderBy)) {
          rows.sort((a, b) => {
            for (const order of orderBy) {
              const [key, direction] = Object.entries(order)[0] as [
                string,
                "asc" | "desc",
              ];
              const delta = String(a[key]).localeCompare(String(b[key]));
              if (delta !== 0) return direction === "desc" ? -delta : delta;
            }
            return 0;
          });
        } else if (orderBy?.sequence === "desc") {
          rows.sort((a, b) => Number(b.sequence - a.sequence));
        }
        return rows
          .slice(0, take ?? rows.length)
          .map((row) => withRevisionIncludes(row, include));
      }),
      findUnique: mock(async ({ where, include }: any) => {
        const row =
          revisions.find(
            (row) =>
              row.unitId === where.unitId_sequence.unitId &&
              row.sequence === where.unitId_sequence.sequence,
          ) ?? null;
        return row ? withRevisionIncludes(row, include) : null;
      }),
    },
    unitRevisionPath: {
      upsert: mock(async ({ where, create, update }: any) => {
        const existing = revisionPaths.find(
          (row) =>
            row.unitId === where.unitId_sequence_path.unitId &&
            row.sequence === where.unitId_sequence_path.sequence &&
            row.path === where.unitId_sequence_path.path,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        revisionPaths.push(create);
        return create;
      }),
      findMany: mock(async ({ where, distinct, select, orderBy }: any = {}) => {
        let rows = revisionPaths.filter((row) => row.unitId === where?.unitId);
        if (where?.sequence?.gt !== undefined) {
          rows = rows.filter((row) => row.sequence > where.sequence.gt);
        }
        if (where?.sequence?.lte !== undefined) {
          rows = rows.filter((row) => row.sequence <= where.sequence.lte);
        }
        if (where?.path?.in) {
          const wanted = new Set(where.path.in);
          rows = rows.filter((row) => wanted.has(row.path));
        }
        if (Array.isArray(orderBy)) {
          rows.sort((a, b) => {
            for (const order of orderBy) {
              const [key, direction] = Object.entries(order)[0] as [
                string,
                "asc" | "desc",
              ];
              const left = key === "sequence" ? Number(a[key]) : String(a[key]);
              const right =
                key === "sequence" ? Number(b[key]) : String(b[key]);
              const delta =
                typeof left === "number" && typeof right === "number"
                  ? left - right
                  : String(left).localeCompare(String(right));
              if (delta !== 0) return direction === "desc" ? -delta : delta;
            }
            return 0;
          });
        } else if (orderBy?.path === "asc") {
          rows.sort((a, b) => a.path.localeCompare(b.path));
        }
        if (distinct?.includes("path")) {
          const seen = new Set<string>();
          rows = rows.filter((row) => {
            if (seen.has(row.path)) return false;
            seen.add(row.path);
            return true;
          });
        }
        if (select?.path) return rows.map((row) => ({ path: row.path }));
        return rows;
      }),
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
    expect(db.unitRevisionPath.upsert).toHaveBeenCalledTimes(2);
  });

  test("indexes revision leaf paths and derives changed keys from the index", async () => {
    const db = dbStub();
    const service = new RevisionService(db as never);

    await service.insertUnitRevision({
      payload: {
        unitId: "unit-1",
        sequence: 1,
        actorUserId: "user-1",
        patch: {
          translations: { en: { title: "Captured" } },
          credits: { authors: [{ targetUnitId: "ent-1" }] },
        },
        message: null,
      },
    });

    const revision = await service.getUnitRevision({
      unitId: "unit-1",
      sequence: 1,
      includeContent: false,
    });

    expect(revision?.changedFieldKeys).toEqual([
      "credits.authors",
      "translations.en.title",
    ]);
  });

  test("projects legacy slots-shaped revisions into the path index", async () => {
    const db = dbStub();
    const service = new RevisionService(db as never);

    await service.insertUnitRevision({
      payload: {
        unitId: "unit-1",
        sequence: 1,
        actorUserId: "user-1",
        slots: {
          identity: { title: "Legacy title" },
          tags: [{ tagUnitId: "tag-1" }],
        },
        changedFieldKeys: ["identity.title", "tags"],
        message: null,
      },
    });

    const revision = await service.getUnitRevision({
      unitId: "unit-1",
      sequence: 1,
      includeContent: false,
    });

    expect(revision?.changedFieldKeys).toEqual(["identity.title", "tags"]);
  });

  test("backfills existing revisions into the path index", async () => {
    const db = dbStub();
    const service = new RevisionService(db as never);

    await service.insertUnitRevision({
      payload: {
        unitId: "unit-1",
        sequence: 1,
        actorUserId: "user-1",
        patch: { translations: { en: { title: "Indexed" } } },
        message: null,
      },
    });

    const result = await service.backfillRevisionPaths();

    expect(result).toEqual({ revisions: 1, paths: 1 });
    expect(db.unitRevisionPath.upsert).toHaveBeenCalledTimes(2);
  });

  test("path snapshot compare handles non-adjacent and additive changes", async () => {
    const db = dbStub();
    const service = new RevisionService(db as never);

    await service.insertUnitRevision({
      payload: {
        unitId: "unit-1",
        sequence: 1,
        actorUserId: "user-1",
        patch: { translations: { en: { title: "A" } } },
        message: null,
      },
    });
    await service.insertUnitRevision({
      payload: {
        unitId: "unit-1",
        sequence: 2,
        actorUserId: "user-1",
        patch: { translations: { en: { summary: "S2" } } },
        message: null,
      },
    });
    await service.insertUnitRevision({
      payload: {
        unitId: "unit-1",
        sequence: 3,
        actorUserId: "user-1",
        patch: { translations: { en: { title: "B" } } },
        message: null,
      },
    });

    const compare = await service.compareRevisionPaths({
      unitId: "unit-1",
      baseSequence: 1,
      targetSequence: 3,
    });

    expect(compare.candidatePaths).toEqual([
      "translations.en.summary",
      "translations.en.title",
    ]);
    expect(compare.changes).toEqual([
      {
        path: "translations.en.summary",
        base: { value: null, sequence: null },
        target: { value: "S2", sequence: 2 },
      },
      {
        path: "translations.en.title",
        base: { value: "A", sequence: 1 },
        target: { value: "B", sequence: 3 },
      },
    ]);
  });

  test("same revision path snapshot compare returns no changes", async () => {
    const db = dbStub();
    const service = new RevisionService(db as never);

    const compare = await service.compareRevisionPaths({
      unitId: "unit-1",
      baseSequence: 2,
      targetSequence: 2,
    });

    expect(compare).toMatchObject({
      candidatePaths: [],
      changes: [],
    });
  });

  test("path snapshot compare stays sub-50ms for thousands of revisions", async () => {
    const db = dbStub();
    const service = new RevisionService(db as never);

    for (let sequence = 1; sequence <= 3000; sequence += 1) {
      await service.insertUnitRevision({
        payload: {
          unitId: "unit-1",
          sequence,
          actorUserId: "user-1",
          patch: {
            translations: {
              en: { [sequence % 2 === 0 ? "summary" : "title"]: sequence },
            },
          },
          message: null,
        },
      });
    }

    const startedAt = performance.now();
    const compare = await service.compareRevisionPaths({
      unitId: "unit-1",
      baseSequence: 1,
      targetSequence: 3000,
    });
    const durationMs = performance.now() - startedAt;

    expect(compare.changes.map((change) => change.path).sort()).toEqual([
      "translations.en.summary",
      "translations.en.title",
    ]);
    expect(durationMs).toBeLessThan(50);
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
    const patch = { post: { content: { main: { source: "Restored" } } } };
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
          paths: ["post.content.main.source"],
        },
      },
    });

    expect(revision.contentHash).toBe(contentHash);
    expect(revision.restoreSource).toEqual({
      kind: "revision",
      unitId: "unit-1",
      sequence: 7,
      paths: ["post.content.main.source"],
    });
    expect(revision.content?.payload).toEqual(patch);
  });

  test("omits null and empty restore source metadata from revision responses", async () => {
    const db = dbStub();
    const service = new RevisionService(db as never);

    await service.insertUnitRevision({
      payload: {
        unitId: "unit-1",
        sequence: 1,
        actorUserId: "user-1",
        patch: { translations: { en: { title: "Null source" } } },
        message: null,
        restoreSource: null,
      } as never,
    });
    await service.insertUnitRevision({
      payload: {
        unitId: "unit-1",
        sequence: 2,
        actorUserId: "user-1",
        patch: { translations: { en: { title: "Empty source" } } },
        message: null,
        restoreSource: {},
      } as never,
    });

    const page = await service.listUnitRevisions({
      unitId: "unit-1",
      limit: 2,
    });
    const revision = await service.getUnitRevision({
      unitId: "unit-1",
      sequence: 1,
    });

    expect(page.revisions).toHaveLength(2);
    expect(page.revisions.every((item) => !("restoreSource" in item))).toBe(
      true,
    );
    expect(revision && "restoreSource" in revision).toBe(false);
    expect(
      await responseValidationStatus(unitRevisionTimelinePageSchema, page),
    ).toBe(200);
  });

  test("omits malformed restore source metadata from revision responses", async () => {
    const db = dbStub();
    const service = new RevisionService(db as never);

    await service.insertUnitRevision({
      payload: {
        unitId: "unit-1",
        sequence: 1,
        actorUserId: "user-1",
        patch: { translations: { en: { title: "Missing kind" } } },
        message: null,
        restoreSource: {
          unitId: "unit-1",
          sequence: 7,
          paths: ["translations.en.title"],
        },
      } as never,
    });
    await service.insertUnitRevision({
      payload: {
        unitId: "unit-1",
        sequence: 2,
        actorUserId: "user-1",
        patch: { translations: { en: { title: "Bad paths" } } },
        message: null,
        restoreSource: {
          kind: "revision",
          unitId: "unit-1",
          sequence: 7,
          paths: ["translations.en.title", 2],
        },
      } as never,
    });

    const page = await service.listUnitRevisions({
      unitId: "unit-1",
      limit: 2,
    });
    const revision = await service.getUnitRevision({
      unitId: "unit-1",
      sequence: 2,
    });

    expect(page.revisions.every((item) => !("restoreSource" in item))).toBe(
      true,
    );
    expect(revision && "restoreSource" in revision).toBe(false);
    expect(
      await responseValidationStatus(unitRevisionTimelinePageSchema, page),
    ).toBe(200);
    expect(
      await responseValidationStatus(singleUnitRevisionResponseSchema, {
        revision,
      }),
    ).toBe(200);
  });

  test("preserves valid restore source metadata in revision responses", async () => {
    const db = dbStub();
    const service = new RevisionService(db as never);
    const restoreSource = {
      kind: "revision" as const,
      unitId: "unit-1",
      sequence: 7,
      paths: ["translations.en.title"],
    };

    await service.insertUnitRevision({
      payload: {
        unitId: "unit-1",
        sequence: 8,
        actorUserId: "user-1",
        patch: { translations: { en: { title: "Restored" } } },
        message: null,
        restoreSource,
      },
    });

    const revision = await service.getUnitRevision({
      unitId: "unit-1",
      sequence: 8,
    });

    expect(revision?.restoreSource).toEqual(restoreSource);
    expect(
      await responseValidationStatus(singleUnitRevisionResponseSchema, {
        revision,
      }),
    ).toBe(200);
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
    expect(page.revisions[0]?.sequence).toBe(2);
    expect(page.nextCursor).toBe("revision-1");
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
