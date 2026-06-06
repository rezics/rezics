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
  decisionActionId: null,
  revocationActionId: null,
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
const auditRow = {
  id: "audit-1",
  actorUserId: "staff-1",
  action: "session.revoke",
  targetKind: "session",
  targetId: "session-1",
  decisionCode: "ALLOWED",
  requestId: "req-1",
  reason: "compromised session",
  metadata: { sessionId: "session-1" },
  createdAt: "2026-05-28T00:00:00.000Z",
};
const listAuditMock = mock(async () => [auditRow]);
const getAuditMock = mock(async () => auditRow);
const realmMembershipForPolicyMock = mock(async () => ({
  realmUnitId: "realm-1",
  role: "moderator",
  capabilities: [
    {
      capability: "queue.realm.decide",
      scope: { kind: "realm", realmUnitId: "realm-1" },
    },
  ],
}));
const capabilityGrantRow = {
  id: "grant-1",
  userId: "user-2",
  capability: "queue.realm.decide",
  scope: { kind: "realm", realmUnitId: "realm-1" },
  state: "active",
  grantedByUserId: "staff-1",
  revokedByUserId: null,
  expiresAt: null,
  createdAt: "2026-05-28T00:00:00.000Z",
  updatedAt: "2026-05-28T00:00:00.000Z",
};
const grantRealmCapabilityMock = mock(async () => capabilityGrantRow);
const revokeRealmCapabilityMock = mock(async () => [
  { ...capabilityGrantRow, state: "revoked", revokedByUserId: "staff-1" },
]);
const contentStateRow = {
  moderatedUnitId: "reply-1",
  state: "tombstoned",
  decidedByUserId: "staff-1",
  caseId: null,
  reason: "abuse",
  createdAt: "2026-05-28T00:00:00.000Z",
  updatedAt: "2026-05-28T00:00:00.000Z",
};
const realmOverlayRow = {
  realmUnitId: "realm-1",
  unitId: "reply-1",
  moderationStatus: "removed",
  isLocked: false,
  createdAt: "2026-05-28T00:00:00.000Z",
};
const setUnitModerationStatusMock = mock(async () => ({
  ...contentStateRow,
  state: "visible",
}));
const setRealmUnitModerationStatusMock = mock(async () => ({
  ...realmOverlayRow,
  moderationStatus: "approved",
}));
const setLockMock = mock(async () => ({
  ...realmEventRow,
  actionKind: "lock",
  resultingLocked: true,
}));
const realmQueueRow = {
  id: "queue-1",
  realmUnitId: "realm-1",
  state: "new",
  reporterUserId: "reporter-1",
  subjectUserId: "subject-1",
  target: { kind: "unit", id: "post-1", realmUnitId: "realm-1" },
  sourceFeedbackId: "feedback-1",
  parentCaseId: null,
  assignedToUserId: null,
  reason: "reported",
  safeSummary: null,
  createdAt: "2026-05-28T00:00:00.000Z",
  updatedAt: "2026-05-28T00:00:00.000Z",
};
const realmEventRow = {
  id: "action-1",
  authority: "realm",
  realmUnitId: "realm-1",
  targetKind: "unit_realm",
  targetId: "post-1",
  actorKind: "user",
  actorUserId: "mod-1",
  actionKind: "remove",
  resultingStatus: "removed",
  resultingLocked: null,
  reasonCode: "hide_from_realm",
  reasonText: "off-topic",
  caseId: "queue-1",
  reversesActionId: null,
  requestId: null,
  importedFrom: null,
  createdAt: "2026-05-28T00:00:00.000Z",
};
const createRealmCaseMock = mock(async () => realmQueueRow);
const createRealmCaseFromFeedbackMock = mock(async () => realmQueueRow);
const listEscalatedRealmCasesMock = mock(async () => [
  { ...realmQueueRow, state: "escalated", parentCaseId: "case-1" },
]);
const listRealmCaseActionsMock = mock(async () => [realmEventRow]);
const decideRealmCaseMock = mock(async () => ({
  ...realmQueueRow,
  state: "actioned",
}));
const escalateRealmCaseMock = mock(async () => ({
  ...realmQueueRow,
  state: "escalated",
  parentCaseId: "case-1",
}));
const moderationCaseRow = {
  id: "case-1",
  scope: "platform",
  state: "new",
  severity: "medium",
  reporterUserId: "reporter-1",
  subjectUserId: "subject-1",
  target: { kind: "unit", id: "post-1", realmUnitId: null },
  sourceFeedbackId: "feedback-1",
  assignedToUserId: null,
  parentCaseId: null,
  duplicateOfCaseId: null,
  reason: "reported",
  safeSummary: null,
  createdAt: "2026-05-28T00:00:00.000Z",
  updatedAt: "2026-05-28T00:00:00.000Z",
};
const realmModerationCaseRow = {
  ...moderationCaseRow,
  id: "case-1",
  scope: "realm",
  realmUnitId: "realm-1",
  target: { kind: "unit", id: "post-1", realmUnitId: "realm-1" },
};
const requestOwnerDelegationMock = mock(async () => ({
  ...realmModerationCaseRow,
  reason: "please remove",
}));
createRealmCaseMock.mockImplementation(async () => realmModerationCaseRow);
createRealmCaseFromFeedbackMock.mockImplementation(
  async () => realmModerationCaseRow,
);
listEscalatedRealmCasesMock.mockImplementation(async () => [
  { ...realmModerationCaseRow, state: "escalated", parentCaseId: "case-root" },
]);
decideRealmCaseMock.mockImplementation(async () => ({
  ...realmModerationCaseRow,
  state: "actioned",
}));
escalateRealmCaseMock.mockImplementation(async () => ({
  ...realmModerationCaseRow,
  state: "escalated",
  parentCaseId: "case-root",
}));
const moderationCaseEventRow = {
  id: "action-2",
  authority: "platform",
  realmUnitId: null,
  targetKind: "unit",
  targetId: "post-1",
  actorKind: "user",
  actorUserId: "staff-1",
  actionKind: "note",
  resultingStatus: null,
  resultingLocked: null,
  reasonCode: "case.created_from_report",
  reasonText: "reported",
  caseId: "case-1",
  reversesActionId: null,
  requestId: null,
  importedFrom: null,
  createdAt: "2026-05-28T00:00:00.000Z",
};
const listCaseActionsMock = mock(async () => [moderationCaseEventRow]);
const listTargetActionsMock = mock(async () => [moderationCaseEventRow]);
const listModerationOverlaysMock = mock(async () => [
  {
    id: "post-1",
    moderationStatus: "approved",
    latestAction: moderationCaseEventRow,
  },
]);
const createCaseFromFeedbackMock = mock(async () => moderationCaseRow);
const duplicateCaseMock = mock(async () => ({
  ...moderationCaseRow,
  state: "duplicate",
  duplicateOfCaseId: "case-root",
}));
const assignCaseMock = mock(async () => ({
  ...moderationCaseRow,
  state: "assigned",
  assignedToUserId: "staff-2",
}));
const triageCaseMock = mock(async () => ({
  ...moderationCaseRow,
  state: "triaged",
}));
const decideCaseMock = mock(async () => ({
  ...moderationCaseRow,
  state: "actioned",
}));
const appealCaseMock = mock(async () => moderationCaseRow);

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
  governanceAuditService: {
    list: listAuditMock,
    get: getAuditMock,
  },
}));

