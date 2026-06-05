import { describe, expect, mock, test } from "bun:test";
import { UnitType } from "../../../prisma/generated/client.js";
import { Subscription, Unit, User } from "../schema";
import { seedEngagement } from "./engagement";
import type { SeedCtx } from "./strategy";

type CountSpec = { target?: number; max: number };

function createDbMock() {
  const insertedSubscriptionRows: Array<Record<string, unknown>> = [];
  const insertOnConflictDoNothing = mock(async () => undefined);
  const insertValues = mock((rows: Array<Record<string, unknown>>) => {
    insertedSubscriptionRows.push(...rows);
    return { onConflictDoNothing: insertOnConflictDoNothing };
  });
  const insert = mock((table: unknown) => {
    expect(table).toBe(Subscription);
    return { values: insertValues };
  });

  const userUpdateWhere = mock(async () => undefined);
  const unitUpdateWhere = mock(async () => undefined);
  const userUpdateSet = mock((_value: unknown) => ({ where: userUpdateWhere }));
  const unitUpdateSet = mock((_value: unknown) => ({ where: unitUpdateWhere }));
  const update = mock((table: unknown) => {
    if (table === User) return { set: userUpdateSet };
    if (table === Unit) return { set: unitUpdateSet };
    throw new Error("Unexpected update table");
  });

  return {
    db: { insert, update },
    insertedSubscriptionRows,
    insert,
    userUpdateSet,
    unitUpdateSet,
  };
}

describe("seedEngagement", () => {
  test("creates Subscription rows with subscribedUnitId", async () => {
    const dbMock = createDbMock();

    const ctx = {
      db: dbMock.db,
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

    expect(dbMock.insert).toHaveBeenCalledTimes(1);
    expect(dbMock.insertedSubscriptionRows).toHaveLength(2);
    expect(dbMock.insertedSubscriptionRows[0]).toHaveProperty(
      "subscribedUnitId",
    );
    expect(dbMock.insertedSubscriptionRows[0]).not.toHaveProperty(
      "targetUnitId",
    );
    expect(
      dbMock.insertedSubscriptionRows.map((row) => [
        row.subscriberUnitId,
        row.subscribedUnitId,
      ]),
    ).toEqual([
      [users[0]?.userId, users[1]?.userId],
      [users[1]?.userId, users[0]?.userId],
    ]);

    expect(dbMock.userUpdateSet).toHaveBeenCalledTimes(2);
    expect(dbMock.unitUpdateSet).toHaveBeenCalledTimes(2);
  });

  test("skips follow seeding when no users can be followed", async () => {
    const dbMock = createDbMock();

    const ctx = {
      db: dbMock.db,
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

    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});
