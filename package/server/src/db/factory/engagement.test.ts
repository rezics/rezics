import { describe, expect, mock, test } from "bun:test";
import { UnitType } from "../../../prisma/generated/client.js";
import { seedEngagement } from "./engagement";
import type { SeedCtx } from "./strategy";

type CountSpec = { target?: number; max: number };

describe("seedEngagement", () => {
  test("creates Subscription rows with subscribedUnitId", async () => {
    const subscriptionCreateMany = mock(async (_args: unknown) => undefined);
    const userUpdate = mock(async (_args: unknown) => undefined);
    const unitUpdate = mock(async (_args: unknown) => undefined);

    const ctx = {
      prisma: {
        subscription: { createMany: subscriptionCreateMany },
        user: { update: userUpdate },
        unit: { update: unitUpdate },
      },
      draw: (spec: CountSpec) => spec.target ?? spec.max,
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
      [users[0]?.userId, users[1]?.userId],
      [users[1]?.userId, users[0]?.userId],
    ]);

    expect(userUpdate).toHaveBeenCalledTimes(2);
    expect(unitUpdate).toHaveBeenCalledTimes(2);
    expect(
      unitUpdate.mock.calls.map((call) => (call[0] as any).where.id).sort(),
    ).toEqual(users.map((user) => user.userId).sort());
  });

  test("skips follow seeding when no users can be followed", async () => {
    const subscriptionCreateMany = mock(async (_args: unknown) => undefined);

    const ctx = {
      prisma: {
        subscription: { createMany: subscriptionCreateMany },
        user: { update: mock(async (_args: unknown) => undefined) },
        unit: { update: mock(async (_args: unknown) => undefined) },
      },
      draw: (spec: CountSpec) => spec.target ?? spec.max,
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
