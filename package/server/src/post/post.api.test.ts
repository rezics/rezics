import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";
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
  async (_unitId?: string, _opts?: unknown): Promise<any> => ({
    unitId: "post-1",
    unit: {
      user: { unitId: "owner-1" },
    },
  }),
);
const listMock = mock(async (_opts?: unknown) => ({
  posts: [{ unitId: "post-1" }],
  total: 1,
}));
const byRealmMock = mock(
  async (_realmUnitId?: string, _opts?: unknown, _ctx?: unknown) => ({
    posts: [{ unitId: "realm-post-1" }],
    total: 1,
  }),
);
const createMock = mock(async (_input?: unknown, _ctx?: unknown) => ({
  unitId: "created-post-1",
}));
const submitToRealmMock = mock(async (_input?: unknown, _ctx?: unknown) => ({
  unitId: "post-1",
  realmUnitId: "realm-1",
}));
const updateMock = mock(async (_unitId: string, input: any) => ({
  unitId: "post-1",
  ...input,
}));
const deleteMock = mock(async (_unitId?: string) => undefined);
const listModerationOverlaysMock = mock(async () => [
  {
    id: "reply-1",
    moderationStatus: "removed",
    latestAction: null,
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
    listModerationOverlays: listModerationOverlaysMock,
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
  assertCanEditCollaborativeMetadata: mock(() => undefined),
  assertEditorialPatchAllowed: mock(() => undefined),
  collectPatchLeafPaths: mock(() => []),
  writeEditorialMetadataHistory: mock(async () => undefined),
}));

mock.module("@/unit/language-resolution", () => ({
  primarySupportLanguageCreate: mock((language: string) => ({
    language,
    isPrimary: true,
    sortOrder: 0,
  })),
  resolveEffectiveReadLanguageCandidates: mock((input: any) => {
    const languages = Array.isArray(input.languages)
      ? input.languages
      : String(input.languages ?? "")
          .split(",")
          .filter(Boolean);
    return [...new Set([...languages, "en"])];
  }),
}));

mock.module("@/unit/variant-context", () => ({
  hydrateVariantContextSummaries: mock(async () => new Map()),
}));

const mapPostToDTOMock = mock(
  (post: any, _variantContexts?: unknown, _languages?: readonly string[]) => ({
    unitId: post.unitId,
    authorUserId: post.authorUserId ?? "owner-1",
  }),
);

mock.module("./post.mapper", () => ({
  mapCommentPromotionToDTO: mock((promotion: unknown) => promotion),
  mapPostToDTO: mapPostToDTOMock,
}));

mock.module("./post.service", async () => {
  const actual = await import(
    "./post.service.ts?post-api-test-actual" as string
  );
  return {
    ...actual,
    postService: {
      create: createMock,
      submitToRealm: submitToRealmMock,
      getByUnitId: getByUnitIdMock,
      list: listMock,
      byRealm: byRealmMock,
      update: updateMock,
      delete: deleteMock,
    },
  };
});

describe("postApi", () => {
  afterAll(() => {
    mock.restore();
  });

  beforeEach(() => {
    currentIdentity = {
      sub: "owner-1",
      userId: "owner-1",
      permission: { role: "USER" },
    };
    policyAllowed = false;
    decideForIdentityMock.mockClear();
    listModerationOverlaysMock.mockClear();
    createMock.mockClear();
    listMock.mockClear();
    byRealmMock.mockClear();
    submitToRealmMock.mockClear();
    updateMock.mockClear();
    getByUnitIdMock.mockClear();
    deleteMock.mockClear();
    mapPostToDTOMock.mockClear();
  });

  test("passes read-language candidates through single post reads", async () => {
    const { postApi } = await import("./post.api");
    const response = await postApi.handle(
      new Request("http://localhost/post/post-1?languages=ja,en"),
    );

    expect(response.status).toBe(200);
    expect(getByUnitIdMock).toHaveBeenCalledWith("post-1", {
      isAdmin: false,
    });
    expect(mapPostToDTOMock.mock.calls[0]?.[2]).toEqual(["ja", "en"]);
  });

  test("passes POST body read-language candidates through list reads", async () => {
    const { postApi } = await import("./post.api");
    const response = await postApi.handle(
      new Request("http://localhost/post/list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          realmUnitId: "realm-1",
          languages: ["ja", "en"],
          languageMode: "preferred",
          limit: 20,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(byRealmMock.mock.calls[0]?.[0]).toBe("realm-1");
    expect(byRealmMock.mock.calls[0]?.[1]).toMatchObject({
      realmUnitId: "realm-1",
      languages: ["ja", "en"],
      languageMode: "preferred",
    });
    expect(mapPostToDTOMock.mock.calls[0]?.[1]).toBeInstanceOf(Map);
    expect(mapPostToDTOMock.mock.calls[0]?.[2]).toEqual(["ja", "en"]);
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
      overlays: [
        { id: "reply-1", moderationStatus: "removed", latestAction: null },
      ],
    });
    expect(listModerationOverlaysMock).toHaveBeenCalledWith({
      targetKind: "unit_realm",
      realmUnitId: "realm-1",
      targetIds: ["reply-1", "reply-2"],
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
          language: "en",
          title: "Hello",
          content: markdownContentDoc("hello"),
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
