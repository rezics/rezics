import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

const currentIdentity = {
  sub: "manager-1",
  userId: "manager-1",
  permission: { role: "USER" },
};
let policyAllowed = false;

const decideForIdentityMock = mock(async () => ({
  allowed: policyAllowed,
  code: policyAllowed ? "ALLOWED" : "MISSING_CAPABILITY",
  safeMessage: policyAllowed ? "Allowed" : "Denied by policy",
}));
const getMemberMock = mock(async () => ({
  realmUnitId: "realm-1",
  roleKey: "moderator",
  capabilities: [
    {
      capability: "tag.curate",
      scope: { kind: "realm", realmUnitId: "realm-1" },
    },
  ],
}));

const now = new Date("2026-06-17T00:00:00.000Z");
const ruleRow = {
  id: "rule-1",
  scopeKind: "realm",
  realmUnitId: "realm-1",
  tagUnitId: "tag-1",
  state: "ACTIVE",
  createdByUserId: "manager-1",
  updatedByUserId: "manager-1",
  reason: null,
  createdAt: now,
  updatedAt: now,
};
const applicationRow = {
  id: "application-1",
  ruleId: "rule-1",
  unitId: "unit-1",
  position: "a",
  metadata: null,
  appliedByUserId: "manager-1",
  updatedByUserId: "manager-1",
  createdAt: now,
  updatedAt: now,
  rule: ruleRow,
};

const createRuleMock = mock(async () => ruleRow);
const getRuleMock = mock(async () => ruleRow);
const updateRuleMock = mock(async () => ({ ...ruleRow, state: "ARCHIVED" }));
const listRulesMock = mock(async () => ({ rows: [ruleRow], total: 1 }));
const upsertApplicationMock = mock(async () => applicationRow);
const listApplicationsMock = mock(async () => ({
  rows: [applicationRow],
  total: 1,
}));
const patchApplicationMock = mock(async () => ({
  ...applicationRow,
  position: "b",
}));
const deleteApplicationMock = mock(async () => undefined);

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({ identity: currentIdentity }),
  }),
  isAdminRole: mock(() => false),
  tryResolveIdentity: mock(async () => null),
  verifyAdminFromDb: mock(async () => false),
  verifyRootFromDb: mock(async () => false),
}));

mock.module("@/governance", () => ({
  governanceRoutePolicyService: {
    decideForIdentity: decideForIdentityMock,
  },
  realmPolicyActions: {
    tagPolicyRuleManage: "tag.policy.rule.manage",
    tagPolicyApplicationManage: "tag.policy.application.manage",
  },
}));

mock.module("@/realm/realm.service", () => ({
  realmService: {
    getMember: getMemberMock,
  },
}));

mock.module("./policy-tag.service", () => ({
  PolicyTagError: class PolicyTagError extends Error {
    constructor(
      public code: string,
      message: string,
      public httpStatus: 400 | 404 | 409,
    ) {
      super(message);
    }
  },
  policyTagService: {
    createRule: createRuleMock,
    getRule: getRuleMock,
    upsertApplication: upsertApplicationMock,
    listRules: listRulesMock,
    listApplications: listApplicationsMock,
    updateRule: updateRuleMock,
    patchApplication: patchApplicationMock,
    deleteApplication: deleteApplicationMock,
  },
}));

