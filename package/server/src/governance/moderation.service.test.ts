import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";

installPrismaClientMock();

const now = new Date("2026-05-28T00:00:00.000Z");
const contentModerationUpsert = mock(async ({ create, update }: any) => ({
  moderatedUnitId: create?.moderatedUnitId ?? "post-1",
  ...(update ?? create),
  createdAt: now,
  updatedAt: now,
}));
const contentModerationFindUnique = mock(async () => null);
const contentModerationFindMany = mock(async () => [
  {
    moderatedUnitId: "reply-1",
    state: "HIDDEN",
    decidedById: "staff-1",
    caseId: null,
    reason: "abuse",
    metadata: null,
    createdAt: now,
    updatedAt: now,
  },
]);
const postFindUnique = mock(
  async (): Promise<{ parentPostUnitId: string | null }> => ({
    parentPostUnitId: null,
  }),
);
const unitRealmRow = {
  realmUnitId: "realm-1",
  unitId: "reply-1",
  moderationState: "APPROVED",
  visibilityState: "TOMBSTONED",
  isLocked: false,
  createdAt: now,
};
const unitRealmFindMany = mock(async () => [unitRealmRow]);
const unitRealmUpdate = mock(async (args: any) => ({
  ...unitRealmRow,
  unitId: args.where?.realmUnitId_unitId?.unitId ?? unitRealmRow.unitId,
  realmUnitId:
    args.where?.realmUnitId_unitId?.realmUnitId ?? unitRealmRow.realmUnitId,
  ...args.data,
}));
const unitRealmFindUnique = mock(
  async (): Promise<any> => ({
    ...unitRealmRow,
    unitId: "post-1",
    moderationState: "PENDING_REVIEW",
    visibilityState: "VISIBLE",
  }),
);
const realmMemberDelete = mock(async () => undefined);
const realmQueueRow = {
  id: "queue-1",
  realmUnitId: "realm-1",
  state: "NEW",
  reporterUserId: "reporter-1",
  subjectUserId: "subject-1",
  targetKind: "unit",
  targetId: "post-1",
  addressedUnitId: "post-1",
  sourceFeedbackId: "feedback-1",
  linkedCaseId: null,
  assignedToUserId: null,
  reason: "reported",
  safeSummary: null,
  metadata: null,
  createdAt: now,
  updatedAt: now,
};
const realmQueueCreate = mock(async ({ data }: any) => ({
  ...realmQueueRow,
  ...data,
  createdAt: now,
  updatedAt: now,
}));
const realmQueueFindMany = mock(async () => [realmQueueRow]);
const realmQueueFindFirst = mock(async (): Promise<any> => null);
const realmQueueFindUniqueOrThrow = mock(async () => realmQueueRow);
const realmQueueUpdate = mock(async ({ data }: any) => ({
  ...realmQueueRow,
  ...data,
  updatedAt: now,
}));
const realmModerationEventCreate = mock(async ({ data }: any) => ({
  id: "realm-event-1",
  ...data,
  createdAt: now,
}));
const realmModerationEventFindMany = mock(async () => [
  {
    id: "realm-event-1",
    queueItemId: "queue-1",
    realmUnitId: "realm-1",
    actorUserId: "mod-1",
    decisionKind: "hide_from_realm",
    decision: null,
    decisionCode: null,
    reason: "off-topic",
    before: null,
    after: null,
    createdAt: now,
  },
]);
const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
const broadcastMock = mock(async (_event: any) => ({ ok: true, persisted: 1 }));
const staffAuditLogCreate = mock(async ({ data }: any) => ({
  id: "audit-1",
  ...data,
  createdAt: now,
}));
const moderationCaseRow = {
  id: "case-1",
  state: "NEW",
  severity: null,
  reporterUserId: "reporter-1",
  subjectUserId: null,
  targetKind: "unit",
  targetId: "post-1",
  addressedUnitId: "post-1",
  realmUnitId: null,
  sourceFeedbackId: "feedback-1",
  assignedToUserId: null,
  duplicateOfCaseId: null,
  reason: "reported",
  safeSummary: null,
  metadata: null,
  createdAt: now,
  updatedAt: now,
};
const moderationCaseFindFirst = mock(async (): Promise<any> => null);
const moderationCaseFindMany = mock(async () => [moderationCaseRow]);
const moderationCaseFindUniqueOrThrow = mock(async () => moderationCaseRow);
const moderationCaseCreate = mock(async ({ data }: any) => ({
  ...moderationCaseRow,
  ...data,
  id: "case-1",
  createdAt: now,
  updatedAt: now,
}));
const moderationCaseUpdate = mock(async ({ data }: any) => ({
  ...moderationCaseRow,
  ...data,
  updatedAt: now,
}));
const moderationCaseEventCreate = mock(async ({ data }: any) => ({
  id: "event-1",
  ...data,
  createdAt: now,
}));
const moderationCaseEventFindMany = mock(async () => [
  {
    id: "event-1",
    caseId: "case-1",
    actorUserId: "staff-1",
    eventType: "case.created_from_report",
    decision: null,
    decisionCode: null,
    reason: "reported",
    before: null,
    after: null,
    reversible: false,
    createdAt: now,
  },
]);
const feedbackFindUniqueOrThrow = mock(async () => ({
  id: "feedback-1",
  userId: "reporter-1",
  unitId: "post-1",
  url: null,
  content: "reported",
  type: "REPORT",
  resolved: false,
  resolvedAt: null,
  createdAt: now,
  updatedAt: now,
}));
const transactionMock = mock(async (fn: any) =>
  fn({
    moderationCase: {
      create: moderationCaseCreate,
      findUniqueOrThrow: moderationCaseFindUniqueOrThrow,
      update: moderationCaseUpdate,
    },
    moderationCaseEvent: {
      create: moderationCaseEventCreate,
    },
    contentModerationState: {
      findUnique: contentModerationFindUnique,
      upsert: contentModerationUpsert,
    },
    realmModerationQueueItem: {
      create: realmQueueCreate,
      findUniqueOrThrow: realmQueueFindUniqueOrThrow,
      update: realmQueueUpdate,
    },
    realmModerationEvent: {
      create: realmModerationEventCreate,
    },
    unitRealm: {
      findUnique: unitRealmFindUnique,
      findMany: unitRealmFindMany,
      update: unitRealmUpdate,
    },
    realmMember: {
      delete: realmMemberDelete,
    },
    staffAuditLog: {
      create: staffAuditLogCreate,
    },
  }),
);

