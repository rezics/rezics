import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

const currentIdentity = {
  sub: "user-1",
  userId: "user-1",
  permission: { role: "USER" },
};
let policyAllowed = false;
const decideForIdentityMock = mock(async () => ({
  allowed: policyAllowed,
  code: policyAllowed ? "ALLOWED" : "ENFORCEMENT_ACTIVE",
  safeMessage: policyAllowed ? "Allowed" : "Denied by policy",
}));
const castVoteMock = mock(async () => undefined);
const createUnitTagMock = mock(async () => ({
  unitId: "unit-1",
  tagUnitId: "tag-1",
  score: 1,
  voteCount: 1,
  pinned: false,
}));

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({ identity: currentIdentity }),
  }),
  isAdminRole: mock(() => false),
  tryResolveIdentity: mock(async () => null),
}));

mock.module("@/governance", () => ({
  contentPolicyActions: {
    create: "content.create",
    delete: "content.delete",
    reactionCreate: "reaction.create",
  },
  governanceRoutePolicyService: {
    decideForIdentity: decideForIdentityMock,
  },
  realmPolicyActions: {
    tagVote: "tag.vote",
  },
}));

mock.module("./tag.mapper", () => ({
  mapUnitTagToDTO: mock((row: unknown) => row),
}));

mock.module("./tag.service", () => ({
  VISIBILITY_THRESHOLD: -100,
  tagService: {
    castVote: castVoteMock,
    createUnitTag: createUnitTagMock,
  },
}));

describe("tag vote APIs", () => {
  beforeEach(() => {
    policyAllowed = false;
    decideForIdentityMock.mockClear();
    castVoteMock.mockClear();
    createUnitTagMock.mockClear();
  });

  test("denies explicit tag votes rejected by policy", async () => {
    const { tagVoteApi } = await import("./unit-tag.api");
    const response = await tagVoteApi.handle(
      new Request("http://localhost/tag-votes/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          unitId: "unit-1",
          tagUnitId: "tag-1",
          value: 1,
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Denied by policy");
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "tag.vote",
      target: { kind: "tag-vote", id: "unit-1:tag-1" },
    });
    expect(castVoteMock).not.toHaveBeenCalled();
  });

  test("denies unit-tag creation-as-vote rejected by policy", async () => {
    const { unitTagApi } = await import("./unit-tag.api");
    const response = await unitTagApi.handle(
      new Request("http://localhost/unit-tags/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ unitId: "unit-1", tagUnitId: "tag-1" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Denied by policy");
    expect(createUnitTagMock).not.toHaveBeenCalled();
  });
});