describe("policy tag APIs", () => {
  beforeEach(() => {
    policyAllowed = false;
    decideForIdentityMock.mockClear();
    getMemberMock.mockClear();
    createRuleMock.mockClear();
    getRuleMock.mockClear();
    updateRuleMock.mockClear();
    listRulesMock.mockClear();
    upsertApplicationMock.mockClear();
    listApplicationsMock.mockClear();
    patchApplicationMock.mockClear();
    deleteApplicationMock.mockClear();
  });

  test("lists policy tag rules with scoped pagination", async () => {
    const { policyTagApi } = await import("./policy-tag.api");
    const response = await policyTagApi.handle(
      new Request(
        "http://localhost/policy-tag/rules?scopeKind=realm&realmUnitId=realm-1&tagUnitId=tag-1&state=active&limit=20&offset=40",
      ),
    );

    expect(response.status).toBe(200);
    expect(listRulesMock).toHaveBeenCalledWith({
      scopeKind: "realm",
      realmUnitId: "realm-1",
      tagUnitId: "tag-1",
      state: "active",
      limit: 20,
      offset: 40,
    });
    await expect(response.json()).resolves.toMatchObject({
      total: 1,
      rules: [
        {
          id: "rule-1",
          scope: { kind: "realm", realmUnitId: "realm-1" },
          tagUnitId: "tag-1",
          state: "active",
          authority: {
            ruleManageAction: "tag.policy.rule.manage",
            applicationManageAction: "tag.policy.application.manage",
            requiredCapability: "tag.curate",
          },
        },
      ],
    });
  });

  test("denies policy tag rule writes rejected by governance", async () => {
    const { policyTagApi } = await import("./policy-tag.api");
    const response = await policyTagApi.handle(
      new Request("http://localhost/policy-tag/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope: { kind: "realm", realmUnitId: "realm-1" },
          tagUnitId: "tag-1",
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Denied by policy");
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "tag.policy.rule.manage",
      realmMembership: {
        realmUnitId: "realm-1",
        role: "moderator",
        capabilities: [
          {
            capability: "tag.curate",
            scope: { kind: "realm", realmUnitId: "realm-1" },
          },
        ],
      },
      target: {
        kind: "policy-tag-rule",
        id: "realm:tag-1",
        realmUnitId: "realm-1",
      },
    });
    expect(createRuleMock).not.toHaveBeenCalled();
  });

  test("archives policy tag rules through rule management action", async () => {
    policyAllowed = true;
    const { policyTagApi } = await import("./policy-tag.api");
    const response = await policyTagApi.handle(
      new Request("http://localhost/policy-tag/rules/rule-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: "archived", reason: "retired" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(getRuleMock).toHaveBeenCalledWith("rule-1");
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "tag.policy.rule.manage",
      realmMembership: expect.objectContaining({
        realmUnitId: "realm-1",
        role: "moderator",
      }),
      target: {
        kind: "policy-tag-rule",
        id: "rule-1",
        realmUnitId: "realm-1",
      },
    });
    expect(updateRuleMock).toHaveBeenCalledWith("manager-1", "rule-1", {
      state: "archived",
      reason: "retired",
    });
    await expect(response.json()).resolves.toMatchObject({
      id: "rule-1",
      state: "archived",
      reason: null,
    });
  });

  test("lists policy tag applications separately from ordinary tag rows", async () => {
    const { policyTagApi } = await import("./policy-tag.api");
    const response = await policyTagApi.handle(
      new Request(
        "http://localhost/policy-tag/applications?ruleId=rule-1&scopeKind=realm&realmUnitId=realm-1&tagUnitId=tag-1&unitId=unit-1&limit=10&offset=20",
      ),
    );

    expect(response.status).toBe(200);
    expect(listApplicationsMock).toHaveBeenCalledWith({
      ruleId: "rule-1",
      scopeKind: "realm",
      realmUnitId: "realm-1",
      tagUnitId: "tag-1",
      unitId: "unit-1",
      limit: 10,
      offset: 20,
    });
    await expect(response.json()).resolves.toMatchObject({
      total: 1,
      applications: [
        {
          id: "application-1",
          ruleId: "rule-1",
          scope: { kind: "realm", realmUnitId: "realm-1" },
          tagUnitId: "tag-1",
          unitId: "unit-1",
          position: "a",
        },
      ],
    });
  });

  test("allows policy tag application writes through application action", async () => {
    policyAllowed = true;
    const { policyTagApi } = await import("./policy-tag.api");
    const response = await policyTagApi.handle(
      new Request("http://localhost/policy-tag/rules/rule-1/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ unitId: "unit-1", position: "a" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "tag.policy.application.manage",
      realmMembership: expect.objectContaining({
        realmUnitId: "realm-1",
        role: "moderator",
      }),
      target: {
        kind: "policy-tag-application",
        id: "rule-1:unit-1",
        realmUnitId: "realm-1",
      },
    });
    expect(upsertApplicationMock).toHaveBeenCalledWith("manager-1", "rule-1", {
      unitId: "unit-1",
      position: "a",
    });
    const body = await response.json();
    expect(body).toMatchObject({
      id: "application-1",
      ruleId: "rule-1",
      scope: { kind: "realm", realmUnitId: "realm-1" },
      tagUnitId: "tag-1",
      unitId: "unit-1",
    });
  });

  test("patches and deletes policy applications through application action", async () => {
    policyAllowed = true;
    const { policyTagApi } = await import("./policy-tag.api");

    const patchResponse = await policyTagApi.handle(
      new Request(
        "http://localhost/policy-tag/rules/rule-1/applications/unit-1",
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ position: "b" }),
        },
      ),
    );
    const deleteResponse = await policyTagApi.handle(
      new Request(
        "http://localhost/policy-tag/rules/rule-1/applications/unit-1",
        {
          method: "DELETE",
        },
      ),
    );

    expect(patchResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(patchApplicationMock).toHaveBeenCalledWith(
      "manager-1",
      "rule-1",
      "unit-1",
      { position: "b" },
    );
    expect(deleteApplicationMock).toHaveBeenCalledWith("rule-1", "unit-1");
    await expect(patchResponse.json()).resolves.toMatchObject({
      id: "application-1",
      position: "b",
    });
    await expect(deleteResponse.json()).resolves.toEqual({ ok: true });
  });
});
