import { describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();

describe("UserTagApplicationService", () => {
  test("lists caller-scoped tags for one unit", async () => {
    const findMany = mock(async () => []);
    Object.assign(prismaMock, {
      userTagApplication: { findMany },
    });

    const { UserTagApplicationService } = await import("./service");
    await new UserTagApplicationService().listForUnit("user-1", "unit-1");

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", unitId: "unit-1" },
      orderBy: [{ position: "asc" }, { tagUnitId: "asc" }],
    });
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

    const { UserTagApplicationService } = await import("./service");
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

  test("deleteOne only deletes the caller-owned user tag", async () => {
    const deleteMany = mock(async () => ({ count: 1 }));
    Object.assign(prismaMock, {
      userTagApplication: { deleteMany },
    });

    const { UserTagApplicationService } = await import("./service");
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
