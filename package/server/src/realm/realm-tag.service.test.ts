import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  Realm,
  RealmTagApplication as RealmTagApplicationTable,
  RealmTagApplicationVote,
  TagVote,
  Unit,
  UnitRealm,
  UnitTag,
} from "../db/schema";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

const findManyMock = mock((_args?: unknown) =>
  Promise.resolve([] as unknown[]),
);
const unitFindUniqueMock = mock(async ({ where }: any) => {
  if (where.id === "realm-1" || where.id === "realm-2") {
    return { id: where.id, type: "REALM", realm: { unitId: where.id } };
  }
  if (where.id === "tag-1") return { id: "tag-1", type: "TAG" };
  if (where.id === "book-1") return { id: "book-1", type: "BOOK" };
  if (where.id === "unit-1") {
    return { id: "unit-1", type: "BOOK", targetUnitId: "canonical-target" };
  }
  return null;
});
const realmUnitCreateMock = mock(async (_args?: any) => ({}));
const realmUnitDeleteMock = mock(async (_args?: any) => ({}));
const realmUnitFindManyMock = mock(async () => []);
const realmTagApplicationUpsertMock = mock(async ({ create }: any) => ({
  ...create,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
}));
const realmTagApplicationUpdateMock = mock(async ({ where, data }: any) => ({
  realmUnitId: where.realmUnitId_tagUnitId_unitId.realmUnitId,
  tagUnitId: where.realmUnitId_tagUnitId_unitId.tagUnitId,
  unitId: where.realmUnitId_tagUnitId_unitId.unitId,
  pinned: false,
  position: null,
  score: data.score,
  voteCount: data.voteCount,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
}));
const realmTagApplicationDeleteMock = mock(async () => ({}));
const realmTagApplicationVoteFindUniqueMock = mock(
  async (): Promise<any> => null,
);
const realmTagApplicationVoteCreateMock = mock(async (_args?: any) => ({}));
const realmTagApplicationVoteDeleteManyMock = mock(async () => ({ count: 0 }));
const realmTagApplicationVoteAggregateMock = mock(async () => ({
  _sum: { value: 1 },
  _count: { value: 1 },
}));
const tagVoteFindUniqueMock = mock(async (): Promise<any> => null);
const tagVoteCreateMock = mock(async (_args?: any) => ({}));
const tagVoteAggregateMock = mock(async () => ({
  _sum: { value: 1 },
  _count: { value: 1 },
}));
const unitTagUpsertMock = mock(async (_args?: any) => ({}));
const unitTagUpdateMock = mock(async (_args?: any) => ({}));
const enqueueMock = mock(async (_command: any) => ({ status: "created" }));

function sqlValues(condition: unknown): unknown[] {
  const values: unknown[] = [];
  function walk(value: unknown): void {
    if (!value || typeof value !== "object") return;
    const maybeValue = (value as { value?: unknown }).value;
    if (
      maybeValue !== undefined &&
      !Array.isArray(maybeValue) &&
      (typeof maybeValue === "string" ||
        typeof maybeValue === "number" ||
        typeof maybeValue === "boolean")
    ) {
      values.push(maybeValue);
    }
    const chunks = (value as { queryChunks?: unknown[] }).queryChunks;
    if (Array.isArray(chunks)) {
      for (const chunk of chunks) walk(chunk);
    }
  }
  walk(condition);
  return values;
}

function valuesByTable(values: unknown[]): {
  realmUnitId?: string;
  unitId?: string;
  tagUnitId?: string;
} {
  if (typeof values[0] === "number") {
    return {
      realmUnitId: typeof values[1] === "string" ? values[1] : undefined,
    };
  }
  if (values[0] === "realm-1" || values[0] === "realm-2") {
    return {
      realmUnitId: values[0] as string,
      unitId: typeof values[1] === "string" ? values[1] : undefined,
      tagUnitId: typeof values[2] === "string" ? values[2] : undefined,
    };
  }
  return {
    unitId: values[0] as string | undefined,
    tagUnitId: typeof values[1] === "string" ? values[1] : undefined,
  };
}

