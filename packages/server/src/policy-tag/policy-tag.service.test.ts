import { beforeEach, describe, expect, mock, test } from "bun:test";

const now = new Date("2026-06-17T00:00:00.000Z");

const activeRuleRow = {
  id: "rule-1",
  scopeKind: "realm",
  realmUnitId: "realm-1",
  tagUnitId: "tag-1",
  state: "ACTIVE",
  createdByUserId: "manager-1",
  updatedByUserId: "manager-1",
  reason: "curated",
  createdAt: now,
  updatedAt: now,
};

const archivedRuleRow = {
  ...activeRuleRow,
  id: "rule-archived",
  state: "ARCHIVED",
};

const applicationRow = {
  id: "application-1",
  ruleId: "rule-1",
  unitId: "unit-1",
  position: "a",
  metadata: { source: "curated" },
  appliedByUserId: "manager-1",
  updatedByUserId: "manager-1",
  createdAt: now,
  updatedAt: now,
};

let selectResults: unknown[][] = [];
let insertResults: unknown[][] = [];
let updateResults: unknown[][] = [];
let deleteResults: unknown[][] = [];

const insertCalls: Array<{
  table: unknown;
  values?: Record<string, unknown>;
  conflict?: unknown;
}> = [];
const updateCalls: Array<{
  table: unknown;
  set?: Record<string, unknown>;
}> = [];
const deleteCalls: Array<{ table: unknown }> = [];
const selectCalls: Array<{
  selection?: unknown;
  table?: unknown;
  orderByCount: number;
  limit?: number;
  offset?: number;
}> = [];

function queueSelect(...results: unknown[][]) {
  selectResults = [...results];
}

function queueInsert(...results: unknown[][]) {
  insertResults = [...results];
}

function queueDelete(...results: unknown[][]) {
  deleteResults = [...results];
}

function createSelect(selection?: unknown) {
  const call = { selection, orderByCount: 0 } as {
    selection?: unknown;
    table?: unknown;
    orderByCount: number;
    limit?: number;
    offset?: number;
  };
  selectCalls.push(call);
  const query = {
    from: mock((table: unknown) => {
      call.table = table;
      return query;
    }),
    innerJoin: mock(() => query),
    where: mock(() => query),
    orderBy: mock((..._columns: unknown[]) => {
      call.orderByCount += _columns.length;
      return query;
    }),
    limit: mock((limit: number) => {
      call.limit = limit;
      return query;
    }),
    offset: mock((offset: number) => {
      call.offset = offset;
      return query;
    }),
    async resolve() {
      return selectResults.shift() ?? [];
    },
    // biome-ignore lint/suspicious/noThenProperty: Drizzle test double must be awaitable.
    then(
      resolve: (value: unknown[]) => unknown,
      reject?: (error: unknown) => unknown,
    ) {
      return query.resolve().then(resolve, reject);
    },
  };
  return query;
}

function createInsert(table: unknown) {
  const call = { table } as {
    table: unknown;
    values?: Record<string, unknown>;
    conflict?: unknown;
  };
  insertCalls.push(call);
  const query = {
    values: mock((values: Record<string, unknown>) => {
      call.values = values;
      return query;
    }),
    onConflictDoUpdate: mock((conflict: unknown) => {
      call.conflict = conflict;
      return query;
    }),
    returning: mock(async () => insertResults.shift() ?? []),
  };
  return query;
}

function createUpdate(table: unknown) {
  const call = { table } as {
    table: unknown;
    set?: Record<string, unknown>;
  };
  updateCalls.push(call);
  const query = {
    set: mock((set: Record<string, unknown>) => {
      call.set = set;
      return query;
    }),
    where: mock(() => query),
    returning: mock(async () => updateResults.shift() ?? []),
  };
  return query;
}

function createDelete(table: unknown) {
  deleteCalls.push({ table });
  const query = {
    where: mock(() => query),
    returning: mock(async () => deleteResults.shift() ?? []),
  };
  return query;
}

const dbMock = {
  select: mock((selection?: unknown) => createSelect(selection)),
  insert: mock((table: unknown) => createInsert(table)),
  update: mock((table: unknown) => createUpdate(table)),
  delete: mock((table: unknown) => createDelete(table)),
};

mock.module("../db/client", () => ({
  db: dbMock,
}));

async function importPolicyTagService() {
  return import("./policy-tag.service.ts?policy-tag-service-test");
}

