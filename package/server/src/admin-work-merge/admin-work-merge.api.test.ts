import { describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

let currentIdentity = {
  sub: "user-1",
  userId: "user-1",
  permission: { role: "USER" },
};
let dbAdmin = false;

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
  isAdminRole: (identity: { permission?: { role?: string } } | null) =>
    identity?.permission?.role === "ADMIN" ||
    identity?.permission?.role === "ROOT",
  verifyAdminFromDb: async () => dbAdmin,
}));

describe("adminWorkMergeApi", () => {
  test("denies non-admin callers", async () => {
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
    expect(unitFindUnique).not.toHaveBeenCalled();
  });

  test("allows database-confirmed admin callers", async () => {
    currentIdentity = {
      sub: "admin-1",
      userId: "admin-1",
      permission: { role: "ADMIN" },
    };
    dbAdmin = true;
    unitFindUnique.mockClear();

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
    expect(unitFindUnique).toHaveBeenCalled();
  });
});
