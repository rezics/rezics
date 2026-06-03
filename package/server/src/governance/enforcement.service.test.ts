import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";

installPrismaClientMock();

const accountEnforcementFindMany = mock(async (): Promise<any[]> => []);
const accountEnforcementCreate = mock(async ({ data }: any) => ({
  id: "enforcement-1",
  targetUserId: data.targetUserId,
  kind: data.kind,
  state: "ACTIVE",
  reason: data.reason,
  safeMessage: data.safeMessage,
  decidedById: data.decidedById,
  decisionCode: data.decisionCode,
  startsAt: new Date("2026-05-28T00:00:00.000Z"),
  expiresAt: data.expiresAt,
  revokedAt: null,
  decisionActionId: null,
  revocationActionId: null,
  metadata: data.metadata,
  createdAt: new Date("2026-05-28T00:00:00.000Z"),
  updatedAt: new Date("2026-05-28T00:00:00.000Z"),
}));
const accountEnforcementUpdate = mock(async ({ data, where }: any) => ({
  id: where.id,
  targetUserId: "user-1",
  kind: "BAN",
  state: data.state ?? (data.revocationActionId ? "REVOKED" : "ACTIVE"),
  reason: "abuse",
  safeMessage: data.safeMessage,
  decidedById: "staff-1",
  decisionCode: "ALLOWED",
  startsAt: new Date("2026-05-28T00:00:00.000Z"),
  expiresAt: null,
  revokedAt: data.revokedAt,
  decisionActionId: data.decisionActionId ?? null,
  revocationActionId: data.revocationActionId ?? null,
  metadata: data.metadata ?? {
    authBoundary: {
      sessionRevocation: {
        attempted: true,
        ok: true,
        revokedSessions: 2,
      },
    },
  },
  createdAt: new Date("2026-05-28T00:00:00.000Z"),
  updatedAt: new Date("2026-05-28T00:00:00.000Z"),
}));
const moderationActionCreate = mock(async ({ data }: any) => ({
  id: "action-1",
  ...data,
  createdAt: new Date("2026-05-28T00:00:00.000Z"),
}));
const moderationActionFindUnique = mock(async () => null);
const transactionMock = mock(async (fn: any) =>
  fn({
    accountEnforcement: {
      create: accountEnforcementCreate,
      update: accountEnforcementUpdate,
    },
    moderationAction: {
      create: moderationActionCreate,
      findUnique: moderationActionFindUnique,
    },
  }),
);
const userFindUnique = mock(async () => ({ authUserId: "auth-user-1" }));
const revokeAuthSessionsForAuthUser = mock(async () => ({
  ok: true,
  revokedSessions: 2,
}));
const broadcastMock = mock(async (_event: any) => ({ ok: true, persisted: 1 }));
const staffAuditLogCreate = mock(async ({ data }: any) => ({
  id: "audit-1",
  ...data,
  createdAt: new Date("2026-05-28T00:00:00.000Z"),
}));

Object.assign(prismaMock, {
  $transaction: transactionMock,
  accountEnforcement: {
    findMany: accountEnforcementFindMany,
    create: accountEnforcementCreate,
    update: accountEnforcementUpdate,
  },
  user: {
    findUnique: userFindUnique,
  },
  staffAuditLog: {
    create: staffAuditLogCreate,
  },
});

mock.module("../auth-boundary/auth-internal.client", () => ({
  revokeAuthSessionsForAuthUser,
}));

mock.module("@/notify-boundary/notify-boundary.client", () => ({
  broadcast: broadcastMock,
}));