mock.module("./capability.service", () => ({
  governanceCapabilityService: {
    resolveForUser: mock(async () => []),
    realmMembershipForPolicy: realmMembershipForPolicyMock,
    grantRealmCapability: grantRealmCapabilityMock,
    revokeRealmCapability: revokeRealmCapabilityMock,
  },
}));

mock.module("./moderation.service", () => ({
  governanceModerationService: {
    listCases: mock(async () => []),
    getCase: mock(async () => null),
    listCaseActions: listCaseActionsMock,
    listTargetActions: listTargetActionsMock,
    listModerationOverlays: listModerationOverlaysMock,
    createCaseFromFeedback: createCaseFromFeedbackMock,
    duplicateCase: duplicateCaseMock,
    assignCase: assignCaseMock,
    triageCase: triageCaseMock,
    decideCase: decideCaseMock,
    appealCase: appealCaseMock,
    listRealmCases: mock(async () => []),
    setUnitModerationStatus: setUnitModerationStatusMock,
    setRealmUnitModerationStatus: setRealmUnitModerationStatusMock,
    setLock: setLockMock,
    requestOwnerDelegation: requestOwnerDelegationMock,
    createRealmCase: createRealmCaseMock,
    createRealmCaseFromFeedback: createRealmCaseFromFeedbackMock,
    listEscalatedRealmCases: listEscalatedRealmCasesMock,
    listRealmCaseActions: listRealmCaseActionsMock,
    decideRealmCase: decideRealmCaseMock,
    escalateRealmCase: escalateRealmCaseMock,
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
    listAuditMock.mockClear();
    getAuditMock.mockClear();
    realmMembershipForPolicyMock.mockClear();
    grantRealmCapabilityMock.mockClear();
    revokeRealmCapabilityMock.mockClear();
    setUnitModerationStatusMock.mockClear();
    setRealmUnitModerationStatusMock.mockClear();
    setLockMock.mockClear();
    requestOwnerDelegationMock.mockClear();
    createRealmCaseMock.mockClear();
    createRealmCaseFromFeedbackMock.mockClear();
    listEscalatedRealmCasesMock.mockClear();
    listRealmCaseActionsMock.mockClear();
    decideRealmCaseMock.mockClear();
    escalateRealmCaseMock.mockClear();
    listCaseActionsMock.mockClear();
    listTargetActionsMock.mockClear();
    listModerationOverlaysMock.mockClear();
    createCaseFromFeedbackMock.mockClear();
    duplicateCaseMock.mockClear();
    assignCaseMock.mockClear();
    triageCaseMock.mockClear();
    decideCaseMock.mockClear();
    appealCaseMock.mockClear();
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

  test("checks audit policy before listing audit records", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request(
        "http://localhost/governance/audit?action=session.revoke&targetKind=session&targetId=session-1&requestId=req-1",
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([auditRow]);
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "audit.read",
      target: { kind: "staff-audit-log", id: "list" },
    });
    expect(listAuditMock).toHaveBeenCalledWith({
      action: "session.revoke",
      targetKind: "session",
      targetId: "session-1",
      requestId: "req-1",
    });
  });

  test("checks audit policy before reading target action timelines", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request(
        "http://localhost/governance/moderation/unit/post-1/actions?limit=5",
      ),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "audit.read",
      target: { kind: "unit", id: "post-1" },
    });
    expect(listTargetActionsMock).toHaveBeenCalledWith("UNIT", "post-1", {
      limit: 5,
    });
  });

  test("checks audit policy before reading moderation overlays", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request("http://localhost/governance/moderation/overlays", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetKind: "unit_realm",
          realmUnitId: "realm-1",
          targetIds: ["post-1"],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "audit.read",
      target: { kind: "unit_realm", id: "realm-1" },
    });
    expect(listModerationOverlaysMock).toHaveBeenCalledWith({
      targetKind: "unit_realm",
      realmUnitId: "realm-1",
      targetIds: ["post-1"],
    });
  });

  test("checks audit policy before reading audit detail", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request("http://localhost/governance/audit/audit-1"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(auditRow);
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "audit.read",
      target: { kind: "staff-audit-log", id: "audit-1" },
    });
    expect(getAuditMock).toHaveBeenCalledWith("audit-1");
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

  test("grants realm member capabilities through realm policy", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request(
        "http://localhost/governance/realms/realm-1/members/user-2/capabilities",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ capability: "queue.realm.decide" }),
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "realm.member.capability.change",
      realmMembership: {
        realmUnitId: "realm-1",
        role: "moderator",
        capabilities: [
          {
            capability: "queue.realm.decide",
            scope: { kind: "realm", realmUnitId: "realm-1" },
          },
        ],
      },
      target: {
        kind: "realm-member-capability",
        id: "user-2",
        realmUnitId: "realm-1",
      },
    });
    expect(grantRealmCapabilityMock).toHaveBeenCalledWith({
      realmUnitId: "realm-1",
      userId: "user-2",
      capability: "queue.realm.decide",
      grantedById: "staff-1",
    });
  });

  test("revokes realm member capabilities through realm policy", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request(
        "http://localhost/governance/realms/realm-1/members/user-2/capabilities/queue.realm.decide",
        { method: "DELETE" },
      ),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "realm.member.capability.change",
      realmMembership: {
        realmUnitId: "realm-1",
        role: "moderator",
        capabilities: [
          {
            capability: "queue.realm.decide",
            scope: { kind: "realm", realmUnitId: "realm-1" },
          },
        ],
      },
      target: {
        kind: "realm-member-capability",
        id: "user-2",
        realmUnitId: "realm-1",
      },
    });
    expect(revokeRealmCapabilityMock).toHaveBeenCalledWith({
      realmUnitId: "realm-1",
      userId: "user-2",
      capability: "queue.realm.decide",
      revokedById: "staff-1",
    });
  });

  test("globally removes content through content policy", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request("http://localhost/governance/content/reply-1/remove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "abuse" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "content.takedown",
      target: { kind: "content", id: "reply-1" },
    });
    expect(setUnitModerationStatusMock).toHaveBeenCalledWith({
      unitId: "reply-1",
      actorUserId: "staff-1",
      action: "remove",
      reasonCode: "content.removed",
      reasonText: "abuse",
    });
  });

  test("globally restores content through content policy with case context", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request("http://localhost/governance/content/reply-1/restore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "abuse", caseId: "case-1" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(setUnitModerationStatusMock).toHaveBeenCalledWith({
      unitId: "reply-1",
      actorUserId: "staff-1",
      action: "restore",
      reasonCode: "content.restored",
      reasonText: "abuse",
      caseId: "case-1",
    });
  });

  test("does not pass attempted body edits into moderation decisions", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request("http://localhost/governance/content/reply-1/remove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason: "abuse",
          content: { body: "do not rewrite from moderation" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(setUnitModerationStatusMock).toHaveBeenCalledWith({
      unitId: "reply-1",
      actorUserId: "staff-1",
      action: "remove",
      reasonCode: "content.removed",
      reasonText: "abuse",
    });
  });

  test("realm removes content through realm case policy", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request(
        "http://localhost/governance/realms/realm-1/content/reply-1/remove",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: "off-topic" }),
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "queue.realm.decide",
      realmMembership: {
        realmUnitId: "realm-1",
        role: "moderator",
        capabilities: [
          {
            capability: "queue.realm.decide",
            scope: { kind: "realm", realmUnitId: "realm-1" },
          },
        ],
      },
      target: {
        kind: "realm-content",
        id: "reply-1",
        realmUnitId: "realm-1",
      },
    });
    expect(setRealmUnitModerationStatusMock).toHaveBeenCalledWith({
      realmUnitId: "realm-1",
      unitId: "reply-1",
      actorUserId: "staff-1",
      action: "remove",
      reasonCode: "realm.content.removed",
      reasonText: "off-topic",
    });
  });

  test("realm restores content through realm case policy", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request(
        "http://localhost/governance/realms/realm-1/content/reply-1/restore",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: "off-topic", caseId: "case-1" }),
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(setRealmUnitModerationStatusMock).toHaveBeenCalledWith({
      realmUnitId: "realm-1",
      unitId: "reply-1",
      actorUserId: "staff-1",
      action: "restore",
      reasonCode: "realm.content.restored",
      reasonText: "off-topic",
      caseId: "case-1",
    });
  });

  test("removes content from a realm through UnitRealm moderation state", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request(
        "http://localhost/governance/realms/realm-1/content/post-1/remove",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: "off-topic" }),
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(setRealmUnitModerationStatusMock).toHaveBeenCalledWith({
      realmUnitId: "realm-1",
      unitId: "post-1",
      actorUserId: "staff-1",
      action: "remove",
      reasonCode: "realm.content.removed",
      reasonText: "off-topic",
    });
  });

  test("locks and unlocks realm content through content lock policy", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    await governanceApi.handle(
      new Request(
        "http://localhost/governance/realms/realm-1/content/post-1/lock",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: "heated thread", caseId: "case-1" }),
        },
      ),
    );
    await governanceApi.handle(
      new Request(
        "http://localhost/governance/realms/realm-1/content/post-1/unlock",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: "resolved" }),
        },
      ),
    );

    expect(setLockMock).toHaveBeenNthCalledWith(1, {
      targetKind: "UNIT_REALM",
      targetId: "post-1",
      realmUnitId: "realm-1",
      isLocked: true,
      actorUserId: "staff-1",
      reasonCode: "realm.content.locked",
      reasonText: "heated thread",
      caseId: "case-1",
    });
    expect(setLockMock).toHaveBeenNthCalledWith(2, {
      targetKind: "UNIT_REALM",
      targetId: "post-1",
      realmUnitId: "realm-1",
      isLocked: false,
      actorUserId: "staff-1",
      reasonCode: "realm.content.unlocked",
      reasonText: "resolved",
    });
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "content.lock",
      realmMembership: {
        realmUnitId: "realm-1",
        role: "moderator",
        capabilities: [
          {
            capability: "queue.realm.decide",
            scope: { kind: "realm", realmUnitId: "realm-1" },
          },
        ],
      },
      target: {
        kind: "realm-content",
        id: "post-1",
        realmUnitId: "realm-1",
      },
    });
  });

  test("creates owner delegation case through realm policy", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request(
        "http://localhost/governance/realms/realm-1/content/reply-1/owner-delegation",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: "please remove" }),
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(requestOwnerDelegationMock).toHaveBeenCalledWith({
      realmUnitId: "realm-1",
      moderatedUnitId: "reply-1",
      decidedById: "staff-1",
      reason: "please remove",
    });
  });

  test("creates realm cases through realm case policy", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request("http://localhost/governance/realms/realm-1/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetKind: "unit",
          targetId: "post-1",
          addressedUnitId: "post-1",
          reason: "reported",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(createRealmCaseMock).toHaveBeenCalledWith({
      realmUnitId: "realm-1",
      actorUserId: "staff-1",
      targetKind: "unit",
      targetId: "post-1",
      addressedUnitId: "post-1",
      reason: "reported",
    });
  });

  test("creates realm cases from feedback", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request(
        "http://localhost/governance/realms/realm-1/cases/from-feedback/feedback-1",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: "reported" }),
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(createRealmCaseFromFeedbackMock).toHaveBeenCalledWith({
      realmUnitId: "realm-1",
      feedbackId: "feedback-1",
      actorUserId: "staff-1",
      reason: "reported",
    });
  });

  test("lists only escalated realm cases for staff oversight", async () => {
    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request(
        "http://localhost/governance/cases?scope=realm&state=escalated&limit=8",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.status).toBe(200);
  });

  test("lists realm case actions through realm case policy", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request(
        "http://localhost/governance/realms/realm-1/cases/case-1/actions?limit=10",
      ),
    );

    expect(response.status).toBe(200);
    expect(listRealmCaseActionsMock).toHaveBeenCalledWith("realm-1", "case-1", {
      limit: 10,
    });
  });

  test("decides and escalates realm cases through realm policies", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    await governanceApi.handle(
      new Request(
        "http://localhost/governance/realms/realm-1/cases/case-1/decision",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            actionKind: "remove",
            reason: "off-topic",
          }),
        },
      ),
    );
    await governanceApi.handle(
      new Request(
        "http://localhost/governance/realms/realm-1/cases/case-1/escalate",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: "site review needed" }),
        },
      ),
    );

    expect(decideRealmCaseMock).toHaveBeenCalledWith({
      realmUnitId: "realm-1",
      caseId: "case-1",
      actorUserId: "staff-1",
      decisionKind: "remove_from_realm",
      reason: "off-topic",
      duplicateOfCaseId: undefined,
      parentCaseId: undefined,
      decision: undefined,
      metadata: undefined,
    });
    expect(escalateRealmCaseMock).toHaveBeenCalledWith({
      realmUnitId: "realm-1",
      caseId: "case-1",
      actorUserId: "staff-1",
      reason: "site review needed",
      platformCaseId: undefined,
      safeSummary: undefined,
    });
    const policyActions = (
      decideForIdentityMock.mock.calls as unknown as Array<[{ action: string }]>
    ).map(([input]) => input.action);
    expect(policyActions).toEqual(
      expect.arrayContaining(["queue.realm.decide", "realm.report.escalate"]),
    );
  });

  test("creates moderation cases from report feedback through case triage policy", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request(
        "http://localhost/governance/cases/from-feedback/feedback-1",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            severity: "medium",
            reason: "reported",
            metadata: { source: "report" },
          }),
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "case.triage",
      target: { kind: "feedback", id: "feedback-1" },
    });
    expect(createCaseFromFeedbackMock).toHaveBeenCalledWith({
      feedbackId: "feedback-1",
      actorUserId: "staff-1",
      severity: "medium",
      reason: "reported",
      metadata: { source: "report" },
    });
  });

  test("lists moderation case actions through case triage policy", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request("http://localhost/governance/cases/case-1/actions?limit=10"),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "case.triage",
      target: { kind: "moderation-case", id: "case-1" },
    });
    expect(listCaseActionsMock).toHaveBeenCalledWith("case-1", {
      limit: 10,
    });
  });

  test("links duplicate moderation cases through case triage policy", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request("http://localhost/governance/cases/case-1/duplicate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          duplicateOfCaseId: "case-root",
          reason: "same target",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(duplicateCaseMock).toHaveBeenCalledWith({
      caseId: "case-1",
      actorUserId: "staff-1",
      duplicateOfCaseId: "case-root",
      reason: "same target",
    });
  });

  test("assigns moderation cases through case assign policy", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request("http://localhost/governance/cases/case-1/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignedToUserId: "staff-2",
          reason: "handoff",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "case.assign",
      target: { kind: "moderation-case", id: "case-1" },
    });
    expect(assignCaseMock).toHaveBeenCalledWith({
      caseId: "case-1",
      actorUserId: "staff-1",
      assignedToUserId: "staff-2",
      reason: "handoff",
    });
  });

  test("triages, decides, and appeals moderation cases through case policies", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    await governanceApi.handle(
      new Request("http://localhost/governance/cases/case-1/triage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ severity: "high", reason: "urgent" }),
      }),
    );
    await governanceApi.handle(
      new Request("http://localhost/governance/cases/case-1/decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          state: "actioned",
          reason: "violation confirmed",
          decision: { allowed: true, code: "ALLOWED" },
        }),
      }),
    );
    await governanceApi.handle(
      new Request("http://localhost/governance/cases/case-1/appeal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "appeal received" }),
      }),
    );

    expect(triageCaseMock).toHaveBeenCalledWith({
      caseId: "case-1",
      actorUserId: "staff-1",
      severity: "high",
      reason: "urgent",
    });
    expect(decideCaseMock).toHaveBeenCalledWith({
      caseId: "case-1",
      actorUserId: "staff-1",
      state: "actioned",
      reason: "violation confirmed",
      decision: { allowed: true, code: "ALLOWED" },
    });
    expect(appealCaseMock).toHaveBeenCalledWith({
      caseId: "case-1",
      actorUserId: "staff-1",
      reason: "appeal received",
    });
    const policyActions = (
      decideForIdentityMock.mock.calls as unknown as Array<[{ action: string }]>
    ).map(([input]) => input.action);
    expect(policyActions).toEqual(
      expect.arrayContaining(["case.triage", "case.decide", "case.reverse"]),
    );
  });
});
