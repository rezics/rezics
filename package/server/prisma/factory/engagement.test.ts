import { describe, expect, mock, test } from "bun:test";
import { UnitType } from "../generated/client.js";
import { seedEngagement } from "./engagement";
import type { SeedCtx } from "./strategy";

describe("seedEngagement", () => {
  test("creates Subscription rows with subscribedUnitId", async () => {
    const subscriptionCreateMany = mock(async () => undefined);
    const userUpdate = mock(async () => undefined);
    const unitUpdate = mock(async () => undefined);

    const ctx = {
      prisma: {
        subscription: { createMany: subscriptionCreateMany },
        user: { update: userUpdate },
        unit: { update: unitUpdate },
      },
      draw: (spec) => spec.target ?? spec.max,
    } as unknown as SeedCtx;

    const users = [
      { userId: "00000000-0000-7000-8000-000000000001", name: "A", slug: "a" },
      { userId: "00000000-0000-7000-8000-000000000002", name: "B", slug: "b" },
    ];

    await seedEngagement(
      ctx,
      {
        followsPerUser: { min: 1, max: 1, target: 1 },
        favoriteItemsPerUser: { min: 0, max: 0, target: 0 },
      },
      users,
      [],
    );

    expect(subscriptionCreateMany).toHaveBeenCalledTimes(1);
    const createManyArg = subscriptionCreateMany.mock.calls[0]?.[0] as {
      data: Array<Record<string, unknown>>;
    };

    expect(createManyArg.data).toHaveLength(2);
    expect(createManyArg.data[0]).toHaveProperty("subscribedUnitId");
    expect(createManyArg.data[0]).not.toHaveProperty("targetUnitId");
    expect(
      createManyArg.data.map((row) => [
        row.subscriberUnitId,
        row.subscribedUnitId,
      ]),
    ).toEqual([
      [users[0].userId, users[1].userId],
      [users[1].userId, users[0].userId],
    ]);

    expect(userUpdate).toHaveBeenCalledTimes(2);
    expect(unitUpdate).toHaveBeenCalledTimes(2);
    expect(
      unitUpdate.mock.calls.map((call) => call[0]?.where.id).sort(),
    ).toEqual(users.map((user) => user.userId).sort());
  });

  test("skips follow seeding when no users can be followed", async () => {
    const subscriptionCreateMany = mock(async () => undefined);

    const ctx = {
      prisma: {
        subscription: { createMany: subscriptionCreateMany },
        user: { update: mock(async () => undefined) },
        unit: { update: mock(async () => undefined) },
      },
      draw: (spec) => spec.target ?? spec.max,
    } as unknown as SeedCtx;

    await seedEngagement(
      ctx,
      {
        followsPerUser: { min: 1, max: 1, target: 1 },
        favoriteItemsPerUser: { min: 0, max: 0, target: 0 },
      },
      [
        {
          userId: "00000000-0000-7000-8000-000000000001",
          name: "A",
          slug: "a",
        },
      ],
      [{ id: "00000000-0000-7000-8000-000000000010", type: UnitType.BOOK }],
    );

    expect(subscriptionCreateMany).not.toHaveBeenCalled();
  });
});
