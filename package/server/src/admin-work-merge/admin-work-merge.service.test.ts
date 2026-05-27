import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

const enqueueMock = mock(async (_command: any) => ({ status: "created" }));

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: { enqueue: enqueueMock },
}));

installPrismaClientMock();

const unitRows = new Map<string, any>();
let unitWorkRows: any[] = [];
let unitTagRows: any[] = [];
let unitAliasRows: any[] = [];
let operationRows: any[] = [];

function resetState() {
  unitRows.clear();
  unitRows.set("source-work", { id: "source-work" });
  unitRows.set("target-work", { id: "target-work" });
  unitRows.set("release-1", { id: "release-1" });
  unitRows.set("release-2", { id: "release-2" });

  unitWorkRows = [
    {
      unitId: "release-1",
      workUnitId: "source-work",
      role: "RELEASE",
      language: null,
      position: null,
      displayPolicy: "PRIMARY",
    },
    {
      unitId: "shelf-1",
      workUnitId: "source-work",
      role: "SHELF",
      language: null,
      position: null,
      displayPolicy: "PRIMARY",
    },
    {
      unitId: "shelf-1",
      workUnitId: "target-work",
      role: "SHELF",
      language: null,
      position: null,
      displayPolicy: "PRIMARY",
    },
    {
      unitId: "series-1",
      workUnitId: "source-work",
      role: "SERIES",
      language: null,
      position: null,
      displayPolicy: "PRIMARY",
    },
  ];
  unitTagRows = [
    { unitId: "source-work", tagUnitId: "tag-a", score: 4, voteCount: 2 },
    { unitId: "source-work", tagUnitId: "tag-b", score: 3, voteCount: 1 },
    { unitId: "target-work", tagUnitId: "tag-b", score: 1, voteCount: 1 },
  ];
  unitAliasRows = [
    {
      id: "alias-source-a",
      unitId: "source-work",
      value: "Alias A",
      normalizedValue: "alias a",
      language: "en",
      kind: "COMMON",
      status: "ACTIVE",
      score: 2,
      voteCount: 1,
      pinned: false,
      position: null,
    },
    {
      id: "alias-source-b",
      unitId: "source-work",
      value: "Alias B",
      normalizedValue: "alias b",
      language: "en",
      kind: "COMMON",
      status: "ACTIVE",
      score: 1,
      voteCount: 1,
      pinned: false,
      position: null,
    },
    {
      id: "alias-target-b",
      unitId: "target-work",
      value: "Alias B",
      normalizedValue: "alias b",
    },
  ];
  operationRows = [];
  enqueueMock.mockClear();
}

function matchesWhere(row: any, where: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object" && "in" in value) {
      return (value as any).in.includes(row[key]);
    }
    return row[key] === value;
  });
}

function installStatefulPrisma() {
  Object.assign(prismaMock, {
    $transaction: mock(async (fn: (tx: any) => unknown) => fn(prismaMock)),
    unit: {
      findUnique: mock(
        async ({ where }: any) => unitRows.get(where.id) ?? null,
      ),
      findMany: mock(async ({ where }: any) =>
        [...unitRows.values()].filter((row) => matchesWhere(row, where)),
      ),
      updateMany: mock(async ({ where, data }: any) => {
        let count = 0;
        for (const row of unitRows.values()) {
          if (!matchesWhere(row, where)) continue;
          Object.assign(row, data);
          count += 1;
        }
        return { count };
      }),
    },
    unitWork: {
      findMany: mock(async ({ where }: any) =>
        unitWorkRows.filter((row) => matchesWhere(row, where)),
      ),
      findUnique: mock(async ({ where }: any) => {
        const key = where.unitId_workUnitId_role;
        return (
          unitWorkRows.find(
            (row) =>
              row.unitId === key.unitId &&
              row.workUnitId === key.workUnitId &&
              row.role === key.role,
          ) ?? null
        );
      }),
      update: mock(async ({ where, data }: any) => {
        const key = where.unitId_workUnitId_role;
        const row = unitWorkRows.find(
          (item) =>
            item.unitId === key.unitId &&
            item.workUnitId === key.workUnitId &&
            item.role === key.role,
        );
        if (!row) throw new Error("UnitWork not found");
        Object.assign(row, data);
        return row;
      }),
      updateMany: mock(async ({ where, data }: any) => {
        let count = 0;
        for (const row of unitWorkRows) {
          if (!matchesWhere(row, where)) continue;
          Object.assign(row, data);
          count += 1;
        }
        return { count };
      }),
      delete: mock(async ({ where }: any) => {
        const key = where.unitId_workUnitId_role;
        const index = unitWorkRows.findIndex(
          (row) =>
            row.unitId === key.unitId &&
            row.workUnitId === key.workUnitId &&
            row.role === key.role,
        );
        if (index >= 0) unitWorkRows.splice(index, 1);
      }),
      upsert: mock(async ({ where, create }: any) => {
        const key = where.unitId_workUnitId_role;
        const existing = unitWorkRows.find(
          (row) =>
            row.unitId === key.unitId &&
            row.workUnitId === key.workUnitId &&
            row.role === key.role,
        );
        if (existing) return existing;
        unitWorkRows.push(create);
        return create;
      }),
    },
    unitTag: {
      findMany: mock(async ({ where }: any) =>
        unitTagRows.filter((row) => matchesWhere(row, where)),
      ),
      create: mock(async ({ data }: any) => {
        unitTagRows.push(data);
        return data;
      }),
      deleteMany: mock(async ({ where }: any) => {
        const before = unitTagRows.length;
        unitTagRows = unitTagRows.filter((row) => !matchesWhere(row, where));
        return { count: before - unitTagRows.length };
      }),
    },
    unitAlias: {
      findMany: mock(async ({ where }: any) =>
        unitAliasRows.filter((row) => matchesWhere(row, where)),
      ),
      create: mock(async ({ data }: any) => {
        const alias = { id: `created-alias-${unitAliasRows.length}`, ...data };
        unitAliasRows.push(alias);
        return alias;
      }),
      deleteMany: mock(async ({ where }: any) => {
        const before = unitAliasRows.length;
        unitAliasRows = unitAliasRows.filter(
          (row) => !matchesWhere(row, where),
        );
        return { count: before - unitAliasRows.length };
      }),
    },
    adminWorkMergeOperation: {
      create: mock(async ({ data }: any) => {
        const row = {
          id: `operation-${operationRows.length + 1}`,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          movedMemberships: [],
          movedLegacyReleaseUnitIds: [],
          createdTagKeys: [],
          createdAliasIds: [],
          repairUnitIds: [],
          repairCommandCount: 0,
          errorMessage: null,
          revertedAt: null,
          revertedByUserId: null,
          ...data,
        };
        operationRows.push(row);
        return row;
      }),
      update: mock(async ({ where, data }: any) => {
        const row = operationRows.find((item) => item.id === where.id);
        if (!row) throw new Error("operation not found");
        Object.assign(row, data);
        return row;
      }),
      findUniqueOrThrow: mock(async ({ where }: any) => {
        const row = operationRows.find((item) => item.id === where.id);
        if (!row) throw new Error("operation not found");
        return row;
      }),
    },
  });
}

