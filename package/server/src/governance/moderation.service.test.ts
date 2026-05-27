import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";

installPrismaClientMock();

const now = new Date("2026-05-28T00:00:00.000Z");
const contentModerationUpsert = mock(async ({ create, update }: any) => ({
  targetUnitId: create?.targetUnitId ?? "post-1",
  ...(update ?? create),
  createdAt: now,
  updatedAt: now,
}));
const contentModerationFindUnique = mock(async () => null);
const contentModerationFindMany = mock(async () => [
  {
    targetUnitId: "reply-1",
    state: "HIDDEN",
    decidedById: "staff-1",
    caseId: null,
    reason: "abuse",
    metadata: null,
    createdAt: now,
    updatedAt: now,
  },
]);
const realmContentModerationUpsert = mock(async ({ create, update }: any) => ({
  realmUnitId: create?.realmUnitId ?? "realm-1",
  targetUnitId: create?.targetUnitId ?? "reply-1",
  ...(update ?? create),
  createdAt: now,
  updatedAt: now,
}));
const realmContentModerationFindMany = mock(async () => [
  {
    realmUnitId: "realm-1",
    targetUnitId: "reply-1",
    state: "TOMBSTONED",
    decidedById: "mod-1",
    caseId: null,
    reason: "off-topic",
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
const unitRealmDelete = mock(async () => undefined);
const realmQueueCreate = mock(async ({ data }: any) => ({
  id: "queue-1",
  realmUnitId: data.realmUnitId,
  state: data.state,
  reporterUserId: null,
  subjectUserId: null,
  targetKind: data.targetKind,
  targetId: data.targetId,
  targetUnitId: data.targetUnitId,
  sourceFeedbackId: null,
  linkedCaseId: null,
  assignedToUserId: data.assignedToUserId,
  reason: data.reason,
  safeSummary: null,
  metadata: data.metadata,
  createdAt: now,
  updatedAt: now,
}));
const enqueueMock = mock(async (_command: any) => ({ status: "created" }));

Object.assign(prismaMock, {
  contentModerationState: {
    findMany: contentModerationFindMany,
    findUnique: contentModerationFindUnique,
    upsert: contentModerationUpsert,
  },
  realmContentModeration: {
    findMany: realmContentModerationFindMany,
    upsert: realmContentModerationUpsert,
  },
  post: {
    findUnique: postFindUnique,
  },
  unitRealm: {
    delete: unitRealmDelete,
  },
  realmModerationQueueItem: {
    create: realmQueueCreate,
  },
});

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

describe("GovernanceModerationService content moderation state", () => {
  beforeEach(() => {
    contentModerationFindUnique.mockClear();
    contentModerationFindMany.mockClear();
    contentModerationUpsert.mockClear();
    realmContentModerationFindMany.mockClear();
    realmContentModerationUpsert.mockClear();
    postFindUnique.mockClear();
    postFindUnique.mockResolvedValue({ parentPostUnitId: null });
    unitRealmDelete.mockClear();
    realmQueueCreate.mockClear();
    enqueueMock.mockClear();
  });

  test("upserts global content moderation state", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    const result = await governanceModerationService.setGlobalContentState({
      targetUnitId: "reply-1",
      state: "hidden",
      decidedById: "staff-1",
      reason: "abuse",
    });

    expect(contentModerationUpsert).toHaveBeenCalledWith({
      where: { targetUnitId: "reply-1" },
      create: expect.objectContaining({
        targetUnitId: "reply-1",
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
      targetUnitId: "reply-1",
      state: "hidden",
      decidedByUserId: "staff-1",
      reason: "abuse",
    });
    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.content.sync",
      "search.post.sync",
    ]);
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
      where: { targetUnitId: { in: ["reply-1", "reply-2"] } },
      orderBy: { updatedAt: "desc" },
    });
    expect(result).toMatchObject([
      {
        targetUnitId: "reply-1",
        state: "hidden",
        decidedByUserId: "staff-1",
      },
    ]);
  });

  test("lists realm overlays bounded to requested node ids", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    const result = await governanceModerationService.listRealmContentOverlays({
      realmUnitId: "realm-1",
      targetUnitIds: ["reply-1", "reply-1", "reply-2"],
    });

    expect(realmContentModerationFindMany).toHaveBeenCalledWith({
      where: {
        realmUnitId: "realm-1",
        targetUnitId: { in: ["reply-1", "reply-2"] },
      },
      orderBy: { updatedAt: "desc" },
    });
    expect(result).toEqual([
      {
        realmUnitId: "realm-1",
        targetUnitId: "reply-1",
        state: "tombstoned",
        decidedByUserId: "mod-1",
        caseId: null,
        reason: "off-topic",
        metadata: undefined,
        createdAt: "2026-05-28T00:00:00.000Z",
        updatedAt: "2026-05-28T00:00:00.000Z",
      },
    ]);
  });

  test("upserts sparse realm content overlay by realm and target", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    const result = await governanceModerationService.setRealmContentOverlay({
      realmUnitId: "realm-1",
      targetUnitId: "reply-1",
      state: "tombstoned",
      decidedById: "mod-1",
      reason: "off-topic",
    });

    expect(realmContentModerationUpsert).toHaveBeenCalledWith({
      where: {
        realmUnitId_targetUnitId: {
          realmUnitId: "realm-1",
          targetUnitId: "reply-1",
        },
      },
      create: expect.objectContaining({
        realmUnitId: "realm-1",
        targetUnitId: "reply-1",
        state: "TOMBSTONED",
      }),
      update: expect.objectContaining({
        state: "TOMBSTONED",
        decidedById: "mod-1",
      }),
    });
    expect(result).toMatchObject({
      realmUnitId: "realm-1",
      targetUnitId: "reply-1",
      state: "tombstoned",
    });
    expect(contentModerationUpsert).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  test("restore helpers keep reversible visible state rows", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    await governanceModerationService.restoreGlobal({
      targetUnitId: "reply-1",
      decidedById: "staff-1",
      reason: "appeal approved",
    });
    await governanceModerationService.restoreInRealm({
      realmUnitId: "realm-1",
      targetUnitId: "reply-1",
      decidedById: "mod-1",
      reason: "appeal approved",
    });

    expect(contentModerationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ state: "VISIBLE" }),
      }),
    );
    expect(realmContentModerationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ state: "VISIBLE" }),
      }),
    );
  });

  test("realm feed removal uses junction drop for roots", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    await expect(
      governanceModerationService.removeRootFromRealm({
        realmUnitId: "realm-1",
        targetUnitId: "post-1",
      }),
    ).resolves.toEqual({ message: "Content removed from realm feed" });

    expect(unitRealmDelete).toHaveBeenCalledWith({
      where: {
        realmUnitId_unitId: { realmUnitId: "realm-1", unitId: "post-1" },
      },
    });
    expect(realmContentModerationUpsert).not.toHaveBeenCalled();
    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.content.patchRealmIds",
      "search.post.sync",
    ]);
  });

  test("realm feed removal rejects reply nodes", async () => {
    postFindUnique.mockResolvedValueOnce({ parentPostUnitId: "post-1" });
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    await expect(
      governanceModerationService.removeRootFromRealm({
        realmUnitId: "realm-1",
        targetUnitId: "reply-1",
      }),
    ).rejects.toThrow("Realm feed removal only applies to thread roots");

    expect(unitRealmDelete).not.toHaveBeenCalled();
  });

  test("owner delegation creates a realm queue item instead of state mutation", async () => {
    const { governanceModerationService } = await import(
      "./moderation.service"
    );

    const result = await governanceModerationService.requestOwnerDelegation({
      realmUnitId: "realm-1",
      targetUnitId: "reply-1",
      decidedById: "mod-1",
      reason: "please remove",
    });

    expect(realmQueueCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        realmUnitId: "realm-1",
        state: "NEW",
        targetKind: "content-owner-delegation",
        targetId: "reply-1",
        targetUnitId: "reply-1",
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
});