function createFakeSelect(selection?: Record<string, unknown>) {
  let table: unknown;
  let condition: unknown;
  let take: number | undefined;
  const query = {
    from: mock((nextTable: unknown) => {
      table = nextTable;
      return query;
    }),
    leftJoin: mock(() => query),
    where: mock((nextCondition: unknown) => {
      condition = nextCondition;
      return query;
    }),
    orderBy: mock(() => query),
    limit: mock((nextLimit: number) => {
      take = nextLimit;
      return query;
    }),
    async resolve() {
      const values = sqlValues(condition);
      if (table === Unit) {
        const id = values[0] as string | undefined;
        const unit = await unitFindUniqueMock({ where: { id } });
        if (!unit) return [];
        return [
          selection?.realmUnitId
            ? {
                id: unit.id,
                type: unit.type,
                realmUnitId: unit.realm?.unitId ?? null,
              }
            : unit,
        ];
      }
      if (table === RealmTagApplicationTable) {
        const ids = valuesByTable(values);
        const threshold = values.find((value) => typeof value === "number");
        return findManyMock({
          where: {
            ...(ids.realmUnitId ? { realmUnitId: ids.realmUnitId } : {}),
            ...(ids.unitId ? { unitId: ids.unitId } : {}),
            ...(ids.tagUnitId ? { tagUnitId: ids.tagUnitId } : {}),
            ...(threshold !== undefined
              ? values[0] === threshold
                ? { score: { lte: threshold } }
                : { score: { gt: threshold } }
              : {}),
          },
          orderBy:
            threshold !== undefined && values[0] === threshold
              ? [
                  { score: "asc" },
                  { realmUnitId: "asc" },
                  { unitId: "asc" },
                  { tagUnitId: "asc" },
                ]
              : [
                  { pinned: "desc" },
                  { position: "asc" },
                  { score: "desc" },
                  { tagUnitId: "asc" },
                ],
          ...(take !== undefined ? { take } : {}),
        });
      }
      if (table === RealmTagApplicationVote) {
        if (selection?.score) return [{ score: 1, voteCount: 1 }];
        const row = await realmTagApplicationVoteFindUniqueMock();
        return row ? [row] : [];
      }
      if (table === TagVote) {
        if (selection?.score) return [{ score: 1, voteCount: 1 }];
        const row = await tagVoteFindUniqueMock();
        return row ? [row] : [];
      }
      return [];
    },
    then(
      resolve: (value: unknown[]) => unknown,
      reject?: (error: unknown) => unknown,
    ) {
      return query.resolve().then(resolve, reject);
    },
  };
  return query;
}

function createFakeInsert(table: unknown) {
  let data: Record<string, unknown> = {};
  const query = {
    values: mock((nextData: Record<string, unknown>) => {
      data = nextData;
      return query;
    }),
    onConflictDoNothing: mock(() => query),
    onConflictDoUpdate: mock(() => query),
    returning: mock(async () => {
      if (table === UnitRealm) {
        return [await realmUnitCreateMock({ data })];
      }
      return [{ ...data, createdAt: new Date("2026-01-01T00:00:00Z") }];
    }),
    async execute() {
      if (table === RealmTagApplicationTable) {
        await realmTagApplicationUpsertMock({
          where: {
            realmUnitId_tagUnitId_unitId: {
              realmUnitId: data.realmUnitId,
              tagUnitId: data.tagUnitId,
              unitId: data.unitId,
            },
          },
          create: data,
        });
      }
      if (table === RealmTagApplicationVote) {
        await realmTagApplicationVoteCreateMock({ data });
      }
      if (table === TagVote) {
        await tagVoteCreateMock({ data });
      }
      if (table === UnitTag) {
        await unitTagUpsertMock({ create: data, update: data });
      }
      return [];
    },
    then(
      resolve: (value: unknown[]) => unknown,
      reject?: (error: unknown) => unknown,
    ) {
      return query.execute().then(resolve, reject);
    },
  };
  return query;
}

function createFakeUpdate(table: unknown) {
  let data: Record<string, unknown> = {};
  const query = {
    set: mock((nextData: Record<string, unknown>) => {
      data = nextData;
      return query;
    }),
    where: mock(() => query),
    returning: mock(async () => {
      if (table === RealmTagApplicationTable) {
        return [
          await realmTagApplicationUpdateMock({
            where: {
              realmUnitId_tagUnitId_unitId: {
                realmUnitId: "realm-1",
                tagUnitId: "tag-1",
                unitId: "unit-1",
              },
            },
            data,
          }),
        ];
      }
      return [{ ...data }];
    }),
    async execute() {
      if (table === RealmTagApplicationTable) {
        await realmTagApplicationUpdateMock({
          where: {
            realmUnitId_tagUnitId_unitId: {
              realmUnitId: "realm-1",
              tagUnitId: "tag-1",
              unitId: "unit-1",
            },
          },
          data,
        });
      }
      if (table === UnitTag) await unitTagUpdateMock({ data });
      return [];
    },
    then(
      resolve: (value: unknown[]) => unknown,
      reject?: (error: unknown) => unknown,
    ) {
      return query.execute().then(resolve, reject);
    },
  };
  return query;
}

