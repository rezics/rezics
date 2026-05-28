import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

let currentIdentity = {
  sub: "moderator-1",
  userId: "moderator-1",
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
  userId: "moderator-1",
  roleKey: "moderator",
  joinedAt: new Date("2026-05-28T00:00:00.000Z"),
  updatedAt: new Date("2026-05-28T00:00:00.000Z"),
}));
const updateMemberRoleMock = mock(async (_realmUnitId, userId, roleKey) => ({
  realmUnitId: "realm-1",
  userId,
  roleKey,
  joinedAt: new Date("2026-05-28T00:00:00.000Z"),
  updatedAt: new Date("2026-05-28T00:00:00.000Z"),
}));
const createRealmMock = mock(async () => ({
  unitId: "realm-created",
  isPublic: true,
}));
const createRealmTagApplicationMock = mock(async () => ({
  realmUnitId: "realm-1",
  unitId: "unit-1",
  tagUnitId: "tag-1",
  score: 1,
  voteCount: 1,
  pinned: false,
}));
const appendCommunityListMock = mock(async () => ({
  ok: true,
  unitIds: ["unit-1"],
}));
const updateRulePolicyMock = mock(async () => ({
  realmUnitId: "realm-1",
  ruleUnitId: "rule-unit-1",
  version: 2,
  requireOnJoin: true,
  requireOnPost: false,
  requireOnUpdate: true,
}));
const getRulePolicyMock = mock(async () => ({
  realmUnitId: "realm-1",
  ruleUnitId: "rule-unit-1",
  version: 2,
  requireOnJoin: true,
  requireOnPost: false,
  requireOnUpdate: true,
}));

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({ identity: currentIdentity }),
  }),
  isAdminRole: mock(() => false),
  tryResolveIdentity: mock(async () => null),
  verifyAdminFromDb: mock(async () => false),
}));

mock.module("@/governance", () => ({
  contentPolicyActions: {
    delete: "content.delete",
  },
  governanceRoutePolicyService: {
    decideForIdentity: decideForIdentityMock,
  },
  realmPolicyActions: {
    contentPin: "content.pin",
    create: "realm.create",
    memberRoleChange: "realm.member.role.change",
    rulesUpdate: "realm.rules.update",
    tagVote: "tag.vote",
  },
  sitePolicyActions: {
    auditRead: "audit.read",
    queueDecide: "queue.site.decide",
    repairRun: "operation.repair.run",
  },
}));

mock.module("@/unit/unit.service", () => ({
  unitService: {},
}));

mock.module("./realm.mapper", () => ({
  mapRealmTagApplicationToDTO: mock((row: unknown) => row),
}));

mock.module("./realm.service", () => ({
  realmService: {
    create: createRealmMock,
    createRealmTagApplication: createRealmTagApplicationMock,
    appendCommunityList: appendCommunityListMock,
    getRulePolicy: getRulePolicyMock,
    getMember: getMemberMock,
    updateRulePolicy: updateRulePolicyMock,
    updateMemberRole: updateMemberRoleMock,
  },
}));

