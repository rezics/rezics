import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";
import {
  Comment,
  Feedback,
  ModerationAction,
  ModerationCase,
  Post,
  Unit,
  UnitCollaborator,
  UnitRealm,
} from "../db/schema";

installPrismaClientMock();

const now = new Date("2026-05-28T00:00:00.000Z");

const moderationCaseRow = {
  id: "case-1",
  scope: "PLATFORM",
  state: "NEW",
  severity: null,
  reporterUserId: "reporter-1",
  subjectUserId: null,
  targetKind: "UNIT",
  targetId: "post-1",
  addressedUnitId: "post-1",
  realmUnitId: null,
  sourceFeedbackId: "feedback-1",
  assignedToUserId: null,
  parentCaseId: null,
  duplicateOfCaseId: null,
  reason: "reported",
  safeSummary: null,
  metadata: null,
  createdAt: now,
  updatedAt: now,
};

const realmCaseRow = {
  ...moderationCaseRow,
  id: "realm-case-1",
  scope: "REALM",
  realmUnitId: "realm-1",
};

const unitRow = {
  id: "post-1",
  moderationStatus: "APPROVED",
  createdAt: now,
  updatedAt: now,
};

const unitRealmRow = {
  realmUnitId: "realm-1",
  unitId: "post-1",
  moderationStatus: "PENDING",
  isLocked: false,
  createdAt: now,
};

const commentRow = {
  id: "comment-1",
  rootUnitId: "post-1",
  realmUnitId: "realm-1",
  moderationStatus: "APPROVED",
  isLocked: false,
  rootUnit: {
    userId: "owner-1",
    collaborators: [{ userId: "maintainer-1", roleKey: "maintainer" }],
  },
  createdAt: now,
  updatedAt: now,
};

const moderationActionRow = {
  id: "action-1",
  authority: "PLATFORM",
  realmUnitId: null,
  targetKind: "UNIT",
  targetId: "post-1",
  targetPath: null,
  actorKind: "USER",
  actorUserId: "staff-1",
  actionKind: "REMOVE",
  resultingStatus: "REMOVED",
  resultingLocked: null,
  reasonCode: "policy.violation",
  reasonText: "abuse",
  publicMessage: null,
  caseId: "case-1",
  reversesActionId: null,
  requestId: "req-1",
  importedFrom: null,
  createdAt: now,
};

const feedbackRow = {
  id: "feedback-1",
  userId: "reporter-1",
  targetKind: "UNIT",
  targetId: "post-1",
  addressedUnitId: "post-1",
  url: null,
  content: "reported",
  type: "REPORT",
  resolved: false,
  resolvedAt: null,
  createdAt: now,
  updatedAt: now,
};

const moderationCaseFindMany = mock(async (_args?: any) => [moderationCaseRow]);
const moderationCaseFindFirst = mock(async (_args?: any): Promise<any> => null);
const moderationCaseFindUniqueOrThrow = mock(
  async (_args?: any): Promise<any> => moderationCaseRow,
);
const moderationCaseCreate = mock(
  async ({ data }: any): Promise<any> => ({
    ...moderationCaseRow,
    ...data,
    id: data.scope === "REALM" ? "realm-case-1" : "case-1",
    createdAt: now,
    updatedAt: now,
  }),
);
const moderationCaseUpdate = mock(
  async ({ data }: any): Promise<any> => ({
    ...moderationCaseRow,
    ...data,
    updatedAt: now,
  }),
);
const moderationActionFindMany = mock(async (_args?: any) => [
  moderationActionRow,
]);
const unitUpdate = mock(async ({ data }: any) => ({
  ...unitRow,
  ...data,
  updatedAt: now,
}));
const unitFindMany = mock(async (_args?: any) => [unitRow]);
const unitFindUnique = mock(async (_args?: any) => commentRow.rootUnit);
const unitRealmUpdate = mock(async ({ data }: any) => ({
  ...unitRealmRow,
  ...data,
}));
const unitRealmFindMany = mock(async (_args?: any) => [unitRealmRow]);
const postUpdate = mock(async ({ data }: any) => ({
  unitId: "post-1",
  ...data,
}));
const commentUpdate = mock(async ({ data }: any) => ({
  ...commentRow,
  ...data,
}));
const commentFindMany = mock(async (_args?: any) => [commentRow]);
const commentFindUniqueOrThrow = mock(async (_args?: any) => commentRow);
const feedbackFindUniqueOrThrow = mock(async (_args?: any) => feedbackRow);
const queryRawMock = mock(async () => []);
const transactionMock = mock(async (fn: any) => fn(fakeDrizzleDb));

