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
    memberRoleChange: "realm.member.role.change",
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
    getMember: getMemberMock,
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
    getMemberMock.mockClear();
    updateMemberRoleMock.mockClear();
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
});
