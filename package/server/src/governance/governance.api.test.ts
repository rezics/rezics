import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

let currentIdentity = {
  sub: "staff-1",
  userId: "staff-1",
  permission: { role: "ADMIN" },
};
let policyAllowed = false;
const decideForIdentityMock = mock(async () => ({
  allowed: policyAllowed,
  code: policyAllowed ? "ALLOWED" : "MISSING_CAPABILITY",
  safeMessage: policyAllowed ? "Allowed" : "Denied by policy",
}));

const enforcementRow = {
  id: "enforcement-1",
  targetUserId: "user-2",
  kind: "ban",
  state: "active",
  reason: "spam",
  safeMessage: null,
  decidedByUserId: "staff-1",
  decisionCode: "ALLOWED",
  startsAt: "2026-05-28T00:00:00.000Z",
  expiresAt: null,
  revokedAt: null,
  auditLogId: null,
  createdAt: "2026-05-28T00:00:00.000Z",
  updatedAt: "2026-05-28T00:00:00.000Z",
};

const activeSummaryMock = mock(async () => ({
  targetUserId: "user-2",
  activeKinds: ["ban"],
  strongestKind: "ban",
  expiresAt: null,
}));
const listMock = mock(async () => [enforcementRow]);
const applyMock = mock(async () => enforcementRow);
const unblockMock = mock(async () => [{ ...enforcementRow, state: "revoked" }]);

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({ identity: currentIdentity }),
  }),
  isAdminRole: mock(() => true),
  verifyAdminFromDb: mock(async () => true),
}));

mock.module("./route-policy.service", () => ({
  governanceRoutePolicyService: {
    decideForIdentity: decideForIdentityMock,
  },
}));

mock.module("./enforcement.service", () => ({
  governanceEnforcementService: {
    activeSummary: activeSummaryMock,
    list: listMock,
    apply: applyMock,
    unblock: unblockMock,
  },
}));

mock.module("./audit.service", () => ({
  governanceAuditService: { list: mock(async () => []) },
}));

mock.module("./capability.service", () => ({
  governanceCapabilityService: { resolveForUser: mock(async () => []) },
}));

mock.module("./moderation.service", () => ({
  governanceModerationService: {
    listCases: mock(async () => []),
    getCase: mock(async () => null),
    listRealmQueue: mock(async () => []),
  },
}));

describe("governanceApi account enforcement", () => {
  beforeEach(() => {
    currentIdentity = {
      sub: "staff-1",
      userId: "staff-1",
      permission: { role: "ADMIN" },
    };
    policyAllowed = false;
    decideForIdentityMock.mockClear();
    activeSummaryMock.mockClear();
    listMock.mockClear();
    applyMock.mockClear();
    unblockMock.mockClear();
  });

  test("checks audit policy before reading enforcement summaries", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request("http://localhost/governance/enforcement/user-2/active"),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "audit.read",
      target: { kind: "account-enforcement", id: "user-2" },
    });
    expect(activeSummaryMock).toHaveBeenCalledWith("user-2");
  });

  test("denies enforcement creation rejected by policy", async () => {
    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request("http://localhost/governance/enforcement/user-2", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "ban", reason: "spam" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Denied by policy");
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "account.ban",
      target: { kind: "account", id: "user-2" },
    });
    expect(applyMock).not.toHaveBeenCalled();
  });

  test("applies enforcement when policy allows it", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request("http://localhost/governance/enforcement/user-2", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "silence", reason: "spam" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "account.silence",
      target: { kind: "account", id: "user-2" },
    });
    expect(applyMock).toHaveBeenCalledWith("user-2", {
      kind: "silence",
      reason: "spam",
      decidedById: "staff-1",
      decisionCode: "ALLOWED",
    });
  });

  test("unblocks accounts through account unblock policy", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request("http://localhost/governance/enforcement/user-2/unblock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "appeal approved" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "account.unblock",
      target: { kind: "account", id: "user-2" },
    });
    expect(unblockMock).toHaveBeenCalledWith("user-2", {
      reason: "appeal approved",
      revokedById: "staff-1",
    });
  });
});