const appendModerationActionMock = mock(async (_tx: any, input: any) => ({
  ...moderationActionRow,
  ...input,
  id: input.actionKind === "ESCALATE" ? "action-escalate" : "action-1",
  createdAt: now,
}));
const latestActionsForMock = mock(async () => [moderationActionRow]);
const latestEffectiveRemoveForMock = mock(async (): Promise<any> => null);
const resolveHintsForIdentityMock = mock(async (): Promise<any[]> => []);
const realmMembershipForPolicyMock = mock(async (): Promise<any> => null);
const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
const broadcastMock = mock(async (_event: any) => ({ ok: true, persisted: 1 }));

let drizzleSelectResults: unknown[][] = [];

function queueDrizzleSelectResults(...results: unknown[][]): void {
  drizzleSelectResults = [...results];
}

function conditionHasColumn(condition: unknown, columnName: string): boolean {
  if (!condition || typeof condition !== "object") return false;
  const chunks = (condition as { queryChunks?: unknown[] }).queryChunks;
  if (chunks?.some((chunk) => conditionHasColumn(chunk, columnName))) {
    return true;
  }
  return (condition as { name?: unknown }).name === columnName;
}

function stripUpdatedAt<T extends Record<string, unknown>>(
  data: T,
): Omit<T, "updatedAt"> {
  const { updatedAt: _updatedAt, ...rest } = data;
  return rest;
}

async function resolveDrizzleSelect(table: unknown, condition: unknown) {
  if (drizzleSelectResults.length > 0)
    return drizzleSelectResults.shift() ?? [];
  if (table === ModerationCase) {
    if (conditionHasColumn(condition, "sourceFeedbackId")) {
      const row = await moderationCaseFindFirst({
        where: conditionHasColumn(condition, "realmUnitId")
          ? {
              scope: "REALM",
              realmUnitId: "realm-1",
              sourceFeedbackId: "feedback-1",
            }
          : { sourceFeedbackId: "feedback-1", scope: "PLATFORM" },
        orderBy: { createdAt: "asc" },
      });
      return row ? [row] : [];
    }
    return [await moderationCaseFindUniqueOrThrow({ where: { id: "case-1" } })];
  }
  if (table === ModerationAction) return moderationActionFindMany();
  if (table === Feedback) {
    return [await feedbackFindUniqueOrThrow({ where: { id: "feedback-1" } })];
  }
  if (table === Unit) return unitFindMany();
  if (table === UnitCollaborator) {
    return commentRow.rootUnit.collaborators;
  }
  if (table === UnitRealm) return unitRealmFindMany();
  if (table === Comment) return commentFindMany();
  return [];
}

function createFakeDrizzleSelectQuery() {
  let table: unknown;
  let condition: unknown;
  const query = {
    from: mock((nextTable: unknown) => {
      table = nextTable;
      return query;
    }),
    where: mock((nextCondition: unknown) => {
      condition = nextCondition;
      return query;
    }),
    orderBy: mock(() => query),
    offset: mock(() => query),
    limit: mock(() => query),
    then(
      resolve: (value: unknown[]) => unknown,
      reject?: (error: unknown) => unknown,
    ) {
      return Promise.resolve(resolveDrizzleSelect(table, condition)).then(
        resolve,
        reject,
      );
    },
  };
  return query;
}