Object.assign(prismaMock, {
  $transaction: transactionMock,
  contentModerationState: {
    findMany: contentModerationFindMany,
    findUnique: contentModerationFindUnique,
    upsert: contentModerationUpsert,
  },
  post: {
    findUnique: postFindUnique,
  },
  unitRealm: {
    findUnique: unitRealmFindUnique,
    findMany: unitRealmFindMany,
    update: unitRealmUpdate,
  },
  realmModerationQueueItem: {
    create: realmQueueCreate,
    findMany: realmQueueFindMany,
    findFirst: realmQueueFindFirst,
    findUniqueOrThrow: realmQueueFindUniqueOrThrow,
    update: realmQueueUpdate,
  },
  realmModerationEvent: {
    findMany: realmModerationEventFindMany,
  },
  moderationCase: {
    findFirst: moderationCaseFindFirst,
    findMany: moderationCaseFindMany,
    findUniqueOrThrow: moderationCaseFindUniqueOrThrow,
  },
  moderationCaseEvent: {
    findMany: moderationCaseEventFindMany,
  },
  feedback: {
    findUniqueOrThrow: feedbackFindUniqueOrThrow,
  },
  staffAuditLog: {
    create: staffAuditLogCreate,
  },
});

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

mock.module("@/notify-boundary/notify-boundary.client", () => ({
  broadcast: broadcastMock,
}));

