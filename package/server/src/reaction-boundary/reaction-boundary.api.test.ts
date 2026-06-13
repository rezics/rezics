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
const createReactionMock = mock(async () => ({
  id: "reaction-1",
  userId: "user-1",
  targetId: "post-1",
  reaction: "upvote",
  contextUnitId: null,
  createdAt: "2026-05-28T00:00:00.000Z",
  created: true,
}));
const broadcastMock = mock(async () => undefined);
type PolicyRealm = {
  id: string;
  type: string;
  visibility: string;
};

const findPolicyRealm = mock(
  async (_realmUnitId: string): Promise<PolicyRealm | undefined> => undefined,
);
const findTargetOwner = mock(
  async (_targetId: string): Promise<string | null> => null,
);

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({ identity: currentIdentity }),
  }),
  isAdminRole: () => false,
  tryResolveIdentity: mock(async () => currentIdentity),
  verifyAdminFromDb: mock(async () => false),
  verifyRootFromDb: mock(async () => false),
}));

mock.module("@/governance", () => ({
  contentPolicyActions: {
    reactionCreate: "reaction.create",
  },
  governanceCapabilityService: {
    realmMembershipForPolicy: mock(async () => null),
  },
  governanceRoutePolicyService: {
    decideForIdentity: decideForIdentityMock,
  },
}));

mock.module("@/notify-boundary/notify-boundary.client", () => ({
  broadcast: broadcastMock,
  filterRecipientsByPreference: mock(async (recipients: unknown) => recipients),
  notifySystemAndEmail: mock(async () => ({ ok: true })),
  resolveRecipients: mock(
    async (event: { directRecipients?: string[] }) =>
      event.directRecipients ?? [],
  ),
  sendDm: mock(async () => ({ ok: true })),
}));

mock.module("./reaction-boundary.client", () => ({
  createReaction: createReactionMock,
  listByUser: mock(async () => ({ items: [], nextCursor: null })),
  listGivenReactions: mock(async () => ({ items: [], nextCursor: null })),
  recordShare: mock(async () => ({
    targetId: "post-1",
    shareCount: 1,
    created: true,
  })),
  removeReaction: mock(async () => ({ success: true })),
}));

describe("reactionBoundaryApi", () => {
  beforeEach(() => {
    policyAllowed = false;
    decideForIdentityMock.mockClear();
    createReactionMock.mockClear();
    createReactionMock.mockImplementation(async () => ({
      id: "reaction-1",
      userId: "user-1",
      targetId: "post-1",
      reaction: "upvote",
      contextUnitId: null,
      createdAt: "2026-05-28T00:00:00.000Z",
      created: true,
    }));
    broadcastMock.mockClear();
    findPolicyRealm.mockReset();
    findPolicyRealm.mockResolvedValue(undefined);
    findTargetOwner.mockReset();
    findTargetOwner.mockResolvedValue(null);
  });

  test("denies reaction creation rejected by policy", async () => {
    const { createReactionBoundaryApi } = await import(
      "./reaction-boundary.api"
    );
    const reactionBoundaryApi = createReactionBoundaryApi({
      findPolicyRealm,
      findTargetOwner,
    });
    const response = await reactionBoundaryApi.handle(
      new Request("http://localhost/reaction/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetId: "post-1", reaction: "upvote" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Denied by policy");
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "reaction.create",
      target: { kind: "reaction", id: "post-1" },
    });
    expect(createReactionMock).not.toHaveBeenCalled();
  });

  test("creates reaction for the requested targetId without resolving Unit.targetUnitId", async () => {
    policyAllowed = true;
    findTargetOwner.mockResolvedValue("owner-1");
    const { createReactionBoundaryApi } = await import(
      "./reaction-boundary.api"
    );
    const reactionBoundaryApi = createReactionBoundaryApi({
      findPolicyRealm,
      findTargetOwner,
    });

    const response = await reactionBoundaryApi.handle(
      new Request("http://localhost/reaction/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetId: "post-1", reaction: "upvote" }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createReactionMock).toHaveBeenCalledWith(
      currentIdentity.userId,
      "post-1",
      "upvote",
      null,
    );
    expect(findTargetOwner).toHaveBeenCalledWith("post-1");
  });

  test("does not broadcast notifications for downvotes", async () => {
    policyAllowed = true;
    findTargetOwner.mockResolvedValue("owner-1");
    createReactionMock.mockImplementation(async () => ({
      id: "reaction-1",
      userId: "user-1",
      targetId: "post-1",
      reaction: "downvote",
      contextUnitId: null,
      createdAt: "2026-05-28T00:00:00.000Z",
      created: true,
    }));
    const { createReactionBoundaryApi } = await import(
      "./reaction-boundary.api"
    );
    const reactionBoundaryApi = createReactionBoundaryApi({
      findPolicyRealm,
      findTargetOwner,
    });

    const response = await reactionBoundaryApi.handle(
      new Request("http://localhost/reaction/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetId: "post-1", reaction: "downvote" }),
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(response.status).toBe(201);
    expect(createReactionMock).toHaveBeenCalledWith(
      currentIdentity.userId,
      "post-1",
      "downvote",
      null,
    );
    expect(findTargetOwner).not.toHaveBeenCalled();
    expect(broadcastMock).not.toHaveBeenCalled();
  });

  test("rejects private realm-context reactions without membership", async () => {
    policyAllowed = true;
    findPolicyRealm.mockResolvedValue({
      id: "realm-1",
      type: "REALM",
      visibility: "PRIVATE",
    });
    const { createReactionBoundaryApi } = await import(
      "./reaction-boundary.api"
    );
    const reactionBoundaryApi = createReactionBoundaryApi({
      findPolicyRealm,
      findTargetOwner,
    });

    const response = await reactionBoundaryApi.handle(
      new Request("http://localhost/reaction/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetId: "post-1",
          reaction: "upvote",
          contextUnitId: "realm-1",
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(createReactionMock).not.toHaveBeenCalled();
  });
});
