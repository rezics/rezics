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
const deleteMock = mock(async () => undefined);

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({ identity: currentIdentity }),
  }),
  isAdminRole: () => false,
  tryResolveIdentity: mock(async () => null),
}));

mock.module("@/governance", () => ({
  contentPolicyActions: {
    delete: "content.delete",
  },
  governanceRoutePolicyService: {
    decideForIdentity: decideForIdentityMock,
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
    getByUnitIdMock.mockClear();
    deleteMock.mockClear();
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
