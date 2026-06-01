import { describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: mock(async () => ({ status: "created" })),
  },
}));

installPrismaClientMock();

describe("UserTagApplicationService", () => {
  test("direct user tag visibility follows profile privacy", async () => {
    const { canViewDirectUserTags } = await import(
      "./user-tag-application.service"
    );

    expect(
      canViewDirectUserTags({
        ownerUserId: "owner-1",
        viewerUserId: "owner-1",
        settings: { privacy: { userTags: "private" } },
      }),
    ).toBe(true);
    expect(
      canViewDirectUserTags({
        ownerUserId: "owner-1",
        viewerUserId: "viewer-1",
        settings: { privacy: { userTags: "public" } },
      }),
    ).toBe(true);
    expect(
      canViewDirectUserTags({
        ownerUserId: "owner-1",
        viewerUserId: "viewer-1",
        settings: { privacy: { userTags: "followers" } },
        isFollower: true,
      }),
    ).toBe(true);
    expect(
      canViewDirectUserTags({
        ownerUserId: "owner-1",
        viewerUserId: "viewer-1",
        settings: { privacy: { userTags: "followers" } },
      }),
    ).toBe(false);
    expect(
      canViewDirectUserTags({
        ownerUserId: "owner-1",
        viewerUserId: "viewer-1",
        settings: {},
      }),
    ).toBe(false);
  });

  test("lists caller-scoped tags for one unit", async () => {
    const findMany = mock(async () => []);
    Object.assign(prismaMock, {
      userTagApplication: { findMany },
    });

    const { UserTagApplicationService } = await import(
      "./user-tag-application.service"
    );
    await new UserTagApplicationService().listForUnit("user-1", "unit-1");

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", unitId: "unit-1" },
      orderBy: [{ position: "asc" }, { tagUnitId: "asc" }],
    });
  });

  test("lists another user's tags only when direct privacy permits", async () => {
    const tagRows = [
      {
        userId: "owner-1",
        unitId: "unit-1",
        tagUnitId: "tag-1",
        position: "00000000",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];
    const findMany = mock(async () => tagRows);
    const userFindUnique = mock(async () => ({
      settings: { privacy: { userTags: "followers" } },
    }));
    const subscriptionFindUnique = mock(async () => ({ id: "sub-1" }));
    Object.assign(prismaMock, {
      user: { findUnique: userFindUnique },
      subscription: { findUnique: subscriptionFindUnique },
      userTagApplication: { findMany },
    });

    const { UserTagApplicationService } = await import(
      "./user-tag-application.service"
    );
    const rows = await new UserTagApplicationService().listForUserUnit(
      "owner-1",
      "unit-1",
      "viewer-1",
    );

    expect(userFindUnique).toHaveBeenCalledWith({
      where: { unitId: "owner-1" },
      select: { settings: true },
    });
    expect(subscriptionFindUnique).toHaveBeenCalledWith({
      where: {
        subscriberUnitId_subscribedUnitId: {
          subscriberUnitId: "viewer-1",
          subscribedUnitId: "owner-1",
        },
      },
      select: { id: true },
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "owner-1", unitId: "unit-1" },
      orderBy: [{ position: "asc" }, { tagUnitId: "asc" }],
    });
    expect(rows).toBe(tagRows);
  });

  test("hides another user's direct tags when privacy blocks", async () => {
    const findMany = mock(async () => []);
    Object.assign(prismaMock, {
      user: { findUnique: mock(async () => ({ settings: {} })) },
      subscription: { findUnique: mock(async () => null) },
      userTagApplication: { findMany },
    });

    const { UserTagApplicationService } = await import(
      "./user-tag-application.service"
    );
    const rows = await new UserTagApplicationService().listForUserUnit(
      "owner-1",
      "unit-1",
      "viewer-1",
    );

    expect(rows).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  test("setForUnit replaces tags through shared collection metadata helper", async () => {
    const deleteMany = mock(async () => ({ count: 0 }));
    const createMany = mock(async () => ({ count: 2 }));
    const findMany = mock(async () => []);
    const transaction = mock(async (fn: any) =>
      fn({
        userTagApplication: { deleteMany, createMany },
        userUnitCollection: { upsert: mock(async () => ({})) },
      }),
    );
    Object.assign(prismaMock, {
      $transaction: transaction,
      userTagApplication: { findMany },
    });

    const { UserTagApplicationService } = await import(
      "./user-tag-application.service"
    );
    await new UserTagApplicationService().setForUnit("user-1", {
      unitId: "unit-1",
      tagUnitIds: ["tag-1", "tag-2"],
    });

    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", unitId: "unit-1" },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "user-1",
          unitId: "unit-1",
          tagUnitId: "tag-1",
          position: "00000000",
        },
        {
          userId: "user-1",
          unitId: "unit-1",
          tagUnitId: "tag-2",
          position: "00000001",
        },
      ],
      skipDuplicates: true,
    });
  });

  test("setForUnit tags the requested unit id without resolving Unit.targetUnitId", async () => {
    const deleteMany = mock(async () => ({ count: 0 }));
    const createMany = mock(async () => ({ count: 1 }));
    const findMany = mock(async () => []);
    const unitFindUnique = mock(async () => ({
      id: "unit-1",
      targetUnitId: "canonical-target",
    }));
    const transaction = mock(async (fn: any) =>
      fn({
        unit: { findUnique: unitFindUnique },
        userTagApplication: { deleteMany, createMany },
        userUnitCollection: { upsert: mock(async () => ({})) },
      }),
    );
    Object.assign(prismaMock, {
      $transaction: transaction,
      userTagApplication: { findMany },
    });

    const { UserTagApplicationService } = await import(
      "./user-tag-application.service"
    );
    await new UserTagApplicationService().setForUnit("user-1", {
      unitId: "unit-1",
      tagUnitIds: ["tag-1"],
    });

    expect(unitFindUnique).not.toHaveBeenCalled();
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", unitId: "unit-1" },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "user-1",
          unitId: "unit-1",
          tagUnitId: "tag-1",
          position: "00000000",
        },
      ],
      skipDuplicates: true,
    });
  });

  test("deleteOne only deletes the caller-owned user tag", async () => {
    const deleteMany = mock(async () => ({ count: 1 }));
    Object.assign(prismaMock, {
      userTagApplication: { deleteMany },
    });

    const { UserTagApplicationService } = await import(
      "./user-tag-application.service"
    );
    await new UserTagApplicationService().deleteOne(
      "user-1",
      "unit-1",
      "tag-1",
    );

    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", unitId: "unit-1", tagUnitId: "tag-1" },
    });
  });
});
