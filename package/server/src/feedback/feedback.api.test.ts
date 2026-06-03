import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";

let currentIdentity = {
  sub: "user-1",
  userId: "user-1",
  permission: { role: "USER" },
};
let policyAllowed = false;
const decideForIdentityMock = mock(async () => ({
  allowed: policyAllowed,
  code: policyAllowed ? "ALLOWED" : "MISSING_CAPABILITY",
  safeMessage: policyAllowed ? "Allowed" : "Denied by policy",
}));

installPrismaClientMock();

const now = new Date("2026-05-28T00:00:00.000Z");
const feedbackRow = {
  id: "feedback-1",
  userId: "user-1",
  targetKind: "COMMENT",
  targetId: "comment-1",
  addressedUnitId: "post-1",
  url: null,
  content: "Report content",
  type: "REPORT",
  resolved: false,
  resolvedAt: null,
  createdAt: now,
  updatedAt: now,
};

const feedbackFindMany = mock(async () => [feedbackRow]);
const feedbackCount = mock(async () => 1);
const feedbackFindUniqueOrThrow = mock(async () => feedbackRow);
const feedbackUpdate = mock(async ({ data }: any) => ({
  ...feedbackRow,
  resolved: data.resolved,
  resolvedAt: data.resolvedAt,
}));

Object.assign(prismaMock, {
  feedback: {
    findMany: feedbackFindMany,
    count: feedbackCount,
    findUniqueOrThrow: feedbackFindUniqueOrThrow,
    update: feedbackUpdate,
  },
});

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
    create: "content.create",
    delete: "content.delete",
  },
  governanceModerationService: {
    listModerationOverlays: mock(async () => []),
  },
  governanceRoutePolicyService: {
    decideForIdentity: decideForIdentityMock,
  },
  realmPolicyActions: {
    memberRoleChange: "realm.member.role.change",
  },
  sitePolicyActions: {
    auditRead: "audit.read",
    queueDecide: "queue.site.decide",
  },
}));

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: { enqueue: mock(async () => ({ status: "created" })) },
}));

describe("feedbackApi", () => {
  beforeEach(() => {
    currentIdentity = {
      sub: "user-1",
      userId: "user-1",
      permission: { role: "USER" },
    };
    policyAllowed = false;
    decideForIdentityMock.mockClear();
    feedbackFindMany.mockClear();
    feedbackCount.mockClear();
    feedbackFindUniqueOrThrow.mockClear();
    feedbackUpdate.mockClear();
  });

  test("denies policy-rejected admin list callers", async () => {
    const { feedbackApi } = await import("./feedback.api");
    const response = await feedbackApi.handle(
      new Request("http://localhost/feedback/list"),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Denied by policy");
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "audit.read",
      target: { kind: "feedback-list", id: "all" },
    });
    expect(feedbackFindMany).not.toHaveBeenCalled();
  });

  test("allows policy-approved admin list callers", async () => {
    currentIdentity = {
      sub: "admin-1",
      userId: "admin-1",
      permission: { role: "ADMIN" },
    };
    policyAllowed = true;

    const { feedbackApi } = await import("./feedback.api");
    const response = await feedbackApi.handle(
      new Request("http://localhost/feedback/list"),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "audit.read",
      target: { kind: "feedback-list", id: "all" },
    });
    expect(feedbackFindMany).toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      totalItems: 1,
      items: [{ id: "feedback-1" }],
    });
  });

  test("lets users list their own feedback without policy", async () => {
    const { feedbackApi } = await import("./feedback.api");
    const response = await feedbackApi.handle(
      new Request("http://localhost/feedback/by-user/user-1"),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).not.toHaveBeenCalled();
    expect(feedbackFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" }),
      }),
    );
  });

  test("checks audit policy for cross-user feedback reads", async () => {
    policyAllowed = true;

    const { feedbackApi } = await import("./feedback.api");
    const response = await feedbackApi.handle(
      new Request("http://localhost/feedback/by-user/user-2"),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "audit.read",
      target: { kind: "feedback-user", id: "user-2" },
    });
  });

  test("checks queue decision policy before resolving reports", async () => {
    currentIdentity = {
      sub: "admin-1",
      userId: "admin-1",
      permission: { role: "ADMIN" },
    };
    policyAllowed = true;

    const { feedbackApi } = await import("./feedback.api");
    const response = await feedbackApi.handle(
      new Request("http://localhost/feedback/feedback-1/resolve", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resolved: true }),
      }),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "queue.site.decide",
      target: { kind: "feedback", id: "feedback-1" },
    });
    expect(feedbackUpdate).toHaveBeenCalled();
  });
});