describe("realmApi", () => {
  beforeEach(() => {
    currentIdentity = {
      sub: "moderator-1",
      userId: "moderator-1",
      permission: { role: "USER" },
    };
    policyAllowed = false;
    decideForIdentityMock.mockClear();
    createRealmMock.mockClear();
    createRealmTagApplicationMock.mockClear();
    appendCommunityListMock.mockClear();
    getRulePolicyMock.mockClear();
    updateRulePolicyMock.mockClear();
    getMemberMock.mockClear();
    updateMemberRoleMock.mockClear();
  });

  test("denies realm creation rejected by policy", async () => {
    const { realmApi } = await import("./realm.api");
    const response = await realmApi.handle(
      new Request("http://localhost/realm/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isPublic: true }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Denied by policy");
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "realm.create",
      target: { kind: "realm", id: "new" },
    });
    expect(createRealmMock).not.toHaveBeenCalled();
  });

  test("denies realm tag creation-as-vote rejected by policy", async () => {
    const { realmApi } = await import("./realm.api");
    const response = await realmApi.handle(
      new Request("http://localhost/realm/realm-1/tags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ unitId: "unit-1", tagUnitId: "tag-1" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toContain("Denied by policy");
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "tag.vote",
      target: {
        kind: "realm-tag-vote",
        id: "realm-1:unit-1:tag-1",
        realmUnitId: "realm-1",
      },
    });
    expect(createRealmTagApplicationMock).not.toHaveBeenCalled();
  });

  test("denies member role updates rejected by policy", async () => {
    const { realmApi } = await import("./realm.api");
    const response = await realmApi.handle(
      new Request("http://localhost/realm/realm-1/members/user-2", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roleKey: "moderator" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Denied by policy");
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "realm.member.role.change",
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
        kind: "realm-member",
        id: "user-2",
        realmUnitId: "realm-1",
      },
    });
    expect(updateMemberRoleMock).not.toHaveBeenCalled();
  });

  test("allows member role updates approved by policy", async () => {
    policyAllowed = true;

    const { realmApi } = await import("./realm.api");
    const response = await realmApi.handle(
      new Request("http://localhost/realm/realm-1/members/user-2", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roleKey: "admin" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).toHaveBeenCalled();
    expect(updateMemberRoleMock).toHaveBeenCalledWith(
      "realm-1",
      "user-2",
      "admin",
    );
  });

  test("denies pinboard append rejected by content pin policy", async () => {
    const { realmApi } = await import("./realm.api");
    const response = await realmApi.handle(
      new Request("http://localhost/realm/realm-1/pinboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ unitId: "unit-1" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Denied by policy");
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "content.pin",
      realmMembership: {
        realmUnitId: "realm-1",
        role: "moderator",
        capabilities: [],
      },
      target: {
        kind: "realm-content-list",
        id: "realm-1:pinboard",
        realmUnitId: "realm-1",
      },
    });
    expect(appendCommunityListMock).not.toHaveBeenCalled();
  });

  test("allows pinboard append approved by content pin policy", async () => {
    policyAllowed = true;

    const { realmApi } = await import("./realm.api");
    const response = await realmApi.handle(
      new Request("http://localhost/realm/realm-1/pinboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ unitId: "unit-1" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(appendCommunityListMock).toHaveBeenCalledWith(
      currentIdentity,
      "realm-1",
      "pinboard",
      "unit-1",
    );
  });

  test("reads rule policy without privileged policy decision", async () => {
    const { realmApi } = await import("./realm.api");
    const response = await realmApi.handle(
      new Request("http://localhost/realm/realm-1/rules"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      realmUnitId: "realm-1",
      ruleUnitId: "rule-unit-1",
      version: 2,
    });
    expect(getRulePolicyMock).toHaveBeenCalledWith("realm-1");
    expect(decideForIdentityMock).not.toHaveBeenCalled();
  });

  test("denies rule policy updates rejected by policy", async () => {
    const { realmApi } = await import("./realm.api");
    const response = await realmApi.handle(
      new Request("http://localhost/realm/realm-1/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ruleUnitId: "rule-unit-1", version: 2 }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Denied by policy");
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "realm.rules.update",
      realmMembership: {
        realmUnitId: "realm-1",
        role: "moderator",
        capabilities: [],
      },
      target: {
        kind: "realm-rules",
        id: "realm-1",
        realmUnitId: "realm-1",
      },
    });
    expect(updateRulePolicyMock).not.toHaveBeenCalled();
  });

  test("allows rule policy updates approved by policy", async () => {
    policyAllowed = true;

    const { realmApi } = await import("./realm.api");
    const response = await realmApi.handle(
      new Request("http://localhost/realm/realm-1/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ruleUnitId: "rule-unit-1",
          version: 2,
          requireOnJoin: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateRulePolicyMock).toHaveBeenCalledWith(
      currentIdentity,
      "realm-1",
      {
        ruleUnitId: "rule-unit-1",
        version: 2,
        requireOnJoin: true,
      },
    );
  });
});