describe("GovernanceModerationService content moderation state", () => {
  beforeEach(() => {
    contentModerationFindUnique.mockClear();
    contentModerationFindUnique.mockResolvedValue(null);
    contentModerationFindMany.mockClear();
    contentModerationUpsert.mockClear();
    postFindUnique.mockClear();
    postFindUnique.mockResolvedValue({ parentPostUnitId: null });
    unitRealmFindUnique.mockClear();
    unitRealmFindUnique.mockResolvedValue({
      ...unitRealmRow,
      unitId: "post-1",
      moderationState: "PENDING_REVIEW",
      visibilityState: "VISIBLE",
    });
    unitRealmFindMany.mockClear();
    unitRealmFindMany.mockResolvedValue([unitRealmRow]);
    unitRealmUpdate.mockClear();
    realmMemberDelete.mockClear();
    realmQueueCreate.mockClear();
    realmQueueFindMany.mockClear();
    realmQueueFindFirst.mockClear();
    realmQueueFindFirst.mockResolvedValue(null);
    realmQueueFindUniqueOrThrow.mockClear();
    realmQueueUpdate.mockClear();
    realmModerationEventCreate.mockClear();
    realmModerationEventFindMany.mockClear();
    enqueueMock.mockClear();
    broadcastMock.mockClear();
    staffAuditLogCreate.mockClear();
    moderationCaseFindFirst.mockClear();
    moderationCaseFindMany.mockClear();
    moderationCaseFindUniqueOrThrow.mockClear();
    moderationCaseCreate.mockClear();
    moderationCaseUpdate.mockClear();
    moderationCaseEventCreate.mockClear();
    moderationCaseEventFindMany.mockClear();
    feedbackFindUniqueOrThrow.mockClear();
    transactionMock.mockClear();
  });

  test("upserts global content moderation state", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    const result = await governanceModerationService.setGlobalContentState({
      moderatedUnitId: "reply-1",
      state: "hidden",
      decidedById: "staff-1",
      reason: "abuse",
    });

    expect(contentModerationUpsert).toHaveBeenCalledWith({
      where: { moderatedUnitId: "reply-1" },
      create: expect.objectContaining({
        moderatedUnitId: "reply-1",
        state: "HIDDEN",
        decidedById: "staff-1",
        reason: "abuse",
      }),
      update: expect.objectContaining({
        state: "HIDDEN",
        decidedById: "staff-1",
        reason: "abuse",
      }),
    });
    expect(result).toMatchObject({
      moderatedUnitId: "reply-1",
      state: "hidden",
      decidedByUserId: "staff-1",
      reason: "abuse",
    });
    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.content.sync",
      "search.post.sync",
    ]);
  });

  test("moderates the requested unit without following Unit.targetUnitId", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    await governanceModerationService.setGlobalContentState({
      moderatedUnitId: "post-1",
      state: "hidden",
      decidedById: "staff-1",
      reason: "abuse",
    });

    expect(contentModerationUpsert).toHaveBeenCalledWith({
      where: { moderatedUnitId: "post-1" },
      create: expect.objectContaining({
        moderatedUnitId: "post-1",
        state: "HIDDEN",
      }),
      update: expect.objectContaining({
        state: "HIDDEN",
      }),
    });
  });

  test("lists global content states bounded to requested node ids", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    const result = await governanceModerationService.listGlobalContentStates([
      "reply-1",
      "reply-1",
      "reply-2",
    ]);

    expect(contentModerationFindMany).toHaveBeenCalledWith({
      where: { moderatedUnitId: { in: ["reply-1", "reply-2"] } },
      orderBy: { updatedAt: "desc" },
    });
    expect(result).toMatchObject([
      {
        moderatedUnitId: "reply-1",
        state: "hidden",
        decidedByUserId: "staff-1",
      },
    ]);
  });

  test("lists realm Unit states bounded to requested node ids", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    const result = await governanceModerationService.listRealmUnitStates({
      realmUnitId: "realm-1",
      unitIds: ["reply-1", "reply-1", "reply-2"],
    });

    expect(unitRealmFindMany).toHaveBeenCalledWith({
      where: {
        realmUnitId: "realm-1",
        unitId: { in: ["reply-1", "reply-2"] },
      },
      orderBy: { createdAt: "desc" },
    });
    expect(result).toEqual([
      {
        realmUnitId: "realm-1",
        unitId: "reply-1",
        moderationState: "approved",
        visibilityState: "tombstoned",
        isLocked: false,
        createdAt: now,
      },
    ]);
  });

  test("updates sparse realm Unit visibility by realm and target", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    const result =
      await governanceModerationService.setRealmUnitVisibilityState({
        realmUnitId: "realm-1",
        moderatedUnitId: "reply-1",
        state: "tombstoned",
        decidedById: "mod-1",
        reason: "off-topic",
      });

    expect(unitRealmUpdate).toHaveBeenCalledWith({
      where: {
        realmUnitId_unitId: {
          realmUnitId: "realm-1",
          unitId: "reply-1",
        },
      },
      data: { visibilityState: "TOMBSTONED" },
    });
    expect(result).toMatchObject({
      realmUnitId: "realm-1",
      unitId: "reply-1",
      visibilityState: "tombstoned",
    });
    expect(contentModerationUpsert).not.toHaveBeenCalled();
    expect(enqueueMock).toHaveBeenCalled();
  });

  test("restore helpers keep reversible visible state rows", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    await governanceModerationService.restoreGlobal({
      moderatedUnitId: "reply-1",
      decidedById: "staff-1",
      reason: "appeal approved",
    });
    await governanceModerationService.restoreInRealm({
      realmUnitId: "realm-1",
      moderatedUnitId: "reply-1",
      decidedById: "mod-1",
      reason: "appeal approved",
    });

    expect(contentModerationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ state: "VISIBLE" }),
      }),
    );
    expect(unitRealmUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { visibilityState: "VISIBLE" } }),
    );
  });

  test("records case event history for global content hide decisions", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    await governanceModerationService.hideGlobal({
      moderatedUnitId: "reply-1",
      decidedById: "staff-1",
      reason: "abuse",
      caseId: "case-1",
    });

    expect(contentModerationFindUnique).toHaveBeenCalledWith({
      where: { moderatedUnitId: "reply-1" },
    });
    expect(contentModerationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          state: "HIDDEN",
          caseId: "case-1",
          reason: "abuse",
        }),
      }),
    );
    expect(moderationCaseEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        caseId: "case-1",
        actorUserId: "staff-1",
        eventType: "content.hidden",
        reason: "abuse",
        before: null,
        after: {
          state: "HIDDEN",
          reason: "abuse",
          moderatedUnitId: "reply-1",
        },
        reversible: true,
      }),
    });
    expect(staffAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "staff-1",
        action: "content.moderation.state_changed",
        targetKind: "content",
        targetId: "reply-1",
        reason: "abuse",
        requestId: "case-1",
      }),
    });
  });

  test("records case event history for realm content restore decisions", async () => {
    unitRealmFindUnique.mockResolvedValueOnce({
      ...unitRealmRow,
      unitId: "reply-1",
      visibilityState: "HIDDEN",
    });
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    await governanceModerationService.restoreInRealm({
      realmUnitId: "realm-1",
      moderatedUnitId: "reply-1",
      decidedById: "mod-2",
      reason: "appeal approved",
      caseId: "case-1",
    });

    expect(unitRealmFindUnique).toHaveBeenCalledWith({
      where: {
        realmUnitId_unitId: {
          realmUnitId: "realm-1",
          unitId: "reply-1",
        },
      },
    });
    expect(moderationCaseEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        caseId: "case-1",
        actorUserId: "mod-2",
        eventType: "realm_content.restored",
        reason: "appeal approved",
        before: {
          state: "HIDDEN",
          reason: "appeal approved",
          moderatedUnitId: "reply-1",
          realmUnitId: "realm-1",
        },
        after: {
          state: "VISIBLE",
          reason: "appeal approved",
          moderatedUnitId: "reply-1",
          realmUnitId: "realm-1",
        },
        reversible: false,
      }),
    });
  });

  test("realm content removal marks UnitRealm relation removed", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    await expect(
      governanceModerationService.removeFromRealm({
        realmUnitId: "realm-1",
        moderatedUnitId: "post-1",
        decidedById: "mod-1",
        reason: "off-topic",
      }),
    ).resolves.toEqual({
      realmUnitId: "realm-1",
      unitId: "post-1",
      moderationState: "removed",
      visibilityState: "tombstoned",
      isLocked: false,
      createdAt: now,
    });

    expect(unitRealmUpdate).toHaveBeenCalledWith({
      where: {
        realmUnitId_unitId: { realmUnitId: "realm-1", unitId: "post-1" },
      },
      data: { moderationState: "REMOVED" },
    });
    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.content.patchRealmIds",
      "search.post.sync",
    ]);
  });

  test("realm content removal does not inspect Post reply topology", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    await expect(
      governanceModerationService.removeFromRealm({
        realmUnitId: "realm-1",
        moderatedUnitId: "post-1",
        decidedById: "mod-1",
        reason: "off-topic",
      }),
    ).resolves.toMatchObject({
      realmUnitId: "realm-1",
      unitId: "post-1",
      moderationState: "removed",
    });

    expect(postFindUnique).not.toHaveBeenCalled();
    expect(unitRealmUpdate).toHaveBeenCalledWith({
      where: {
        realmUnitId_unitId: { realmUnitId: "realm-1", unitId: "post-1" },
      },
      data: { moderationState: "REMOVED" },
    });
  });

  test("owner delegation creates a realm queue item instead of state mutation", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    const result = await governanceModerationService.requestOwnerDelegation({
      realmUnitId: "realm-1",
      moderatedUnitId: "reply-1",
      decidedById: "mod-1",
      reason: "please remove",
    });

    expect(realmQueueCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        realmUnitId: "realm-1",
        state: "NEW",
        targetKind: "content-owner-delegation",
        targetId: "reply-1",
        addressedUnitId: "reply-1",
        assignedToUserId: "mod-1",
        reason: "please remove",
        metadata: { ownerDelegation: true },
      }),
    });
    expect(result).toMatchObject({
      id: "queue-1",
      realmUnitId: "realm-1",
      target: { kind: "content-owner-delegation", id: "reply-1" },
    });
  });

  test("creates realm queue items with an intake event", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    const result = await governanceModerationService.createRealmQueueItem({
      realmUnitId: "realm-1",
      actorUserId: "mod-1",
      reporterUserId: "reporter-1",
      subjectUserId: "subject-1",
      targetKind: "unit",
      targetId: "post-1",
      addressedUnitId: "post-1",
      reason: "reported",
    });

    expect(realmQueueCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        realmUnitId: "realm-1",
        state: "NEW",
        reporterUserId: "reporter-1",
        subjectUserId: "subject-1",
        targetKind: "unit",
        targetId: "post-1",
        addressedUnitId: "post-1",
        reason: "reported",
      }),
    });
    expect(realmModerationEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        queueItemId: "queue-1",
        realmUnitId: "realm-1",
        actorUserId: "mod-1",
        decisionKind: null,
        reason: "reported",
        after: {
          state: "NEW",
          targetKind: "unit",
          targetId: "post-1",
          addressedUnitId: "post-1",
        },
      }),
    });
    expect(result).toMatchObject({
      id: "queue-1",
      realmUnitId: "realm-1",
      state: "new",
    });
    expect(broadcastMock).toHaveBeenCalledWith({
      kind: "moderation.report.updated",
      sourceUnitId: "post-1",
      directRecipients: ["reporter-1"],
      actorId: "mod-1",
      extra: { queueItemId: "queue-1", state: "NEW" },
    });
  });

  test("creates realm queue items from feedback and reuses duplicates", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    await governanceModerationService.createRealmQueueItemFromFeedback({
      realmUnitId: "realm-1",
      feedbackId: "feedback-1",
      actorUserId: "mod-1",
    });

    expect(realmQueueFindFirst).toHaveBeenCalledWith({
      where: { realmUnitId: "realm-1", sourceFeedbackId: "feedback-1" },
      orderBy: { createdAt: "asc" },
    });
    expect(feedbackFindUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "feedback-1" },
    });
    expect(realmQueueCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        realmUnitId: "realm-1",
        reporterUserId: "reporter-1",
        targetKind: "unit",
        targetId: "post-1",
        addressedUnitId: "post-1",
        sourceFeedbackId: "feedback-1",
        reason: "reported",
      }),
    });

    realmQueueFindFirst.mockResolvedValueOnce({
      ...realmQueueRow,
      id: "queue-existing",
    });
    const existing =
      await governanceModerationService.createRealmQueueItemFromFeedback({
        realmUnitId: "realm-1",
        feedbackId: "feedback-1",
        actorUserId: "mod-1",
      });
    expect(existing.id).toBe("queue-existing");
  });

  test("decides realm queue items with local sanctions and events", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    const result = await governanceModerationService.decideRealmQueueItem({
      realmUnitId: "realm-1",
      queueItemId: "queue-1",
      actorUserId: "mod-1",
      decisionKind: "hide_from_realm",
      reason: "off-topic",
    });

    expect(realmQueueUpdate).toHaveBeenCalledWith({
      where: { id: "queue-1" },
      data: expect.objectContaining({
        state: "ACTIONED",
        reason: "off-topic",
      }),
    });
    expect(unitRealmUpdate).toHaveBeenCalledWith({
      where: {
        realmUnitId_unitId: {
          realmUnitId: "realm-1",
          unitId: "post-1",
        },
      },
      data: { visibilityState: "HIDDEN" },
    });
    expect(realmModerationEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        queueItemId: "queue-1",
        realmUnitId: "realm-1",
        actorUserId: "mod-1",
        decisionKind: "hide_from_realm",
        reason: "off-topic",
        after: expect.objectContaining({ state: "ACTIONED" }),
      }),
    });
    expect(result).toMatchObject({ state: "actioned" });
    expect(broadcastMock).toHaveBeenCalledWith({
      kind: "moderation.report.updated",
      sourceUnitId: "post-1",
      directRecipients: ["reporter-1"],
      actorId: "mod-1",
      extra: { queueItemId: "queue-1", state: "ACTIONED" },
    });
  });

  test("approves and rejects realm submissions through UnitRealm moderation state", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    await governanceModerationService.decideRealmQueueItem({
      realmUnitId: "realm-1",
      queueItemId: "queue-1",
      actorUserId: "mod-1",
      decisionKind: "approve_for_realm",
      reason: "fits the realm",
    });

    expect(unitRealmUpdate).toHaveBeenCalledWith({
      where: {
        realmUnitId_unitId: { realmUnitId: "realm-1", unitId: "post-1" },
      },
      data: { moderationState: "APPROVED" },
    });
    expect(realmModerationEventCreate).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        decisionKind: "approve_for_realm",
        before: expect.objectContaining({
          moderationState: "PENDING_REVIEW",
        }),
        after: expect.objectContaining({
          moderationState: "APPROVED",
        }),
      }),
    });

    unitRealmUpdate.mockClear();
    realmModerationEventCreate.mockClear();

    await governanceModerationService.decideRealmQueueItem({
      realmUnitId: "realm-1",
      queueItemId: "queue-1",
      actorUserId: "mod-1",
      decisionKind: "reject_from_realm",
      reason: "off-topic",
    });

    expect(unitRealmUpdate).toHaveBeenCalledWith({
      where: {
        realmUnitId_unitId: { realmUnitId: "realm-1", unitId: "post-1" },
      },
      data: { moderationState: "REJECTED" },
    });
    expect(realmQueueUpdate).toHaveBeenLastCalledWith({
      where: { id: "queue-1" },
      data: expect.objectContaining({ state: "REJECTED" }),
    });
    expect(realmModerationEventCreate).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        decisionKind: "reject_from_realm",
        before: expect.objectContaining({
          moderationState: "PENDING_REVIEW",
        }),
        after: expect.objectContaining({
          moderationState: "REJECTED",
        }),
      }),
    });
  });

  test("escalates realm queue items into site moderation cases", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    const result = await governanceModerationService.escalateRealmQueueItem({
      realmUnitId: "realm-1",
      queueItemId: "queue-1",
      actorUserId: "mod-1",
      reason: "site review needed",
      safeSummary: "Escalated report",
    });

    expect(moderationCaseCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        state: "ESCALATED",
        reporterUserId: "reporter-1",
        subjectUserId: "subject-1",
        targetKind: "unit",
        targetId: "post-1",
        addressedUnitId: "post-1",
        realmUnitId: "realm-1",
        sourceFeedbackId: "feedback-1",
        reason: "site review needed",
        safeSummary: "Escalated report",
      }),
    });
    expect(realmQueueUpdate).toHaveBeenCalledWith({
      where: { id: "queue-1" },
      data: expect.objectContaining({
        state: "ESCALATED",
        linkedCaseId: "case-1",
        reason: "site review needed",
      }),
    });
    expect(moderationCaseEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        caseId: "case-1",
        actorUserId: "mod-1",
        eventType: "case.escalated_from_realm_queue",
      }),
    });
    expect(result).toMatchObject({
      state: "escalated",
      linkedCaseId: "case-1",
    });
    expect(broadcastMock).toHaveBeenCalledWith({
      kind: "moderation.escalation.updated",
      sourceUnitId: "post-1",
      directRecipients: ["reporter-1"],
      actorId: "mod-1",
      extra: { queueItemId: "queue-1", linkedCaseId: "case-1" },
    });
    expect(staffAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "mod-1",
        action: "realm.moderation.escalated",
        targetKind: "realm-moderation-queue",
        targetId: "queue-1",
        requestId: "case-1",
      }),
    });
  });

  test("lists moderation case events", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    const result = await governanceModerationService.listCaseEvents("case-1", {
      offset: 5,
      limit: 10,
    });

    expect(moderationCaseEventFindMany).toHaveBeenCalledWith({
      where: { caseId: "case-1" },
      orderBy: { createdAt: "asc" },
      skip: 5,
      take: 10,
    });
    expect(result).toEqual([
      {
        id: "event-1",
        caseId: "case-1",
        actorUserId: "staff-1",
        eventType: "case.created_from_report",
        decision: null,
        reason: "reported",
        before: undefined,
        after: undefined,
        reversible: false,
        createdAt: "2026-05-28T00:00:00.000Z",
      },
    ]);
  });

  test("creates moderation cases from report feedback and records an event", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    const result = await governanceModerationService.createCaseFromFeedback({
      feedbackId: "feedback-1",
      actorUserId: "staff-1",
      severity: "high",
      reason: "policy review needed",
      safeSummary: "Reported post",
      metadata: { source: "report" },
    });

    expect(moderationCaseFindFirst).toHaveBeenCalledWith({
      where: { sourceFeedbackId: "feedback-1" },
      orderBy: { createdAt: "asc" },
    });
    expect(feedbackFindUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "feedback-1" },
    });
    expect(moderationCaseCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        state: "NEW",
        severity: "high",
        reporterUserId: "reporter-1",
        targetKind: "unit",
        targetId: "post-1",
        addressedUnitId: "post-1",
        sourceFeedbackId: "feedback-1",
        reason: "policy review needed",
        safeSummary: "Reported post",
        metadata: { source: "report", feedbackType: "REPORT" },
      }),
    });
    expect(moderationCaseEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        caseId: "case-1",
        actorUserId: "staff-1",
        eventType: "case.created_from_report",
        reason: "policy review needed",
        after: { sourceFeedbackId: "feedback-1", addressedUnitId: "post-1" },
      }),
    });
    expect(result).toMatchObject({
      id: "case-1",
      state: "new",
      severity: "high",
      reporterUserId: "reporter-1",
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

  test("returns the existing moderation case for duplicate report feedback", async () => {
    moderationCaseFindFirst.mockResolvedValueOnce({
      ...moderationCaseRow,
      id: "case-existing",
    });
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    const result = await governanceModerationService.createCaseFromFeedback({
      feedbackId: "feedback-1",
      actorUserId: "staff-1",
    });

    expect(result.id).toBe("case-existing");
    expect(feedbackFindUniqueOrThrow).not.toHaveBeenCalled();
    expect(moderationCaseCreate).not.toHaveBeenCalled();
    expect(moderationCaseEventCreate).not.toHaveBeenCalled();
  });

  test("links duplicate cases and records before and after state", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    const result = await governanceModerationService.duplicateCase({
      caseId: "case-1",
      duplicateOfCaseId: "case-root",
      actorUserId: "staff-1",
      reason: "same target",
    });

    expect(moderationCaseUpdate).toHaveBeenCalledWith({
      where: { id: "case-1" },
      data: {
        state: "DUPLICATE",
        duplicateOfCaseId: "case-root",
        reason: "same target",
      },
    });
    expect(moderationCaseEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        caseId: "case-1",
        actorUserId: "staff-1",
        eventType: "case.duplicate_linked",
        reason: "same target",
        before: { state: "NEW", duplicateOfCaseId: null },
        after: { state: "DUPLICATE", duplicateOfCaseId: "case-root" },
      }),
    });
    expect(result).toMatchObject({
      id: "case-1",
      state: "duplicate",
      duplicateOfCaseId: "case-root",
    });
  });

  test("assigns and triages moderation cases", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    await governanceModerationService.assignCase({
      caseId: "case-1",
      actorUserId: "staff-1",
      assignedToUserId: "staff-2",
      reason: "handoff",
    });
    await governanceModerationService.triageCase({
      caseId: "case-1",
      actorUserId: "staff-1",
      severity: "medium",
      assignedToUserId: null,
      reason: "needs review",
      safeSummary: "Public summary",
    });

    expect(moderationCaseUpdate.mock.calls[0]?.[0]).toEqual({
      where: { id: "case-1" },
      data: { state: "ASSIGNED", assignedToUserId: "staff-2" },
    });
    expect(moderationCaseUpdate.mock.calls[1]?.[0]).toEqual({
      where: { id: "case-1" },
      data: {
        state: "TRIAGED",
        severity: "medium",
        assignedToUserId: null,
        reason: "needs review",
        safeSummary: "Public summary",
      },
    });
    expect(
      moderationCaseEventCreate.mock.calls.map(
        (call) => call[0].data.eventType,
      ),
    ).toEqual(["case.assigned", "case.triaged"]);
    expect(broadcastMock).toHaveBeenCalledWith({
      kind: "moderation.case.assigned",
      sourceUnitId: "post-1",
      directRecipients: ["staff-2"],
      actorId: "staff-1",
      extra: { caseId: "case-1", state: "ASSIGNED" },
    });
  });

  test("records decisions and appeal requests as case events", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    await governanceModerationService.decideCase({
      caseId: "case-1",
      actorUserId: "staff-1",
      state: "actioned",
      reason: "violation confirmed",
      decision: { allowed: true, code: "ALLOWED" },
    });
    await governanceModerationService.appealCase({
      caseId: "case-1",
      actorUserId: "staff-1",
      reason: "appeal received",
    });

    expect(moderationCaseUpdate.mock.calls[0]?.[0]).toEqual({
      where: { id: "case-1" },
      data: { state: "ACTIONED", reason: "violation confirmed" },
    });
    expect(moderationCaseUpdate.mock.calls[1]?.[0]).toEqual({
      where: { id: "case-1" },
      data: { state: "NEW" },
    });
    expect(moderationCaseEventCreate.mock.calls[0]?.[0]).toEqual({
      data: expect.objectContaining({
        eventType: "case.decided",
        reason: "violation confirmed",
        decision: { allowed: true, code: "ALLOWED" },
        decisionCode: "ALLOWED",
        reversible: true,
        before: { state: "NEW" },
        after: { state: "ACTIONED" },
      }),
    });
    expect(moderationCaseEventCreate.mock.calls[1]?.[0]).toEqual({
      data: expect.objectContaining({
        eventType: "case.appeal_requested",
        reason: "appeal received",
        before: { state: "NEW" },
        after: { state: "NEW" },
      }),
    });
    expect(broadcastMock).toHaveBeenCalledWith({
      kind: "moderation.report.updated",
      sourceUnitId: "post-1",
      directRecipients: ["reporter-1"],
      actorId: "staff-1",
      extra: { caseId: "case-1", state: "ACTIONED" },
    });
    expect(staffAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "staff-1",
        action: "moderation.case.decided",
        targetKind: "moderation-case",
        targetId: "case-1",
        requestId: "case-1",
      }),
    });
    expect(broadcastMock).toHaveBeenCalledWith({
      kind: "moderation.appeal.updated",
      sourceUnitId: "post-1",
      directRecipients: ["reporter-1"],
      actorId: "staff-1",
      extra: { caseId: "case-1", state: "NEW" },
    });
  });
});