function createFakeDelete(table: unknown) {
  const query = {
    where: mock(() => query),
    async execute() {
      if (table === RealmTagApplicationTable) {
        await realmTagApplicationDeleteMock();
      }
      if (table === UnitRealm) await realmUnitDeleteMock();
      return [];
    },
    then(
      resolve: (value: unknown[]) => unknown,
      reject?: (error: unknown) => unknown,
    ) {
      return query.execute().then(resolve, reject);
    },
  };
  return query;
}

const fakeDrizzleDb = {
  select: mock((selection?: Record<string, unknown>) =>
    createFakeSelect(selection),
  ),
  insert: mock((table: unknown) => createFakeInsert(table)),
  update: mock((table: unknown) => createFakeUpdate(table)),
  delete: mock((table: unknown) => createFakeDelete(table)),
  transaction: mock(async (fn: any) => fn(fakeDrizzleDb)),
};
const transactionMock = fakeDrizzleDb.transaction;

mock.module("@/meili/content/sync", () => ({
  deleteContentFromMeili: async () => undefined,
  patchContentCreditsToMeili: async () => undefined,
  patchContentMetadataToMeili: async () => undefined,
  patchContentTagsToMeili: async () => undefined,
  patchContentTranslationsToMeili: async () => undefined,
  patchContentRealmIdsToMeili: async () => undefined,
  patchContentRealmTagKeysToMeili: async () => undefined,
  syncContentToMeili: async () => undefined,
}));

mock.module("@/meili/realm/sync", () => ({
  deleteRealmFromMeili: async () => undefined,
  patchRealmMemberCountToMeili: async () => undefined,
  patchRealmMetadataToMeili: async () => undefined,
  patchRealmTranslationsToMeili: async () => undefined,
  syncAllRealmsToMeili: async () => undefined,
  syncRealmToMeili: async () => undefined,
}));
mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));
mock.module("@/content-doc/json-write", () => ({
  nullableContentDocJson: (value: unknown) => value ?? null,
}));
mock.module("@/governance/action/realm", () => ({
  realmPolicyActions: new Proxy({}, { get: (_target, key) => key }),
}));
mock.module("@/governance/audit.service", () => ({
  governanceAuditService: {
    appendPrivilegedMutation: mock(async () => ({ id: "audit-1" })),
  },
}));
mock.module("@/governance/capability.service", () => ({
  governanceCapabilityService: {
    realmMembershipForPolicy: mock(async () => null),
    resolveHintsForIdentity: mock(async () => []),
  },
}));
mock.module("@/governance/moderation-action.service", () => ({
  moderationActionService: {
    appendModerationAction: mock(async () => ({ id: "action-1" })),
  },
}));
mock.module("@/notify-boundary/notify-boundary.client", () => ({
  broadcast: mock(async () => ({ ok: true })),
}));
mock.module("@/post/post.mapper", () => ({
  mapPostToDTO: (row: unknown) => row,
}));
mock.module("@/post/post.service", () => ({
  postService: {
    getByUnitId: mock(async () => null),
  },
}));
mock.module("@/unit/language-resolution", () => ({
  resolveEffectiveReadLanguageCandidates: () => ["ja", "en"],
}));
mock.module("@/unit/mapper", () => ({
  mapTranslationToDTO: (row: unknown) => row,
}));
mock.module("@/utils/sanitizeUser", () => ({
  mapPublicUser: (user: unknown) => user ?? null,
}));
mock.module("@/utils/userSlugHydration", () => ({
  hydrateUnitOwnerUserSlugRow: async (row: unknown) => row,
  hydrateUnitOwnerUserSlugs: async (rows: unknown) => rows,
  loadUserSlugMap: async () => new Map(),
}));
mock.module("@/infra/slug-scopes", () => ({
  requireSlugScopeId: () => "realm-scope",
}));
mock.module("./realm-extra.service", () => ({
  appendToList: mock(async () => ({ unitIds: [] })),
  clearSingleExtraKey: mock(async () => undefined),
  filterRealmExtraPublic: mock(async (extra: unknown) => extra),
  readListAdmin: mock(async () => ({ unitIds: [], staleIds: [] })),
  readListPublic: mock(async () => []),
  removeFromList: mock(async () => ({ unitIds: [] })),
  reorderList: mock(async (_caller, _realmId, _key, unitIds) => ({ unitIds })),
  setSingleExtraKey: mock(async () => undefined),
}));
mock.module("../db/client", () => ({
  db: fakeDrizzleDb,
}));