function createFakeDrizzleInsert(table: unknown) {
  let data: Record<string, unknown> = {};
  const query = {
    values: mock((nextData: Record<string, unknown>) => {
      data = nextData;
      return query;
    }),
    returning: mock(async () => {
      if (table === ModerationCase) {
        return [await moderationCaseCreate({ data: stripUpdatedAt(data) })];
      }
      return [{ ...data, id: "inserted-1", createdAt: now }];
    }),
  };
  return query;
}

function createFakeDrizzleUpdate(table: unknown) {
  let data: Record<string, unknown> = {};
  const query = {
    set: mock((nextData: Record<string, unknown>) => {
      data = nextData;
      return query;
    }),
    where: mock(() => query),
    returning: mock(async () => {
      const stripped = stripUpdatedAt(data);
      if (table === ModerationCase) {
        return [
          await moderationCaseUpdate({
            where: { id: "realm-case-1" },
            data: stripped,
          }),
        ];
      }
      if (table === Unit) {
        return [await unitUpdate({ where: { id: "post-1" }, data: stripped })];
      }
      if (table === UnitRealm) {
        return [
          await unitRealmUpdate({
            where: {
              realmUnitId_unitId: { realmUnitId: "realm-1", unitId: "post-1" },
            },
            data: stripped,
          }),
        ];
      }
      if (table === Post) {
        return [
          await postUpdate({ where: { unitId: "post-1" }, data: stripped }),
        ];
      }
      if (table === Comment) {
        return [
          await commentUpdate({ where: { id: "comment-1" }, data: stripped }),
        ];
      }
      return [{ ...data, updatedAt: now }];
    }),
  };
  return query;
}

const fakeDrizzleDb = {
  select: mock(() => createFakeDrizzleSelectQuery()),
  insert: mock((table: unknown) => createFakeDrizzleInsert(table)),
  update: mock((table: unknown) => createFakeDrizzleUpdate(table)),
  execute: queryRawMock,
  transaction: transactionMock,
};

Object.assign(prismaMock, {
  $transaction: transactionMock,
  moderationCase: {
    findMany: moderationCaseFindMany,
    findFirst: moderationCaseFindFirst,
    findUniqueOrThrow: moderationCaseFindUniqueOrThrow,
  },
  moderationAction: {
    findMany: moderationActionFindMany,
  },
  unit: {
    findMany: unitFindMany,
    findUnique: unitFindUnique,
    update: unitUpdate,
  },
  unitRealm: {
    findMany: unitRealmFindMany,
    update: unitRealmUpdate,
  },
  post: {
    update: postUpdate,
  },
  comment: {
    findMany: commentFindMany,
    findUniqueOrThrow: commentFindUniqueOrThrow,
    update: commentUpdate,
  },
  feedback: {
    findUniqueOrThrow: feedbackFindUniqueOrThrow,
  },
});

function installServiceTestModuleMocks() {
  installPrismaClientMock();
  mock.module("@/job/job-boundary", () => ({
    serverJobProducer: {
      enqueue: enqueueMock,
    },
  }));

  mock.module("@/notify-boundary/notify-boundary.client", () => ({
    broadcast: broadcastMock,
  }));

  mock.module("@/utils/sanitizeUser", () => ({
    mapPublicUser: (user: unknown) => user ?? null,
  }));

  mock.module("../db/client", () => ({
    db: fakeDrizzleDb,
  }));
}

installServiceTestModuleMocks();

const actionService = {
  appendModerationAction: appendModerationActionMock,
  latestActionsFor: latestActionsForMock,
  latestEffectiveRemoveFor: latestEffectiveRemoveForMock,
};

const capabilityService = {
  resolveHintsForIdentity: resolveHintsForIdentityMock,
  realmMembershipForPolicy: realmMembershipForPolicyMock,
};

