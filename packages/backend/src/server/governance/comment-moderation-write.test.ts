import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Comment, Unit, UnitCollaborator } from "../db/schema";

const enqueueMock = mock(async (_command: unknown) => ({ status: "created" }));
const broadcastMock = mock(async () => ({ ok: true }));

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

mock.module("@/notify-boundary/notify-boundary.client", () => ({
  broadcast: broadcastMock,
  filterRecipientsByPreference: mock(async (recipients: unknown) => recipients),
  resolveRecipients: mock(
    async (event: { directRecipients?: string[] }) =>
      event.directRecipients ?? [],
  ),
  sendDm: mock(async () => ({ ok: true })),
}));

mock.module("../realm/realm.mapper", () => ({
  mapRealmListRowToDTO: mock((row: unknown) => row),
  mapRealmMemberToDTO: mock((row: unknown) => row),
  mapRealmTagApplicationToDTO: mock((row: unknown) => row),
  mapRealmTagContextToDTO: mock((row: unknown) => row),
  mapRealmToDTO: mock((row: unknown) => row),
  mapUnitRealmToDTO: mock((row: any) => ({
    ...row,
    moderationStatus:
      typeof row?.moderationStatus === "string"
        ? row.moderationStatus.toLowerCase()
        : row?.moderationStatus,
  })),
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

let activeTx: ReturnType<typeof installTx>["tx"] | null = null;

const dbTransactionMock = mock(async (fn: any) => {
  if (!activeTx) throw new Error("Test transaction not installed");
  return fn(activeTx);
});

mock.module("../db/client", () => ({
  db: {
    transaction: dbTransactionMock,
  },
}));

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
  const execute = mock(async () => []);
  const updateReturning = mock(async (data: Record<string, unknown>) => [
    { ...comment, ...data },
  ]);
  const updateSet = mock((data: Record<string, unknown>) => ({
    where: mock(() => ({
      returning: mock(() => updateReturning(data)),
    })),
  }));
  const update = mock(() => ({
    set: updateSet,
  }));
  const select = mock((selection?: Record<string, unknown>) => {
    let table: unknown;
    const query = {
      from: mock((nextTable: unknown) => {
        table = nextTable;
        return query;
      }),
      where: mock(() => query),
      limit: mock(() => query),
      // biome-ignore lint/suspicious/noThenProperty: Drizzle test double must be awaitable.
      ["then"](
        resolve: (value: unknown[]) => void,
        reject?: (reason: unknown) => void,
      ) {
        try {
          if (table === Comment) {
            resolve([comment]);
            return;
          }
          if (table === Unit) {
            resolve(
              comment.rootUnit
                ? [{ userId: comment.rootUnit.userId ?? null }]
                : [],
            );
            return;
          }
          if (table === UnitCollaborator) {
            resolve(comment.rootUnit?.collaborators ?? []);
            return;
          }
          resolve(selection ? [{}] : []);
        } catch (error) {
          reject?.(error);
        }
      },
    };
    return query;
  });
  const tx = {
    execute,
    select,
    update,
  };
  activeTx = tx;
  return { execute, update, updateReturning, updateSet, tx };
}

describe("GovernanceModerationService.moderateComment", () => {
  beforeEach(() => {
    enqueueMock.mockClear();
    dbTransactionMock.mockClear();
    activeTx = null;
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

    expect(tx.execute).toHaveBeenCalled();
    expect(tx.updateSet).toHaveBeenCalledWith({
      moderationStatus: "REMOVED",
      updatedAt: expect.any(Date),
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
    expect(dbTransactionMock).not.toHaveBeenCalled();
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

    expect(tx.updateSet).toHaveBeenCalledWith({
      isLocked: true,
      updatedAt: expect.any(Date),
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
    expect(tx.updateSet).not.toHaveBeenCalled();
    expect(actionService.appendModerationAction).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });
});
