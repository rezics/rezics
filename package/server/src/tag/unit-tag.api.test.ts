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
  verifyAdminFromDb: mock(async () => false),
  verifyRootFromDb: mock(async () => false),
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
  mapTagUnitToDTO: mock((row: unknown) => row),
  mapUnitTagToDTO: mock((row: unknown) => row),
}));

mock.module("./tag.service", () => ({
  VISIBILITY_THRESHOLD: -100,
  TagService: class {
    constructor(private readonly repository?: any) {}
    async castVote(...args: Parameters<typeof castVoteMock>) {
      if (this.repository?.castVote) {
        await this.repository.castVote(...args);
      } else {
        await castVoteMock(...args);
      }
      const { serverJobProducer } = await import("@/job/job-boundary");
      await serverJobProducer.enqueue({
        kind: "search.content.patchTags",
        payload: { unitId: args[1] },
        source: { type: "server", service: "tag" },
      });
      return undefined;
    }
    async createUnitTag(...args: Parameters<typeof createUnitTagMock>) {
      return this.repository?.createUnitTag
        ? this.repository.createUnitTag(...args)
        : createUnitTagMock(...args);
    }
    async getTagsForUnit(
      unitId: string,
      opts?: { includeBelowThreshold?: boolean },
    ) {
      return this.repository?.getTagsForUnit
        ? this.repository.getTagsForUnit(unitId, opts)
        : [];
    }
    async listLowScoreUnitTags(threshold: number, limit: number) {
      return this.repository?.listLowScoreUnitTags
        ? this.repository.listLowScoreUnitTags(threshold, limit)
        : [];
    }
  },
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
      new Request("http://localhost/tag-vote/", {
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
      new Request("http://localhost/unit-tag/", {
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
