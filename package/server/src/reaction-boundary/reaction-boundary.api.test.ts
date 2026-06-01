import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";

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
  reaction: "like",
  createdAt: "2026-05-28T00:00:00.000Z",
  created: true,
}));

installPrismaClientMock();
Object.assign(prismaMock, {
  unit: {
    findUnique: mock(async () => null),
  },
});

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({ identity: currentIdentity }),
  }),
}));

mock.module("@/governance", () => ({
  contentPolicyActions: {
    reactionCreate: "reaction.create",
  },
  governanceRoutePolicyService: {
    decideForIdentity: decideForIdentityMock,
  },
}));

mock.module("@/notify-boundary/notify-boundary.client", () => ({
  broadcast: mock(async () => undefined),
}));

mock.module("./reaction-boundary.client", () => ({
  createReaction: createReactionMock,
  removeReaction: mock(async () => ({ success: true })),
}));

describe("reactionBoundaryApi", () => {
  beforeEach(() => {
    policyAllowed = false;
    decideForIdentityMock.mockClear();
    createReactionMock.mockClear();
  });

  test("denies reaction creation rejected by policy", async () => {
    const { reactionBoundaryApi } = await import("./reaction-boundary.api");
    const response = await reactionBoundaryApi.handle(
      new Request("http://localhost/reaction/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetId: "post-1", reaction: "like" }),
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
    prismaMock.unit.findUnique = mock(async () => ({
      userId: "owner-1",
      targetUnitId: "canonical-target",
    }));
    const { reactionBoundaryApi } = await import("./reaction-boundary.api");

    const response = await reactionBoundaryApi.handle(
      new Request("http://localhost/reaction/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetId: "post-1", reaction: "like" }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createReactionMock).toHaveBeenCalledWith(
      currentIdentity.userId,
      "post-1",
      "like",
    );
    expect(prismaMock.unit.findUnique).toHaveBeenCalledWith({
      where: { id: "post-1" },
      select: { userId: true },
    });
  });
});