async function newService() {
  let module = await import("./moderation.service.ts");
  if (!module.GovernanceModerationService) {
    mock.restore();
    installServiceTestModuleMocks();
    module = await import(`./moderation.service.ts?service-test=${Date.now()}`);
  }
  const { GovernanceModerationService } = module;
  return new GovernanceModerationService(
    actionService as any,
    capabilityService as any,
  );
}

describe("GovernanceModerationService moderation ledger", () => {
  beforeEach(() => {
    moderationCaseFindMany.mockClear();
    moderationCaseFindFirst.mockClear();
    moderationCaseFindFirst.mockResolvedValue(null);
    moderationCaseFindUniqueOrThrow.mockClear();
    moderationCaseFindUniqueOrThrow.mockResolvedValue(moderationCaseRow);
    moderationCaseCreate.mockClear();
    moderationCaseUpdate.mockClear();
    moderationActionFindMany.mockClear();
    moderationActionFindMany.mockResolvedValue([moderationActionRow]);
    unitUpdate.mockClear();
    unitFindMany.mockClear();
    unitFindMany.mockResolvedValue([unitRow]);
    unitFindUnique.mockClear();
    unitFindUnique.mockResolvedValue(commentRow.rootUnit);
    unitRealmUpdate.mockClear();
    unitRealmFindMany.mockClear();
    unitRealmFindMany.mockResolvedValue([unitRealmRow]);
    postUpdate.mockClear();
    commentUpdate.mockClear();
    commentFindMany.mockClear();
    commentFindMany.mockResolvedValue([commentRow]);
    commentFindUniqueOrThrow.mockClear();
    commentFindUniqueOrThrow.mockResolvedValue(commentRow);
    feedbackFindUniqueOrThrow.mockClear();
    feedbackFindUniqueOrThrow.mockResolvedValue(feedbackRow);
    queryRawMock.mockClear();
    transactionMock.mockClear();
    appendModerationActionMock.mockClear();
    latestActionsForMock.mockClear();
    latestActionsForMock.mockResolvedValue([moderationActionRow]);
    latestEffectiveRemoveForMock.mockClear();
    latestEffectiveRemoveForMock.mockResolvedValue(null);
    resolveHintsForIdentityMock.mockClear();
    resolveHintsForIdentityMock.mockResolvedValue([]);
    realmMembershipForPolicyMock.mockClear();
    realmMembershipForPolicyMock.mockResolvedValue(null);
    enqueueMock.mockClear();
    broadcastMock.mockClear();
    fakeDrizzleDb.select.mockClear();
    queueDrizzleSelectResults();
  });

  test("writes platform unit snapshot and ledger action in one transaction", async () => {
    const service = await newService();

    await service.setUnitModerationStatus({
      unitId: "post-1",
      actorUserId: "staff-1",
      action: "remove",
      reasonCode: "policy.violation",
      reasonText: "abuse",
      caseId: "case-1",
      requestId: "req-1",
      idempotencyKey: "req-1:post-1:remove",
    });

    expect(unitUpdate).toHaveBeenCalledWith({
      where: { id: "post-1" },
      data: { moderationStatus: "REMOVED" },
    });
    expect(appendModerationActionMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        authority: "PLATFORM",
        targetKind: "UNIT",
        targetId: "post-1",
        actorUserId: "staff-1",
        actionKind: "REMOVE",
        resultingStatus: "REMOVED",
        reasonCode: "policy.violation",
        caseId: "case-1",
        requestId: "req-1",
        idempotencyKey: "req-1:post-1:remove",
      }),
    );
    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.content.sync",
      "search.post.sync",
    ]);
  });

  test("writes realm unit snapshot and realm-authority ledger action", async () => {
    const service = await newService();

    const result = await service.setRealmUnitModerationStatus({
      realmUnitId: "realm-1",
      unitId: "post-1",
      actorUserId: "mod-1",
      action: "restore",
      reasonCode: "appeal.approved",
      reasonText: "appeal approved",
      caseId: "realm-case-1",
    });

    expect(unitRealmUpdate).toHaveBeenCalledWith({
      where: {
        realmUnitId_unitId: { realmUnitId: "realm-1", unitId: "post-1" },
      },
      data: { moderationStatus: "APPROVED" },
    });
    expect(appendModerationActionMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        authority: "REALM",
        realmUnitId: "realm-1",
        targetKind: "UNIT_REALM",
        targetId: "post-1",
        actionKind: "RESTORE",
        resultingStatus: "APPROVED",
      }),
    );
    expect(result).toMatchObject({
      realmUnitId: "realm-1",
      unitId: "post-1",
      moderationStatus: "approved",
    });
    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.content.patchRealmIds",
      "search.post.sync",
    ]);
  });

  test("sets locks through typed ledger actions", async () => {
    const service = await newService();

    await service.setLock({
      targetKind: "POST",
      targetId: "post-1",
      isLocked: true,
      actorUserId: "staff-1",
      reasonCode: "thread.locked",
      reasonText: "cooldown",
      caseId: "case-1",
    });

    expect(postUpdate).toHaveBeenCalledWith({
      where: { unitId: "post-1" },
      data: { isLocked: true },
    });
    expect(appendModerationActionMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        authority: "PLATFORM",
        targetKind: "UNIT",
        targetId: "post-1",
        actionKind: "LOCK",
        resultingLocked: true,
      }),
    );
  });

  test("creates platform cases from polymorphic feedback and records a note action", async () => {
    const service = await newService();

    const result = await service.createCaseFromFeedback({
      feedbackId: "feedback-1",
      actorUserId: "staff-1",
      severity: "high",
      reason: "policy review needed",
      safeSummary: "Reported post",
      metadata: { source: "report" },
    });

    expect(moderationCaseFindFirst).toHaveBeenCalledWith({
      where: { sourceFeedbackId: "feedback-1", scope: "PLATFORM" },
      orderBy: { createdAt: "asc" },
    });
    expect(moderationCaseCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scope: "PLATFORM",
        state: "NEW",
        targetKind: "UNIT",
        targetId: "post-1",
        addressedUnitId: "post-1",
        sourceFeedbackId: "feedback-1",
        metadata: { source: "report", feedbackType: "REPORT" },
      }),
    });
    expect(appendModerationActionMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        caseId: "case-1",
        targetKind: "UNIT",
        targetId: "post-1",
        actionKind: "NOTE",
        reasonCode: "case.created_from_report",
      }),
    );
    expect(result).toMatchObject({
      id: "case-1",
      scope: "platform",
      target: { kind: "unit", id: "post-1" },
    });
    expect(broadcastMock).toHaveBeenCalledWith({
      kind: "moderation.report.updated",
      sourceUnitId: "post-1",
      directRecipients: ["reporter-1"],
      actorId: "staff-1",
      extra: { caseId: "case-1", state: "NEW" },
    });
  });

  test("reuses existing platform and realm cases for duplicate feedback", async () => {
    const service = await newService();
    moderationCaseFindFirst.mockResolvedValueOnce({
      ...moderationCaseRow,
      id: "case-existing",
    });

    const platform = await service.createCaseFromFeedback({
      feedbackId: "feedback-1",
      actorUserId: "staff-1",
    });

    expect(platform.id).toBe("case-existing");
    expect(feedbackFindUniqueOrThrow).not.toHaveBeenCalled();
    expect(moderationCaseCreate).not.toHaveBeenCalled();

    moderationCaseFindFirst.mockResolvedValueOnce({
      ...realmCaseRow,
      id: "realm-case-existing",
    });
    const realm = await service.createRealmCaseFromFeedback({
      realmUnitId: "realm-1",
      feedbackId: "feedback-1",
      actorUserId: "mod-1",
    });

    expect(realm.id).toBe("realm-case-existing");
    expect(moderationCaseFindFirst).toHaveBeenLastCalledWith({
      where: {
        scope: "REALM",
        realmUnitId: "realm-1",
        sourceFeedbackId: "feedback-1",
      },
      orderBy: { createdAt: "asc" },
    });
  });

  test("decides realm cases with local snapshot action and workflow note", async () => {
    const service = await newService();
    moderationCaseFindUniqueOrThrow.mockResolvedValueOnce(realmCaseRow);
    moderationCaseUpdate.mockResolvedValueOnce({
      ...realmCaseRow,
      state: "ACTIONED",
      reason: "fits the realm",
    });

    const result = await service.decideRealmCase({
      realmUnitId: "realm-1",
      caseId: "realm-case-1",
      actorUserId: "mod-1",
      decisionKind: "approve_for_realm",
      reason: "fits the realm",
    });

    expect(moderationCaseUpdate).toHaveBeenCalledWith({
      where: { id: "realm-case-1" },
      data: expect.objectContaining({
        state: "ACTIONED",
        reason: "fits the realm",
      }),
    });
    expect(unitRealmUpdate).toHaveBeenCalledWith({
      where: {
        realmUnitId_unitId: { realmUnitId: "realm-1", unitId: "post-1" },
      },
      data: { moderationStatus: "APPROVED" },
    });
    expect(
      appendModerationActionMock.mock.calls.map((call) => call[1].actionKind),
    ).toEqual(["APPROVE", "NOTE"]);
    expect(result).toMatchObject({ id: "realm-case-1", state: "actioned" });
    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.content.patchRealmIds",
      "search.post.sync",
    ]);
  });

  test("escalates realm cases by linking a platform case through parentCaseId", async () => {
    const service = await newService();
    moderationCaseFindUniqueOrThrow.mockResolvedValueOnce(realmCaseRow);
    moderationCaseCreate.mockResolvedValueOnce({
      ...moderationCaseRow,
      id: "platform-case-1",
      scope: "PLATFORM",
      state: "ESCALATED",
      realmUnitId: "realm-1",
    });
    moderationCaseUpdate.mockResolvedValueOnce({
      ...realmCaseRow,
      state: "ESCALATED",
      parentCaseId: "platform-case-1",
      reason: "site review needed",
    });

    const result = await service.escalateRealmCase({
      realmUnitId: "realm-1",
      caseId: "realm-case-1",
      actorUserId: "mod-1",
      reason: "site review needed",
      safeSummary: "Escalated report",
    });

    expect(moderationCaseCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scope: "PLATFORM",
        state: "ESCALATED",
        metadata: { escalatedFromRealmCaseId: "realm-case-1" },
      }),
    });
    expect(moderationCaseUpdate).toHaveBeenCalledWith({
      where: { id: "realm-case-1" },
      data: expect.objectContaining({
        state: "ESCALATED",
        parentCaseId: "platform-case-1",
      }),
    });
    expect(
      appendModerationActionMock.mock.calls.map((call) => call[1].reasonCode),
    ).toEqual(["case.escalated_from_realm_case", "realm.case.escalated"]);
    expect(result).toMatchObject({
      id: "realm-case-1",
      state: "escalated",
      parentCaseId: "platform-case-1",
    });
    expect(broadcastMock).toHaveBeenCalledWith({
      kind: "moderation.escalation.updated",
      sourceUnitId: "post-1",
      directRecipients: ["reporter-1"],
      actorId: "mod-1",
      extra: { caseId: "realm-case-1", parentCaseId: "platform-case-1" },
    });
  });

  test("lists case and target actions from the ledger", async () => {
    const service = await newService();
    queueDrizzleSelectResults([moderationActionRow], [moderationActionRow]);

    const byCase = await service.listCaseActions("case-1", {
      offset: 5,
      limit: 10,
    });
    const byTarget = await service.listTargetActions("UNIT", "post-1", {
      limit: 3,
    });

    expect(fakeDrizzleDb.select).toHaveBeenCalledTimes(2);
    expect(byCase[0]).toMatchObject({ id: "action-1", actionKind: "remove" });
    expect(byTarget[0]).toMatchObject({
      targetKind: "unit",
      targetId: "post-1",
    });
  });

  test("returns moderation overlays from snapshots and latest actions", async () => {
    const service = await newService();
    queueDrizzleSelectResults([unitRow]);

    const result = await service.listModerationOverlays({
      targetKind: "unit",
      targetIds: ["post-1", "post-1"],
    });

    expect(fakeDrizzleDb.select).toHaveBeenCalledTimes(1);
    expect(latestActionsForMock).toHaveBeenCalledWith({
      targetKind: "UNIT",
      targetIds: ["post-1"],
      realmUnitId: null,
    });
    expect(result).toEqual([
      {
        id: "post-1",
        moderationStatus: "approved",
        latestAction: expect.objectContaining({
          id: "action-1",
          actionKind: "remove",
        }),
      },
    ]);
  });

  test("resolves comment moderation authority by platform, realm, then owner", async () => {
    const service = await newService();
    resolveHintsForIdentityMock.mockResolvedValueOnce([
      { capability: "comment.moderate", scope: { kind: "global" } },
    ]);

    await expect(
      service.resolveCommentModerationAuthority(
        { userId: "staff-1", permission: { role: "ADMIN" } },
        commentRow,
      ),
    ).resolves.toBe("PLATFORM");

    realmMembershipForPolicyMock.mockResolvedValueOnce({
      capabilities: [
        {
          capability: "queue.realm.decide",
          scope: { kind: "realm", realmUnitId: "realm-1" },
        },
      ],
    });
    await expect(
      service.resolveCommentModerationAuthority(
        { userId: "mod-1", permission: { role: "USER" } },
        commentRow,
      ),
    ).resolves.toBe("REALM");

    await expect(
      service.resolveCommentModerationAuthority(
        { userId: "maintainer-1", permission: { role: "USER" } },
        commentRow,
      ),
    ).resolves.toBe("OWNER");
  });

  test("moderates comments with authority precedence and redaction search sync", async () => {
    const service = await newService();
    resolveHintsForIdentityMock.mockResolvedValue([
      { capability: "comment.moderate", scope: { kind: "global" } },
    ]);
    latestEffectiveRemoveForMock.mockResolvedValueOnce({
      id: "remove-1",
      authority: "REALM",
    });

    await service.moderateComment({
      commentId: "comment-1",
      actorUserId: "staff-1",
      identity: { userId: "staff-1", permission: { role: "ADMIN" } },
      action: "restore",
      reasonCode: "appeal.approved",
      reasonText: "appeal approved",
      caseId: "case-1",
    });

    expect(queryRawMock).toHaveBeenCalled();
    expect(commentUpdate).toHaveBeenCalledWith({
      where: { id: "comment-1" },
      data: { moderationStatus: "APPROVED" },
    });
    expect(appendModerationActionMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        authority: "PLATFORM",
        targetKind: "COMMENT",
        targetId: "comment-1",
        actionKind: "RESTORE",
        resultingStatus: "APPROVED",
        reversesActionId: "remove-1",
      }),
    );
    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.comment.sync",
    ]);

    resolveHintsForIdentityMock.mockResolvedValue([]);
    latestEffectiveRemoveForMock.mockResolvedValueOnce({
      id: "remove-2",
      authority: "PLATFORM",
    });
    await expect(
      service.moderateComment({
        commentId: "comment-1",
        actorUserId: "maintainer-1",
        identity: { userId: "maintainer-1", permission: { role: "USER" } },
        action: "restore",
        reasonCode: "appeal.denied",
      }),
    ).rejects.toThrow("higher authority");
  });
});