describe("AdminWorkMergeService", () => {
  beforeEach(() => {
    resetState();
    installStatefulPrisma();
  });

  test("previews canonical moves, metadata copy, duplicate suppression, and repair scope", async () => {
    const { adminWorkMergeService } = await import(
      "./admin-work-merge.service"
    );

    const preview = await adminWorkMergeService.preview({
      sourceWorkUnitId: "source-work",
      targetWorkUnitId: "target-work",
    });

    expect(preview.releaseMembershipMoves).toMatchObject([
      { unitId: "release-1", action: "move" },
    ]);
    expect(preview.contentMembershipMoves).toMatchObject([
      { unitId: "shelf-1", role: "SHELF", action: "dedupe" },
      { unitId: "series-1", role: "SERIES", action: "move" },
    ]);
    expect(preview.legacyReleaseUnitIds).toEqual([]);
    expect(preview.metadataCopy.tags).toEqual({
      missing: ["tag-a"],
      duplicates: ["tag-b"],
    });
    expect(preview.metadataCopy.aliases).toEqual({
      missing: ["alias a"],
      duplicates: ["alias b"],
    });
    expect(preview.repairScope.uswnReleaseUnitIds).toEqual(["release-1"]);
  });

  test("starts and reverts a merge without deleting source metadata", async () => {
    const { adminWorkMergeService } = await import(
      "./admin-work-merge.service"
    );

    const queued = await adminWorkMergeService.start(
      {
        sourceWorkUnitId: "source-work",
        targetWorkUnitId: "target-work",
        reason: "duplicate work",
        options: { copyMissingTags: true, copyMissingAliases: true },
      },
      "admin-1",
    );
    expect(queued.status).toBe("QUEUED");

    const operation = await adminWorkMergeService.execute(queued.id);

    expect(operation.status).toBe("COMPLETED");
    expect(operation.createdTagKeys).toEqual(["target-work:tag-a"]);
    expect(operation.createdAliasIds).toEqual(["created-alias-3"]);
    expect(
      unitWorkRows.find(
        (row) => row.unitId === "release-1" && row.workUnitId === "target-work",
      ),
    ).toBeDefined();
    expect(
      unitWorkRows.find(
        (row) => row.unitId === "shelf-1" && row.workUnitId === "source-work",
      ),
    ).toBeUndefined();
    expect(
      unitTagRows.find(
        (row) => row.unitId === "source-work" && row.tagUnitId === "tag-a",
      ),
    ).toBeDefined();
    expect(enqueueMock).toHaveBeenCalled();

    const reverted = await adminWorkMergeService.revert(
      operation.id,
      "admin-2",
    );

    expect(reverted.status).toBe("REVERTED");
    expect(
      unitWorkRows.find(
        (row) => row.unitId === "shelf-1" && row.workUnitId === "source-work",
      ),
    ).toBeDefined();
    expect(
      unitTagRows.find(
        (row) => row.unitId === "target-work" && row.tagUnitId === "tag-a",
      ),
    ).toBeUndefined();
    expect(
      unitAliasRows.find((row) => row.id === "created-alias-3"),
    ).toBeUndefined();
    expect(
      unitTagRows.find(
        (row) => row.unitId === "source-work" && row.tagUnitId === "tag-a",
      ),
    ).toBeDefined();
  });
});
