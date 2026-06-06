import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

const currentIdentity = {
  sub: "sender-1",
  userId: "sender-1",
  permission: { role: "USER" },
};
let policyAllowed = false;
const decideForIdentityMock = mock(async () => ({
  allowed: policyAllowed,
  code: policyAllowed ? "ALLOWED" : "ENFORCEMENT_ACTIVE",
  safeMessage: policyAllowed ? "Allowed" : "Denied by policy",
}));
const sendDmMock = mock(async () => ({ ok: true, data: { id: "dm-1" } }));
const getSubscriptionChannels = mock(async () => ["dm.message"]);
let isBlocked = false;
// Drives the inline user-to-user block check on the DM send path, consulted
// before the policy/subscription gates.
const isBlockedEitherWay = mock(async () => isBlocked);

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({ identity: currentIdentity }),
  }),
}));

mock.module("@/governance", () => ({
  contentPolicyActions: {
    create: "content.create",
    delete: "content.delete",
    reactionCreate: "reaction.create",
  },
  governanceCapabilityService: {
    realmMembershipForPolicy: mock(async () => null),
  },
  governanceRoutePolicyService: {
    decideForIdentity: decideForIdentityMock,
  },
  realmPolicyActions: {
    dmSend: "dm.send",
  },
}));

mock.module("./dm-boundary.sender", () => ({
  deliverDm: sendDmMock,
}));

describe("dmBoundaryApi policy", () => {
  beforeEach(() => {
    policyAllowed = false;
    isBlocked = false;
    decideForIdentityMock.mockClear();
    sendDmMock.mockClear();
    getSubscriptionChannels.mockClear();
    isBlockedEitherWay.mockClear();
  });

  test("denies DM send rejected by policy before subscription checks", async () => {
    const { createDmBoundaryApi } = await import("./dm-boundary.api");
    const dmBoundaryApi = createDmBoundaryApi({
      getSubscriptionChannels,
      isBlockedEitherWay,
    });
    const response = await dmBoundaryApi.handle(
      new Request("http://localhost/dm/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipientId: "recipient-1", content: "hi" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Denied by policy" });
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "dm.send",
      target: { kind: "direct-message", id: "recipient-1" },
    });
    expect(getSubscriptionChannels).not.toHaveBeenCalled();
    expect(sendDmMock).not.toHaveBeenCalled();
  });

  test("denies DM send when either party has blocked the other", async () => {
    isBlocked = true;
    policyAllowed = true;
    const { createDmBoundaryApi } = await import("./dm-boundary.api");
    const dmBoundaryApi = createDmBoundaryApi({
      getSubscriptionChannels,
      isBlockedEitherWay,
    });
    const response = await dmBoundaryApi.handle(
      new Request("http://localhost/dm/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipientId: "recipient-1", content: "hi" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "You cannot message this user",
    });
    // Block wins ahead of the policy and subscription gates.
    expect(decideForIdentityMock).not.toHaveBeenCalled();
    expect(getSubscriptionChannels).not.toHaveBeenCalled();
    expect(sendDmMock).not.toHaveBeenCalled();
  });
});