const { RealmService, REALM_TAG_VISIBILITY_THRESHOLD } = await import(
  "./realm.service"
);

function resetWriteMocks() {
  unitFindUniqueMock.mockClear();
  realmUnitCreateMock.mockClear();
  realmUnitDeleteMock.mockClear();
  realmUnitFindManyMock.mockClear();
  realmTagApplicationUpsertMock.mockClear();
  realmTagApplicationUpdateMock.mockClear();
  realmTagApplicationDeleteMock.mockClear();
  realmTagApplicationVoteFindUniqueMock.mockClear();
  realmTagApplicationVoteFindUniqueMock.mockResolvedValue(null);
  realmTagApplicationVoteCreateMock.mockClear();
  realmTagApplicationVoteDeleteManyMock.mockClear();
  realmTagApplicationVoteAggregateMock.mockClear();
  tagVoteFindUniqueMock.mockClear();
  tagVoteFindUniqueMock.mockResolvedValue(null);
  tagVoteCreateMock.mockClear();
  tagVoteAggregateMock.mockClear();
  unitTagUpsertMock.mockClear();
  unitTagUpdateMock.mockClear();
  enqueueMock.mockClear();
  transactionMock.mockClear();
}

describe("RealmService.listRealmTagsForUnit", () => {
  const service = new RealmService();

  test("regular caller filters out below-threshold rows", async () => {
    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.listRealmTagsForUnit("realm-1", "unit-x");
    const args = findManyMock.mock.calls[0]?.[0] as any;
    expect(args.where).toEqual({
      realmUnitId: "realm-1",
      unitId: "unit-x",
      score: { gt: REALM_TAG_VISIBILITY_THRESHOLD },
    });
  });

  test("privileged caller sees below-threshold rows", async () => {
    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.listRealmTagsForUnit("realm-1", "unit-x", {
      includeBelowThreshold: true,
    });
    const args = findManyMock.mock.calls[0]?.[0] as any;
    expect(args.where).toEqual({ realmUnitId: "realm-1", unitId: "unit-x" });
  });

  test("orders pin-first then position asc then score desc", async () => {
    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.listRealmTagsForUnit("realm-1", "unit-x");
    const args = findManyMock.mock.calls[0]?.[0] as any;
    expect(args.orderBy).toEqual([
      { pinned: "desc" },
      { position: "asc" },
      { score: "desc" },
      { tagUnitId: "asc" },
    ]);
  });
});

describe("RealmService.listLowScoreRealmTagApplications", () => {
  const service = new RealmService();

  test("queries score <= threshold, ordered ascending", async () => {
    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.listLowScoreRealmTagApplications(-100, 50);
    const args = findManyMock.mock.calls[0]?.[0] as any;
    expect(args.where).toEqual({ score: { lte: -100 } });
    expect(args.orderBy).toEqual([
      { score: "asc" },
      { realmUnitId: "asc" },
      { unitId: "asc" },
      { tagUnitId: "asc" },
    ]);
    expect(args.take).toBe(50);
  });

  test("constrains to a single realm when realmUnitId is provided", async () => {
    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.listLowScoreRealmTagApplications(-100, 50, "realm-1");
    const args = findManyMock.mock.calls[0]?.[0] as any;
    expect(args.where).toEqual({
      score: { lte: -100 },
      realmUnitId: "realm-1",
    });
  });

  test("clamps limit between 1 and 200", async () => {
    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.listLowScoreRealmTagApplications(0, 5000);
    const args1 = findManyMock.mock.calls[0]?.[0] as any;
    expect(args1.take).toBe(200);

    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.listLowScoreRealmTagApplications(0, 0);
    const args2 = findManyMock.mock.calls[0]?.[0] as any;
    expect(args2.take).toBe(1);
  });
});

describe("REALM_TAG_VISIBILITY_THRESHOLD", () => {
  test("score at or below this value hides a RealmTagApplication from regular users", () => {
    expect(REALM_TAG_VISIBILITY_THRESHOLD).toBe(-100);
  });
});

