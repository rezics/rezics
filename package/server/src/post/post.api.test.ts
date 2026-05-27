import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

let currentIdentity = {
  sub: "owner-1",
  userId: "owner-1",
  permission: { role: "USER" },
};
let policyAllowed = false;
const decideForIdentityMock = mock(async () => ({
  allowed: policyAllowed,
  code: policyAllowed ? "ALLOWED" : "MISSING_CAPABILITY",
  safeMessage: policyAllowed ? "Allowed" : "Denied by policy",
}));

const getByUnitIdMock = mock(async () => ({
  unitId: "post-1",
  unit: {
    user: { unitId: "owner-1" },
  },
}));
const createMock = mock(async () => ({ unitId: "created-post-1" }));
const deleteMock = mock(async () => undefined);

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({ identity: currentIdentity }),
  }),
  isAdminRole: () => false,
  tryResolveIdentity: mock(async () => null),
  verifyAdminFromDb: mock(async () => false),
}));

mock.module("@/governance", () => ({
  contentPolicyActions: {
    create: "content.create",
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

mock.module("@/unit/collaborative-metadata", () => ({
  applySparsePatch: mock((_: unknown, patch: unknown) => patch),
  assertEditorialPatchAllowed: mock(() => undefined),
}));

mock.module("./post.mapper", () => ({
  mapPostToDTO: mock((post: unknown) => post),
}));

mock.module("./post.service", () => ({
  postService: {
    create: createMock,
    getByUnitId: getByUnitIdMock,
    delete: deleteMock,
  },
}));

describe("postApi", () => {
  beforeEach(() => {
    currentIdentity = {
      sub: "owner-1",
      userId: "owner-1",
      permission: { role: "USER" },
    };
    policyAllowed = false;
    decideForIdentityMock.mockClear();
    createMock.mockClear();
    getByUnitIdMock.mockClear();
    deleteMock.mockClear();
  });

  test("denies post creation rejected by policy", async () => {
    const { postApi } = await import("./post.api");
    const response = await postApi.handle(
      new Request("http://localhost/post/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          realmUnitIds: ["realm-1"],
          content: { body: "hello" },
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Denied by policy");
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "content.create",
      target: { kind: "post", id: "new", realmUnitId: "realm-1" },
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  test("marks reply creation as a create policy target", async () => {
    policyAllowed = true;
    const { postApi } = await import("./post.api");
    const response = await postApi.handle(
      new Request("http://localhost/post/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          parentPostUnitId: "parent-post-1",
          content: { body: "reply" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "content.create",
      target: { kind: "post-reply", id: "parent-post-1", realmUnitId: null },
    });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ parentPostUnitId: "parent-post-1" }),
      "owner-1",
    );
  });

  test("lets owners delete their own posts without policy", async () => {
    const { postApi } = await import("./post.api");
    const response = await postApi.handle(
      new Request("http://localhost/post/post-1", { method: "DELETE" }),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).not.toHaveBeenCalled();
    expect(deleteMock).toHaveBeenCalledWith("post-1");
  });

  test("denies non-owner deletes rejected by policy", async () => {
    currentIdentity = {
      sub: "moderator-1",
      userId: "moderator-1",
      permission: { role: "ADMIN" },
    };

    const { postApi } = await import("./post.api");
    const response = await postApi.handle(
      new Request("http://localhost/post/post-1", { method: "DELETE" }),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Denied by policy");
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "content.delete",
      target: { kind: "post", id: "post-1" },
    });
    expect(deleteMock).not.toHaveBeenCalled();
  });

  test("allows non-owner deletes approved by policy", async () => {
    currentIdentity = {
      sub: "moderator-1",
      userId: "moderator-1",
      permission: { role: "ADMIN" },
    };
    policyAllowed = true;

    const { postApi } = await import("./post.api");
    const response = await postApi.handle(
      new Request("http://localhost/post/post-1", { method: "DELETE" }),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).toHaveBeenCalled();
    expect(deleteMock).toHaveBeenCalledWith("post-1");
  });
});
