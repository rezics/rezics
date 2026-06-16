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
const removeMemberMock = mock(async () => undefined);
const listMembersMock = mock(async () => ({
  members: [
    {
      realmUnitId: "realm-1",
      userId: "member-1",
      roleKey: "member",
    },
  ],
  hasMore: false,
}));
const listByMemberMock = mock(async () => ({
  realms: [],
  total: 0,
}));
const createRealmMock = mock(async () => ({
  unitId: "realm-created",
  isPublic: true,
}));
const getUnitByUnitIdMock = mock(async () => ({
  unitId: "realm-1",
  userId: "owner-1",
}));
const addUnitRealmMock = mock(async () => ({
  realmUnitId: "realm-1",
  unitId: "post-1",
}));
const createRealmTagApplicationMock = mock(async () => ({
  realmUnitId: "realm-1",
  unitId: "unit-1",
  tagUnitId: "tag-1",
  score: 1,
  voteCount: 1,
  pinned: false,
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
const resolveRuleMock = mock(async () => ({
  realmUnitId: "realm-1",
  ruleUnitId: "rule-unit-1",
  version: 2,
  requestedLanguage: "ja",
  resolvedLanguage: "ja",
  translation: {
    unitId: "rule-unit-1",
    language: "ja",
    title: "ルール",
    sourceUnitId: "rule-post-ja",
  },
  sourceRulePostUnitId: "rule-post-ja",
  sourceRulePost: {
    unitId: "rule-post-ja",
    authorUserId: "owner-1",
  },
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
  unitService: {
    getByUnitId: getUnitByUnitIdMock,
  },
}));

mock.module("@/unit/language-resolution", () => ({
  resolveEffectiveReadLanguageInput: (input: {
    languages?: string | readonly string[] | null;
    appLocale?: string | null;
  }) => ({
    languages:
      typeof input.languages === "string"
        ? input.languages.split(",").filter(Boolean)
        : [...(input.languages ?? [])],
    appLocale: input.appLocale,
  }),
  resolveEffectiveReadLanguageCandidates: (input: {
    explicitLanguage?: string | null;
    languages?: string | readonly string[] | null;
  }) =>
    input.explicitLanguage
      ? [input.explicitLanguage]
      : typeof input.languages === "string"
        ? input.languages.split(",").filter(Boolean)
        : [...(input.languages ?? [])],
}));

mock.module("./realm.mapper", async () => {
  const actual = await import(
    "./realm.mapper.ts?realm-api-test-actual" as string
  );
  return {
    ...actual,
    mapRealmTagApplicationToDTO: mock((row: unknown) => row),
  };
});

mock.module("./realm.service", () => ({
  realmService: {
    create: createRealmMock,
    addUnitRealm: addUnitRealmMock,
    createRealmTagApplication: createRealmTagApplicationMock,
    getRulePolicy: getRulePolicyMock,
    getMember: getMemberMock,
    listMembers: listMembersMock,
    listByMember: listByMemberMock,
    removeMember: removeMemberMock,
    resolveRule: resolveRuleMock,
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
    getUnitByUnitIdMock.mockClear();
    addUnitRealmMock.mockClear();
    createRealmTagApplicationMock.mockClear();
    getRulePolicyMock.mockClear();
    resolveRuleMock.mockClear();
    updateRulePolicyMock.mockClear();
    getMemberMock.mockClear();
    listMembersMock.mockClear();
    listByMemberMock.mockClear();
    removeMemberMock.mockClear();
    updateMemberRoleMock.mockClear();
  });

  test("passes view through my realm list queries", async () => {
    const { realmApi } = await import("./realm.api");
    const response = await realmApi.handle(
      new Request(
        "http://localhost/realm/me?view=managing&languages=en&start=5&limit=30",
      ),
    );

    expect(response.status).toBe(200);
    expect(listByMemberMock).toHaveBeenCalledWith("moderator-1", {
      languages: ["en"],
      appLocale: undefined,
      view: "managing",
      start: 5,
      limit: 30,
    });
  });

  test("passes view through public member realm list queries", async () => {
    const { realmApi } = await import("./realm.api");
    const response = await realmApi.handle(
      new Request("http://localhost/realm/member/user-2?view=joined&limit=25"),
    );

    expect(response.status).toBe(200);
    expect(listByMemberMock).toHaveBeenCalledWith("user-2", {
      publicOnly: true,
      languages: [],
      appLocale: undefined,
      view: "joined",
      start: undefined,
      limit: 25,
    });
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

  test("records moderation context when a moderator removes another member", async () => {
    const { realmApi } = await import("./realm.api");
    const response = await realmApi.handle(
      new Request("http://localhost/realm/realm-1/members/user-2", {
        method: "DELETE",
      }),
    );

    expect(response.status).toBe(200);
    expect(removeMemberMock).toHaveBeenCalledWith("realm-1", "user-2", {
      moderation: {
        actorUserId: "moderator-1",
        reasonCode: "realm.member.removed",
      },
    });
  });

  test("lists members for moderator roles", async () => {
    const { realmApi } = await import("./realm.api");
    const response = await realmApi.handle(
      new Request("http://localhost/realm/realm-1/members?limit=25"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      members: [
        {
          realmUnitId: "realm-1",
          userId: "member-1",
          roleKey: "member",
        },
      ],
      hasMore: false,
    });
    expect(listMembersMock).toHaveBeenCalledWith("realm-1", {
      limit: 25,
    });
  });

  test("keeps realm content feed route admin-scoped", async () => {
    const { realmApi } = await import("./realm.api");
    const response = await realmApi.handle(
      new Request("http://localhost/realm/realm-1/content", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ unitId: "post-1" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toContain(
      "Forbidden: you do not have permission to add content to this realm",
    );
    expect(getUnitByUnitIdMock).toHaveBeenCalledWith("realm-1");
    expect(addUnitRealmMock).not.toHaveBeenCalled();
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

  test("resolves localized rule content without privileged policy decision", async () => {
    const { realmApi } = await import("./realm.api");
    const response = await realmApi.handle(
      new Request("http://localhost/realm/realm-1/rules/resolved?language=ja"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      realmUnitId: "realm-1",
      requestedLanguage: "ja",
      resolvedLanguage: "ja",
      sourceRulePostUnitId: "rule-post-ja",
    });
    expect(resolveRuleMock).toHaveBeenCalledWith("realm-1", "ja", ["ja"]);
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
