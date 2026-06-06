import { beforeEach, describe, expect, mock, test } from "bun:test";
import type {
  GovernanceEnforcementRepository,
  GovernanceEnforcementService,
} from "./enforcement.service";

const revokeAuthSessionsForAuthUser = mock(async () => ({
  ok: true,
  revokedSessions: 2,
}));
const broadcastMock = mock(async (_event: any) => ({ ok: true, persisted: 1 }));

mock.module("../auth-boundary/auth-internal.client", () => ({
  revokeAuthSessionsForAuthUser,
}));

mock.module("../notify-boundary/notify-boundary.client", () => ({
  broadcast: broadcastMock,
  filterRecipientsByPreference: mock(async (recipients: unknown) => recipients),
  notifySystemAndEmail: mock(async () => ({ ok: true })),
  resolveRecipients: mock(
    async (event: { directRecipients?: string[] }) =>
      event.directRecipients ?? [],
  ),
  sendDm: mock(async () => ({ ok: true })),
}));

const baseDate = new Date("2026-05-28T00:00:00.000Z");

function enforcementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "enforcement-1",
    targetUserId: "user-1",
    kind: "BAN",
    state: "ACTIVE",
    reason: "abuse",
    safeMessage: null,
    decidedById: "staff-1",
    decisionCode: "ALLOWED",
    startsAt: baseDate,
    expiresAt: null,
    revokedAt: null,
    revokedById: null,
    decisionActionId: null,
    revocationActionId: null,
    metadata: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  } as any;
}

function createRepository() {
  const repository: GovernanceEnforcementRepository = {
    listActive: mock(async () => []),
    list: mock(async () => []),
    getAuthUserId: mock(async () => "auth-user-1"),
    create: mock(async (input) => {
      const created = enforcementRow({
        kind: input.kind.toUpperCase(),
        reason: input.reason,
        safeMessage: input.safeMessage ?? null,
        decidedById: input.decidedById,
        decisionCode: input.decisionCode,
        expiresAt: input.expiresAt ?? null,
        metadata: input.metadata ?? null,
      });
      const action = await input.appendAction({} as never, created);
      return enforcementRow({
        ...created,
        decisionActionId: action.id,
      });
    }),
    revokeActive: mock(async (input) => {
      const row = enforcementRow({ decisionActionId: "action-apply" });
      const action = await input.appendAction({} as never, row);
      return [
        enforcementRow({
          ...row,
          state: "REVOKED",
          revokedAt: input.now,
          revokedById: input.revokedById,
          safeMessage: input.safeMessage ?? row.safeMessage,
          metadata: { unblockReason: input.reason, ...(input.metadata ?? {}) },
          revocationActionId: action.id,
        }),
      ];
    }),
  };
  return repository;
}

function createActionService() {
  return {
    appendModerationAction: mock(async (_tx: unknown, input: any) => ({
      id:
        input.actionKind === "REVOKE_ENFORCEMENT"
          ? "action-revoke"
          : "action-apply",
      ...input,
      createdAt: baseDate,
    })),
  } as any;
}

describe("GovernanceEnforcementService", () => {
  let repository: GovernanceEnforcementRepository;
  let actionService: ReturnType<typeof createActionService>;
  let service: GovernanceEnforcementService;

  beforeEach(async () => {
    const { GovernanceEnforcementService } = await import(
      "./enforcement.service"
    );
    repository = createRepository();
    actionService = createActionService();
    service = new GovernanceEnforcementService(repository, actionService);
    revokeAuthSessionsForAuthUser.mockClear();
    revokeAuthSessionsForAuthUser.mockResolvedValue({
      ok: true,
      revokedSessions: 2,
    });
    broadcastMock.mockClear();
  });

  test("projects BLOCKED from an active ban enforcement", async () => {
    (repository.listActive as any).mockResolvedValueOnce([
      enforcementRow({ kind: "BAN" }),
    ]);

    await expect(
      service.projectedPermissionForUser("user-1", { role: ["MEMBER"] }),
    ).resolves.toEqual({ role: "BLOCKED" });
  });

  test("downgrades stale stored BLOCKED when no active ban exists", async () => {
    await expect(
      service.projectedPermissionForUser("user-1", { role: ["BLOCKED"] }),
    ).resolves.toEqual({ role: "MEMBER" });
  });

  test("preserves non-blocked stored roles", async () => {
    await expect(
      service.projectedPermissionForUser("user-1", { role: ["ADMIN"] }),
    ).resolves.toEqual({ role: "ADMIN" });
  });

  test("revokes auth sessions when creating a ban enforcement", async () => {
    const created = await service.ban("user-1", {
      reason: "abuse",
      decidedById: "staff-1",
      decisionCode: "ALLOWED",
    });

    expect(revokeAuthSessionsForAuthUser).toHaveBeenCalledWith({
      authUserId: "auth-user-1",
      reason: "abuse",
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUserId: "user-1",
        kind: "ban",
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
    );
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
    await service.silence("user-1", {
      reason: "spam",
      decidedById: "staff-1",
      decisionCode: "ALLOWED",
      caseId: "case-1",
    });

    expect(actionService.appendModerationAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        authority: "PLATFORM",
        targetKind: "ACCOUNT",
        targetId: "user-1",
        caseId: "case-1",
        actionKind: "SILENCE",
        actorUserId: "staff-1",
        reasonCode: "ALLOWED",
        reasonText: "spam",
      }),
    );
    expect(broadcastMock).not.toHaveBeenCalled();
  });

  test("notifies subjects for warning enforcement", async () => {
    await service.warn("user-1", {
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
    await service.unblock("user-1", {
      reason: "appeal approved",
      revokedById: "staff-2",
      caseId: "case-1",
    });

    expect(repository.revokeActive).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUserId: "user-1",
        safeMessage: undefined,
        reason: "appeal approved",
        revokedById: "staff-2",
      }),
    );
    expect(actionService.appendModerationAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
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
    );
    expect(broadcastMock).toHaveBeenCalledWith({
      kind: "moderation.appeal.updated",
      sourceUnitId: "user-1",
      directRecipients: ["user-1"],
      actorId: "staff-2",
      extra: { enforcementId: "enforcement-1", state: "REVOKED" },
    });
  });
});
