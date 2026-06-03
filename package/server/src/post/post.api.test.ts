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

const getByUnitIdMock = mock(
  async (): Promise<any> => ({
    unitId: "post-1",
    unit: {
      user: { unitId: "owner-1" },
    },
  }),
);
const createMock = mock(async () => ({ unitId: "created-post-1" }));
const submitToRealmMock = mock(async () => ({
  unitId: "post-1",
  realmUnitId: "realm-1",
}));
const updateMock = mock(async (_unitId: string, input: any) => ({
  unitId: "post-1",
  ...input,
}));
const deleteMock = mock(async () => undefined);
const listGlobalContentStatesMock = mock(async () => [
  {
    moderatedUnitId: "reply-1",
    state: "hidden",
    decidedByUserId: null,
    caseId: null,
    reason: "abuse",
    createdAt: "2026-05-28T00:00:00.000Z",
    updatedAt: "2026-05-28T00:00:00.000Z",
  },
]);
const listRealmContentOverlaysMock = mock(async () => [
  {
    realmUnitId: "realm-1",
    moderatedUnitId: "reply-1",
    state: "tombstoned",
    decidedByUserId: null,
    caseId: null,
    reason: "off-topic",
    createdAt: "2026-05-28T00:00:00.000Z",
    updatedAt: "2026-05-28T00:00:00.000Z",
  },
]);

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
  governanceModerationService: {
    listGlobalContentStates: listGlobalContentStatesMock,
    listRealmContentOverlays: listRealmContentOverlaysMock,
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

mock.module("@/unit/variant-context", () => ({
  hydrateVariantContextSummaries: mock(async () => undefined),
}));

mock.module("./post.mapper", () => ({
  mapPostToDTO: mock((post: unknown) => post),
}));

mock.module("./post.service", () => ({
  postService: {
    create: createMock,
    submitToRealm: submitToRealmMock,
    getByUnitId: getByUnitIdMock,
    update: updateMock,
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
    listGlobalContentStatesMock.mockClear();
    listRealmContentOverlaysMock.mockClear();
    createMock.mockClear();
    submitToRealmMock.mockClear();
    updateMock.mockClear();
    getByUnitIdMock.mockClear();
    deleteMock.mockClear();
  });

  test("serves bounded moderation overlay sets for rendered post nodes", async () => {
    const { postApi } = await import("./post.api");
    const response = await postApi.handle(
      new Request("http://localhost/post/moderation-overlays", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          realmUnitId: "realm-1",
          targetUnitIds: ["reply-1", "reply-1", "reply-2"],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      globalStates: [
        {
          moderatedUnitId: "reply-1",
          state: "hidden",
          decidedByUserId: null,
          caseId: null,
          reason: "abuse",
          createdAt: "2026-05-28T00:00:00.000Z",
          updatedAt: "2026-05-28T00:00:00.000Z",
        },
      ],
      realmOverlays: [
        {
          realmUnitId: "realm-1",
          moderatedUnitId: "reply-1",
          state: "tombstoned",
          decidedByUserId: null,
          caseId: null,
          reason: "off-topic",
          createdAt: "2026-05-28T00:00:00.000Z",
          updatedAt: "2026-05-28T00:00:00.000Z",
        },
      ],
    });
    expect(listGlobalContentStatesMock).toHaveBeenCalledWith([
      "reply-1",
      "reply-2",
    ]);
    expect(listRealmContentOverlaysMock).toHaveBeenCalledWith({
      realmUnitId: "realm-1",
      moderatedUnitIds: ["reply-1", "reply-2"],
    });
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

  test("normalizes wiki body language from editorial patch metadata", async () => {
    getByUnitIdMock.mockResolvedValueOnce({
      unitId: "wiki-post-1",
      kind: "WIKI",
      content: { main: { source: "old" } },
      unit: {
        user: { unitId: "owner-1" },
        contentTranslations: [
          {
            language: "en",
            content: { main: { source: "old" } },
          },
        ],
      },
    });
    const { postApi } = await import("./post.api");
    const response = await postApi.handle(
      new Request("http://localhost/post/wiki-post-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          patch: {
            post: {
              content: { main: { source: "new" } },
              language: "EN",
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(
      "wiki-post-1",
      expect.objectContaining({
        content: { main: { source: "new" } },
        language: "en",
      }),
      currentIdentity,
      expect.anything(),
    );
  });

  test("submits an authored post to a realm through the post domain", async () => {
    policyAllowed = true;
    const { postApi } = await import("./post.api");
    const response = await postApi.handle(
      new Request("http://localhost/post/post-1/submit-to-realm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          realmUnitId: "realm-1",
          tagIds: ["tag-1"],
          publish: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "content.create",
      target: { kind: "post", id: "post-1", realmUnitId: "realm-1" },
    });
    expect(submitToRealmMock).toHaveBeenCalledWith(
      "post-1",
      { realmUnitId: "realm-1", tagIds: ["tag-1"], publish: true },
      "owner-1",
    );
  });
});