describe("RealmService.createRealmTagApplication", () => {
  const service = new RealmService();

  beforeEach(resetWriteMocks);

  test("creates RealmTagApplication without creating UnitRealm", async () => {
    await service.createRealmTagApplication(
      "user-1",
      "realm-1",
      "unit-1",
      "tag-1",
    );

    expect(realmTagApplicationUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          realmUnitId_tagUnitId_unitId: {
            realmUnitId: "realm-1",
            tagUnitId: "tag-1",
            unitId: "unit-1",
          },
        },
      }),
    );
    expect(realmUnitCreateMock).not.toHaveBeenCalled();
    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.content.patchTags",
      "search.content.patchRealmTagKeys",
    ]);
  });

  test("writes the requested content unit without following Unit.targetUnitId", async () => {
    await service.createRealmTagApplication(
      "user-1",
      "realm-1",
      "unit-1",
      "tag-1",
    );

    expect(realmTagApplicationUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          realmUnitId_tagUnitId_unitId: {
            realmUnitId: "realm-1",
            tagUnitId: "tag-1",
            unitId: "unit-1",
          },
        },
        create: expect.objectContaining({
          realmUnitId: "realm-1",
          tagUnitId: "tag-1",
          unitId: "unit-1",
        }),
      }),
    );
  });

  test("rejects non-TAG tagUnitId and non-REALM realmUnitId", async () => {
    await expect(
      service.createRealmTagApplication("user-1", "book-1", "unit-1", "tag-1"),
    ).rejects.toThrow("realmUnitId");

    await expect(
      service.createRealmTagApplication(
        "user-1",
        "realm-1",
        "unit-1",
        "book-1",
      ),
    ).rejects.toThrow("tagUnitId");
  });

  test("creates global TagVote and UnitTag aggregate once per user/unit/tag", async () => {
    await service.createRealmTagApplication(
      "user-1",
      "realm-1",
      "unit-1",
      "tag-1",
    );
    tagVoteFindUniqueMock.mockResolvedValueOnce({
      userId: "user-1",
      unitId: "unit-1",
      tagUnitId: "tag-1",
      value: 1,
    });
    realmTagApplicationVoteFindUniqueMock.mockResolvedValueOnce({
      realmUnitId: "realm-1",
      tagUnitId: "tag-1",
      unitId: "unit-1",
      userId: "user-1",
      value: 1,
    });
    await service.createRealmTagApplication(
      "user-1",
      "realm-1",
      "unit-1",
      "tag-1",
    );

    expect(tagVoteCreateMock).toHaveBeenCalledTimes(1);
    expect(unitTagUpsertMock).toHaveBeenCalledTimes(2);
  });

  test("does not amplify global TagVote across multiple realms", async () => {
    await service.createRealmTagApplication(
      "user-1",
      "realm-1",
      "unit-1",
      "tag-1",
    );
    tagVoteFindUniqueMock.mockResolvedValueOnce({
      userId: "user-1",
      unitId: "unit-1",
      tagUnitId: "tag-1",
      value: 1,
    });
    await service.createRealmTagApplication(
      "user-1",
      "realm-2",
      "unit-1",
      "tag-1",
    );

    expect(tagVoteCreateMock).toHaveBeenCalledTimes(1);
  });
});

describe("RealmService.deleteRealmTagApplication", () => {
  const service = new RealmService();

  beforeEach(resetWriteMocks);

  test("deletes only RealmTagApplication and relies on application cascade", async () => {
    await service.deleteRealmTagApplication("realm-1", "unit-1", "tag-1");

    expect(realmTagApplicationDeleteMock).toHaveBeenCalledTimes(1);
    expect(realmTagApplicationVoteDeleteManyMock).not.toHaveBeenCalled();
    expect(unitTagUpdateMock).not.toHaveBeenCalled();
    expect(unitTagUpsertMock).not.toHaveBeenCalled();
  });
});

describe("RealmService.removeUnitRealm", () => {
  const service = new RealmService();

  beforeEach(resetWriteMocks);

  test("does not delete RealmTagApplication rows when removing feed membership", async () => {
    await service.removeUnitRealm("realm-1", "unit-1");

    expect(realmUnitDeleteMock).toHaveBeenCalledTimes(1);
    expect(realmTagApplicationDeleteMock).not.toHaveBeenCalled();
    expect(realmTagApplicationVoteDeleteManyMock).not.toHaveBeenCalled();
  });
});
