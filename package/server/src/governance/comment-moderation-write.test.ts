import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";

installPrismaClientMock();

const enqueueMock = mock(async () => ({ status: "created" }));
const broadcastMock = mock(async () => ({ ok: true }));

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

mock.module("@/notify-boundary/notify-boundary.client", () => ({
  broadcast: broadcastMock,
}));

const identity = {
  userId: "actor-1",
  permission: { role: "USER" as const },
};

const baseComment = {
  id: "comment-1",
  rootUnitId: "post-1",
  realmUnitId: null,
  moderationStatus: "APPROVED",
  isLocked: false,
  rootUnit: {
    userId: "actor-1",
    collaborators: [],
  },
};

function capabilities(input: { realm?: boolean } = {}) {
  return {
    resolveHintsForIdentity: mock(async () => []),
    realmMembershipForPolicy: mock(async (realmUnitId: string) =>
      input.realm
        ? {
            realmUnitId,
            role: "moderator",
            capabilities: [
              {
                capability: "comment.moderate",
                scope: { kind: "realm", realmUnitId },
              },
            ],
          }
        : null,
    ),
  };
}

function actions(input: { latestRemove?: any } = {}) {
  return {
    latestEffectiveRemoveFor: mock(async () => input.latestRemove ?? null),
    appendModerationAction: mock(async (_tx: any, data: any) => ({
      id: "action-1",
      ...data,
    })),
  };
}

function installTx(comment: any) {
  const queryRaw = mock(async () => []);
  const findUniqueOrThrow = mock(async () => comment);
  const update = mock(async ({ data }: any) => ({ ...comment, ...data }));
  const tx = {
    $queryRaw: queryRaw,
    comment: { findUniqueOrThrow, update },
    moderationAction: {},
  };
  const transaction = mock(async (fn: any) => fn(tx));
  prismaMock.$transaction = transaction;
  return { transaction, queryRaw, findUniqueOrThrow, update, tx };
}

describe("GovernanceModerationService.moderateComment", () => {
  beforeEach(() => {
    enqueueMock.mockClear();
    delete prismaMock.$transaction;
  });

  test("owner removal updates the snapshot and appends one comment ledger action", async () => {
    const tx = installTx(baseComment);
    const actionService = actions();
    const { GovernanceModerationService } = await import(
      "./moderation.service"
    );
    const service = new GovernanceModerationService(
      actionService as never,
      capabilities() as never,
    );

    const result = await service.moderateComment({
      commentId: "comment-1",
      actorUserId: "actor-1",
      identity,
      action: "remove",
      reasonCode: "comment.abuse",
      reasonText: "abuse",
      requestId: "request-1",
      idempotencyKey: "request-1:comment-1:remove",
    });

    expect(tx.queryRaw).toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalledWith({
      where: { id: "comment-1" },
      data: { moderationStatus: "REMOVED" },
    });
    expect(actionService.appendModerationAction).toHaveBeenCalledWith(tx.tx, {
      authority: "OWNER",
      realmUnitId: null,
      targetKind: "COMMENT",
      targetId: "comment-1",
      actorKind: "USER",
      actorUserId: "actor-1",
      actionKind: "REMOVE",
      resultingStatus: "REMOVED",
      resultingLocked: undefined,
      reasonCode: "comment.abuse",
      reasonText: "abuse",
      publicMessage: undefined,
      caseId: undefined,
      reversesActionId: null,
      requestId: "request-1",
      idempotencyKey: "request-1:comment-1:remove",
    });
    expect(enqueueMock.mock.calls[0]?.[0]).toMatchObject({
      kind: "search.comment.sync",
      payload: { commentId: "comment-1" },
    });
    expect(result.moderationStatus).toBe("REMOVED");
  });

  test("rejects actor and identity mismatches before opening a transaction", async () => {
    const actionService = actions();
    const { GovernanceModerationService } = await import(
      "./moderation.service"
    );
    const service = new GovernanceModerationService(
      actionService as never,
      capabilities() as never,
    );

    await expect(
      service.moderateComment({
        commentId: "comment-1",
        actorUserId: "other-user",
        identity,
        action: "remove",
        reasonCode: "comment.abuse",
      }),
    ).rejects.toThrow(/actor must match identity/);
    expect(prismaMock.$transaction).toBeUndefined();
  });

  test("realm lock writes locked snapshot state and a realm authority action", async () => {
    const tx = installTx({
      ...baseComment,
      realmUnitId: "realm-1",
      rootUnit: { userId: "owner-1", collaborators: [] },
    });
    const actionService = actions();
    const { GovernanceModerationService } = await import(
      "./moderation.service"
    );
    const service = new GovernanceModerationService(
      actionService as never,
      capabilities({ realm: true }) as never,
    );

    await service.moderateComment({
      commentId: "comment-1",
      actorUserId: "actor-1",
      identity,
      action: "lock",
      reasonCode: "comment.locked",
    });

    expect(tx.update).toHaveBeenCalledWith({
      where: { id: "comment-1" },
      data: { isLocked: true },
    });
    expect(actionService.appendModerationAction).toHaveBeenCalledWith(
      tx.tx,
      expect.objectContaining({
        authority: "REALM",
        realmUnitId: "realm-1",
        actionKind: "LOCK",
        resultingLocked: true,
      }),
    );
  });

  test("lower authority cannot restore a platform removal", async () => {
    const tx = installTx(baseComment);
    const actionService = actions({
      latestRemove: {
        id: "platform-remove-1",
        authority: "PLATFORM",
      },
    });
    const { GovernanceModerationService } = await import(
      "./moderation.service"
    );
    const service = new GovernanceModerationService(
      actionService as never,
      capabilities() as never,
    );

    await expect(
      service.moderateComment({
        commentId: "comment-1",
        actorUserId: "actor-1",
        identity,
        action: "restore",
        reasonCode: "comment.restore",
      }),
    ).rejects.toThrow(/higher authority/);
    expect(tx.update).not.toHaveBeenCalled();
    expect(actionService.appendModerationAction).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });
});
