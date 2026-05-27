import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";

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
const subscriptionFindUnique = mock(async () => ({ channels: ["dm.message"] }));

installPrismaClientMock();
Object.assign(prismaMock, {
  subscription: {
    findUnique: subscriptionFindUnique,
  },
});

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
  governanceRoutePolicyService: {
    decideForIdentity: decideForIdentityMock,
  },
  realmPolicyActions: {
    dmSend: "dm.send",
  },
}));

mock.module("./notify-boundary.client", () => ({
  sendDm: sendDmMock,
}));

describe("dmBoundaryApi policy", () => {
  beforeEach(() => {
    policyAllowed = false;
    decideForIdentityMock.mockClear();
    sendDmMock.mockClear();
    subscriptionFindUnique.mockClear();
  });

  test("denies DM send rejected by policy before subscription checks", async () => {
    const { dmBoundaryApi } = await import("./dm-boundary.api");
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
    expect(subscriptionFindUnique).not.toHaveBeenCalled();
    expect(sendDmMock).not.toHaveBeenCalled();
  });
});