describe("PolicyTagService", () => {
  beforeEach(() => {
    selectResults = [];
    insertResults = [];
    updateResults = [];
    deleteResults = [];
    insertCalls.length = 0;
    updateCalls.length = 0;
    deleteCalls.length = 0;
    selectCalls.length = 0;
    dbMock.select.mockClear();
    dbMock.insert.mockClear();
    dbMock.update.mockClear();
    dbMock.delete.mockClear();
  });

  test("creates scoped rules only after validating the TAG Unit", async () => {
    const { PolicyTagService } = await importPolicyTagService();
    const service = new PolicyTagService();
    queueSelect([{ id: "tag-1" }]);
    queueInsert([activeRuleRow]);

    const row = await service.createRule("manager-1", {
      scope: { kind: "realm", realmUnitId: "realm-1" },
      tagUnitId: "tag-1",
      reason: "curated",
    });

    expect(row).toEqual(activeRuleRow);
    expect(dbMock.select).toHaveBeenCalledTimes(1);
    expect(insertCalls[0]?.values).toMatchObject({
      scopeKind: "realm",
      realmUnitId: "realm-1",
      tagUnitId: "tag-1",
      createdByUserId: "manager-1",
      updatedByUserId: "manager-1",
      reason: "curated",
    });
  });

  test("rejects application mutations for archived rules", async () => {
    const { PolicyTagError, PolicyTagService } = await importPolicyTagService();
    const service = new PolicyTagService();
    queueSelect([archivedRuleRow]);

    await expect(
      service.upsertApplication("manager-1", "rule-archived", {
        unitId: "unit-1",
      }),
    ).rejects.toMatchObject({
      code: "RULE_ARCHIVED",
      httpStatus: 409,
    } satisfies Partial<InstanceType<typeof PolicyTagError>>);
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  test("upserts policy applications by rule and Unit without touching ordinary tags", async () => {
    const { PolicyTagService } = await importPolicyTagService();
    const service = new PolicyTagService();
    queueSelect(
      [activeRuleRow],
      [{ application: applicationRow, rule: activeRuleRow }],
    );
    queueInsert([applicationRow]);

    const row = await service.upsertApplication("manager-1", "rule-1", {
      unitId: "unit-1",
      position: "a",
      metadata: { source: "curated" },
    });

    expect(row).toEqual({ ...applicationRow, rule: activeRuleRow });
    expect(insertCalls[0]?.values).toMatchObject({
      ruleId: "rule-1",
      unitId: "unit-1",
      position: "a",
      metadata: { source: "curated" },
      appliedByUserId: "manager-1",
      updatedByUserId: "manager-1",
    });
    expect(insertCalls[0]?.conflict).toBeDefined();
  });

  test("lists applications with stable ordered pagination", async () => {
    const { PolicyTagService } = await importPolicyTagService();
    const service = new PolicyTagService();
    queueSelect(
      [{ application: applicationRow, rule: activeRuleRow }],
      [{ total: 1 }],
    );

    const result = await service.listApplications({
      ruleId: "rule-1",
      limit: 200,
      offset: 5,
    });

    expect(result).toEqual({
      rows: [{ ...applicationRow, rule: activeRuleRow }],
      total: 1,
    });
    expect(selectCalls[0]).toMatchObject({
      orderByCount: 4,
      limit: 100,
      offset: 5,
    });
  });

  test("policy-search hydration returns Units that match every requested policy tag", async () => {
    const { PolicyTagService } = await importPolicyTagService();
    const service = new PolicyTagService();
    queueSelect([
      { unitId: "unit-1", tagUnitId: "tag-1" },
      { unitId: "unit-1", tagUnitId: "tag-2" },
      { unitId: "unit-2", tagUnitId: "tag-1" },
    ]);

    await expect(
      service.listAppliedUnitIdsForSearch({
        scope: { kind: "realm", realmUnitId: "realm-1" },
        tagUnitIds: ["tag-1", "tag-2", "tag-1"],
      }),
    ).resolves.toEqual(["unit-1"]);
  });

  test("delete reports missing policy applications", async () => {
    const { PolicyTagService } = await importPolicyTagService();
    const service = new PolicyTagService();
    queueDelete([]);

    await expect(
      service.deleteApplication("rule-1", "unit-missing"),
    ).rejects.toMatchObject({
      code: "APPLICATION_NOT_FOUND",
      httpStatus: 404,
    });
  });
});
