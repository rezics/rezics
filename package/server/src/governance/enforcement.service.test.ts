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
  auditLogId: null,
  metadata: data.metadata,
  createdAt: new Date("2026-05-28T00:00:00.000Z"),
  updatedAt: new Date("2026-05-28T00:00:00.000Z"),
}));
const userFindUnique = mock(async () => ({ authUserId: "auth-user-1" }));
const revokeAuthSessionsForAuthUser = mock(async () => ({
  ok: true,
  revokedSessions: 2,
}));

Object.assign(prismaMock, {
  accountEnforcement: {
    findMany: accountEnforcementFindMany,
    create: accountEnforcementCreate,
  },
  user: {
    findUnique: userFindUnique,
  },
});

mock.module("../auth-boundary/auth-internal.client", () => ({
  revokeAuthSessionsForAuthUser,
}));

describe("GovernanceEnforcementService", () => {
  beforeEach(() => {
    accountEnforcementFindMany.mockClear();
    accountEnforcementFindMany.mockResolvedValue([]);
    accountEnforcementCreate.mockClear();
    userFindUnique.mockClear();
    userFindUnique.mockResolvedValue({ authUserId: "auth-user-1" });
    revokeAuthSessionsForAuthUser.mockClear();
    revokeAuthSessionsForAuthUser.mockResolvedValue({
      ok: true,
      revokedSessions: 2,
    });
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
});
