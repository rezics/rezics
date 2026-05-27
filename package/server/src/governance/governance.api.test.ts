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
  targetUnitId: "reply-1",
  state: "tombstoned",
  decidedByUserId: "staff-1",
  caseId: null,
  reason: "abuse",
  createdAt: "2026-05-28T00:00:00.000Z",
  updatedAt: "2026-05-28T00:00:00.000Z",
};
const realmOverlayRow = {
  realmUnitId: "realm-1",
  targetUnitId: "reply-1",
  state: "tombstoned",
  decidedByUserId: "staff-1",
  caseId: null,
  reason: "off-topic",
  createdAt: "2026-05-28T00:00:00.000Z",
  updatedAt: "2026-05-28T00:00:00.000Z",
};
const tombstoneGlobalMock = mock(async () => contentStateRow);
const restoreGlobalMock = mock(async () => ({
  ...contentStateRow,
  state: "visible",
}));
const tombstoneInRealmMock = mock(async () => realmOverlayRow);
const restoreInRealmMock = mock(async () => ({
  ...realmOverlayRow,
  state: "visible",
}));
const removeRootFromRealmMock = mock(async () => ({
  message: "Content removed from realm feed",
}));
const requestOwnerDelegationMock = mock(async () => ({
  id: "queue-1",
  realmUnitId: "realm-1",
  state: "new",
  target: {
    kind: "content-owner-delegation",
    id: "reply-1",
    realmUnitId: "realm-1",
  },
  reason: "please remove",
  createdAt: "2026-05-28T00:00:00.000Z",
  updatedAt: "2026-05-28T00:00:00.000Z",
}));
const moderationCaseRow = {
  id: "case-1",
  state: "new",
  severity: "medium",
  reporterUserId: "reporter-1",
  subjectUserId: null,
  target: { kind: "unit", id: "post-1", realmUnitId: null },
  sourceFeedbackId: "feedback-1",
  assignedToUserId: null,
  duplicateOfCaseId: null,
  reason: "reported",
  safeSummary: null,
  createdAt: "2026-05-28T00:00:00.000Z",
  updatedAt: "2026-05-28T00:00:00.000Z",
};
const moderationCaseEventRow = {
  id: "event-1",
  caseId: "case-1",
  actorUserId: "staff-1",
  eventType: "case.created_from_report",
  decision: null,
  reason: "reported",
  reversible: false,
  createdAt: "2026-05-28T00:00:00.000Z",
};
const listCaseEventsMock = mock(async () => [moderationCaseEventRow]);
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
  governanceAuditService: { list: mock(async () => []) },
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
    listCaseEvents: listCaseEventsMock,
    createCaseFromFeedback: createCaseFromFeedbackMock,
    duplicateCase: duplicateCaseMock,
    assignCase: assignCaseMock,
    triageCase: triageCaseMock,
    decideCase: decideCaseMock,
    appealCase: appealCaseMock,
    listRealmQueue: mock(async () => []),
    tombstoneGlobal: tombstoneGlobalMock,
    restoreGlobal: restoreGlobalMock,
    tombstoneInRealm: tombstoneInRealmMock,
    restoreInRealm: restoreInRealmMock,
    removeRootFromRealm: removeRootFromRealmMock,
    requestOwnerDelegation: requestOwnerDelegationMock,
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
    realmMembershipForPolicyMock.mockClear();
    grantRealmCapabilityMock.mockClear();
    revokeRealmCapabilityMock.mockClear();
    tombstoneGlobalMock.mockClear();
    restoreGlobalMock.mockClear();
    tombstoneInRealmMock.mockClear();
    restoreInRealmMock.mockClear();
    removeRootFromRealmMock.mockClear();
    requestOwnerDelegationMock.mockClear();
    listCaseEventsMock.mockClear();
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

  test("globally tombstones content through content policy", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request("http://localhost/governance/content/reply-1/tombstone", {
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
    expect(tombstoneGlobalMock).toHaveBeenCalledWith({
      targetUnitId: "reply-1",
      decidedById: "staff-1",
      reason: "abuse",
    });
  });

  test("does not pass attempted body edits into moderation decisions", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request("http://localhost/governance/content/reply-1/tombstone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason: "abuse",
          content: { body: "do not rewrite from moderation" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(tombstoneGlobalMock).toHaveBeenCalledWith({
      targetUnitId: "reply-1",
      decidedById: "staff-1",
      reason: "abuse",
    });
  });

  test("realm tombstones content through realm queue policy", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request(
        "http://localhost/governance/realms/realm-1/content/reply-1/tombstone",
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
    expect(tombstoneInRealmMock).toHaveBeenCalledWith({
      realmUnitId: "realm-1",
      targetUnitId: "reply-1",
      decidedById: "staff-1",
      reason: "off-topic",
    });
  });

  test("removes top-level content from realm feed through junction-drop path", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request("http://localhost/governance/realms/realm-1/feed/post-1", {
        method: "DELETE",
      }),
    );

    expect(response.status).toBe(200);
    expect(removeRootFromRealmMock).toHaveBeenCalledWith({
      realmUnitId: "realm-1",
      targetUnitId: "post-1",
    });
    expect(tombstoneInRealmMock).not.toHaveBeenCalled();
  });

  test("creates owner delegation queue item through realm policy", async () => {
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
      targetUnitId: "reply-1",
      decidedById: "staff-1",
      reason: "please remove",
    });
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

  test("lists moderation case events through case triage policy", async () => {
    policyAllowed = true;

    const { governanceApi } = await import("./governance.api");
    const response = await governanceApi.handle(
      new Request("http://localhost/governance/cases/case-1/events?limit=10"),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "case.triage",
      target: { kind: "moderation-case", id: "case-1" },
    });
    expect(listCaseEventsMock).toHaveBeenCalledWith("case-1", {
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
