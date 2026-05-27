import { describe, expect, mock, test } from "bun:test";
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

const unitFindUnique = mock(async ({ where }: any) =>
  where.id === "source-work" || where.id === "target-work"
    ? { id: where.id, workUnitId: null }
    : null,
);
const unitWorkFindMany = mock(async () => []);
const unitFindMany = mock(async () => []);
const unitTagFindMany = mock(async () => []);
const unitAliasFindMany = mock(async () => []);

Object.assign(prismaMock, {
  unit: { findUnique: unitFindUnique, findMany: unitFindMany },
  unitWork: { findMany: unitWorkFindMany },
  unitTag: { findMany: unitTagFindMany },
  unitAlias: { findMany: unitAliasFindMany },
});

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({ identity: currentIdentity }),
  }),
  isAdminRole: mock(() => false),
  tryResolveIdentity: mock(async () => null),
}));

mock.module("@/governance", () => ({
  contentPolicyActions: {
    delete: "content.delete",
  },
  governanceRoutePolicyService: {
    decideForIdentity: decideForIdentityMock,
  },
  realmPolicyActions: {
    memberRoleChange: "realm.member.role.change",
  },
  sitePolicyActions: {
    repairRun: "operation.repair.run",
  },
}));

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: { enqueue: mock(async () => ({ status: "created" })) },
}));

mock.module("@/utils/errors", () => ({
  AppError: class AppError extends Error {
    statusCode: number;
    code?: string;

    constructor(message: string, statusCode = 400, code?: string) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
    }
  },
}));

describe("adminWorkMergeApi", () => {
  test("denies policy-rejected callers", async () => {
    policyAllowed = false;
    decideForIdentityMock.mockClear();

    const { adminWorkMergeApi } = await import("./admin-work-merge.api");
    const response = await adminWorkMergeApi.handle(
      new Request("http://localhost/admin/work-merge/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceWorkUnitId: "source-work",
          targetWorkUnitId: "target-work",
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Denied by policy");
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "operation.repair.run",
      target: {
        kind: "work-merge",
        id: "source-work:target-work",
      },
    });
    expect(unitFindUnique).not.toHaveBeenCalled();
  });

  test("allows policy-approved callers", async () => {
    currentIdentity = {
      sub: "admin-1",
      userId: "admin-1",
      permission: { role: "ADMIN" },
    };
    policyAllowed = true;
    unitFindUnique.mockClear();
    decideForIdentityMock.mockClear();

    const { adminWorkMergeApi } = await import("./admin-work-merge.api");
    const response = await adminWorkMergeApi.handle(
      new Request("http://localhost/admin/work-merge/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceWorkUnitId: "source-work",
          targetWorkUnitId: "target-work",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(decideForIdentityMock).toHaveBeenCalled();
    expect(unitFindUnique).toHaveBeenCalled();
  });
});