describe("GovernanceEnforcementService", () => {
  beforeEach(() => {
    accountEnforcementFindMany.mockClear();
    accountEnforcementFindMany.mockResolvedValue([]);
    accountEnforcementCreate.mockClear();
    accountEnforcementUpdate.mockClear();
    moderationActionCreate.mockClear();
    moderationActionFindUnique.mockClear();
    transactionMock.mockClear();
    userFindUnique.mockClear();
    userFindUnique.mockResolvedValue({ authUserId: "auth-user-1" });
    revokeAuthSessionsForAuthUser.mockClear();
    revokeAuthSessionsForAuthUser.mockResolvedValue({
      ok: true,
      revokedSessions: 2,
    });
    broadcastMock.mockClear();
    staffAuditLogCreate.mockClear();
  });

  test("projects BLOCKED from an active ban enforcement", async () => {
    accountEnforcementFindMany.mockResolvedValueOnce([
      {
        kind: "BAN",
        expiresAt: null,
        createdAt: new Date("2026-05-28T00:00:00.000Z"),
      },
    ]);

    const { governanceEnforcementService } = await import(
      "./enforcement.service"
    );
    await expect(
      governanceEnforcementService.projectedPermissionForUser("user-1", {
        role: ["MEMBER"],
      }),
    ).resolves.toEqual({ role: "BLOCKED" });
  });

  test("downgrades stale stored BLOCKED when no active ban exists", async () => {
    const { governanceEnforcementService } = await import(
      "./enforcement.service"
    );
    await expect(
      governanceEnforcementService.projectedPermissionForUser("user-1", {
        role: ["BLOCKED"],
      }),
    ).resolves.toEqual({ role: "MEMBER" });
  });

  test("preserves non-blocked stored roles", async () => {
    const { governanceEnforcementService } = await import(
      "./enforcement.service"
    );
    await expect(
      governanceEnforcementService.projectedPermissionForUser("user-1", {
        role: ["ADMIN"],
      }),
    ).resolves.toEqual({ role: "ADMIN" });
  });

  test("revokes auth sessions when creating a ban enforcement", async () => {
    const { governanceEnforcementService } = await import(
      "./enforcement.service"
    );

    const created = await governanceEnforcementService.ban("user-1", {
      reason: "abuse",
      decidedById: "staff-1",
      decisionCode: "ALLOWED",
    });

    expect(revokeAuthSessionsForAuthUser).toHaveBeenCalledWith({
      authUserId: "auth-user-1",
      reason: "abuse",
    });
    expect(accountEnforcementCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        targetUserId: "user-1",
        kind: "BAN",
        metadata: expect.objectContaining({
          authBoundary: {
            sessionRevocation: {
              attempted: true,
              ok: true,
              revokedSessions: 2,
            },
          },
        }),
      }),
    });
    expect(created.metadata).toMatchObject({
      authBoundary: {
        sessionRevocation: {
          attempted: true,
          ok: true,
          revokedSessions: 2,
        },
      },
    });
  });

  test("records moderation actions for reversible account enforcement decisions", async () => {
    const { governanceEnforcementService } = await import(
      "./enforcement.service"
    );

    await governanceEnforcementService.silence("user-1", {
      reason: "spam",
      decidedById: "staff-1",
      decisionCode: "ALLOWED",
      caseId: "case-1",
    });

    expect(moderationActionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        authority: "PLATFORM",
        targetKind: "ACCOUNT",
        targetId: "user-1",
        caseId: "case-1",
        actionKind: "SILENCE",
        actorUserId: "staff-1",
        reasonCode: "ALLOWED",
        reasonText: "spam",
      }),
    });
    expect(accountEnforcementUpdate).toHaveBeenLastCalledWith({
      where: { id: "enforcement-1" },
      data: { decisionActionId: "action-1" },
    });
    expect(broadcastMock).not.toHaveBeenCalled();
    expect(staffAuditLogCreate).not.toHaveBeenCalled();
  });

  test("notifies subjects for warning enforcement", async () => {
    const { governanceEnforcementService } = await import(
      "./enforcement.service"
    );

    await governanceEnforcementService.warn("user-1", {
      reason: "rule reminder",
      decidedById: "staff-1",
      decisionCode: "ALLOWED",
    });

    expect(broadcastMock).toHaveBeenCalledWith({
      kind: "moderation.subject.warning",
      sourceUnitId: "user-1",
      directRecipients: ["user-1"],
      actorId: "staff-1",
      extra: { enforcementId: "enforcement-1", reason: "rule reminder" },
    });
  });

  test("records moderation actions when account enforcement is revoked", async () => {
    accountEnforcementFindMany.mockResolvedValueOnce([
      {
        id: "enforcement-1",
        targetUserId: "user-1",
        kind: "BAN",
        state: "ACTIVE",
        reason: "abuse",
        safeMessage: null,
        decidedById: "staff-1",
        decisionCode: "ALLOWED",
        startsAt: new Date("2026-05-28T00:00:00.000Z"),
        expiresAt: null,
        revokedAt: null,
        decisionActionId: "action-apply",
        revocationActionId: null,
        metadata: null,
        createdAt: new Date("2026-05-28T00:00:00.000Z"),
        updatedAt: new Date("2026-05-28T00:00:00.000Z"),
      },
    ]);
    const { governanceEnforcementService } = await import(
      "./enforcement.service"
    );

    await governanceEnforcementService.unblock("user-1", {
      reason: "appeal approved",
      revokedById: "staff-2",
      caseId: "case-1",
    });

    expect(accountEnforcementUpdate).toHaveBeenCalledWith({
      where: { id: "enforcement-1" },
      data: expect.objectContaining({
        state: "REVOKED",
        revokedById: "staff-2",
        metadata: { unblockReason: "appeal approved" },
      }),
    });
    expect(moderationActionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        authority: "PLATFORM",
        targetKind: "ACCOUNT",
        targetId: "user-1",
        caseId: "case-1",
        actionKind: "REVOKE_ENFORCEMENT",
        actorUserId: "staff-2",
        reasonCode: "account.enforcement.revoked",
        reasonText: "appeal approved",
        reversesActionId: "action-apply",
      }),
    });
    expect(broadcastMock).toHaveBeenCalledWith({
      kind: "moderation.appeal.updated",
      sourceUnitId: "user-1",
      directRecipients: ["user-1"],
      actorId: "staff-2",
      extra: { enforcementId: "enforcement-1", state: "REVOKED" },
    });
    expect(staffAuditLogCreate).not.toHaveBeenCalled();
  });
});
