import { describe, expect, mock, test } from "bun:test";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import { UnitType } from "./storage-values.js";
import {
  Shelf,
  ShelfUnit,
  Subscription,
  Unit,
  UnitTranslation,
  User,
} from "../schema";
import { seedEngagement } from "./engagement";
import type { SeedCtx } from "./strategy";

type CountSpec = { target?: number; max: number };

function createDbMock() {
  const insertedRows = new Map<unknown, Array<Record<string, unknown>>>();
  const insertOnConflictDoNothing = mock(async () => undefined);
  const recordRows = (table: unknown, rows: Record<string, unknown>[]) => {
    const existing = insertedRows.get(table) ?? [];
    existing.push(...rows);
    insertedRows.set(table, existing);
  };
  const insert = mock((table: unknown) => ({
    values(value: Record<string, unknown> | Array<Record<string, unknown>>) {
      recordRows(table, Array.isArray(value) ? value : [value]);
      return { onConflictDoNothing: insertOnConflictDoNothing };
    },
  }));

  const shelfUpdateWhere = mock(async () => undefined);
  const shelfUpdateSet = mock((_value: unknown) => ({
    where: shelfUpdateWhere,
  }));
  const userUpdateWhere = mock(async () => undefined);
  const unitUpdateWhere = mock(async () => undefined);
  const userUpdateSet = mock((_value: unknown) => ({ where: userUpdateWhere }));
  const unitUpdateSet = mock((_value: unknown) => ({ where: unitUpdateWhere }));
  const update = mock((table: unknown) => {
    if (table === Shelf) return { set: shelfUpdateSet };
    if (table === User) return { set: userUpdateSet };
    if (table === Unit) return { set: unitUpdateSet };
    throw new Error("Unexpected update table");
  });

  return {
    db: { insert, update },
    rowsFor(table: unknown) {
      return insertedRows.get(table) ?? [];
    },
    insert,
    shelfUpdateSet,
    userUpdateSet,
    unitUpdateSet,
  };
}

describe("seedEngagement", () => {
  test("creates favorite shelves through Drizzle", async () => {
    const dbMock = createDbMock();

    const ctx = {
      db: dbMock.db,
      draw: (spec: CountSpec) => spec.target ?? spec.max,
    } as unknown as SeedCtx;

    const users = [
      { userId: "00000000-0000-7000-8000-000000000001", name: "A", slug: "a" },
    ];

    await seedEngagement(
      ctx,
      {
        followsPerUser: { min: 0, max: 0, target: 0 },
        favoriteItemsPerUser: { min: 2, max: 2, target: 2 },
      },
      users,
      [
        { id: "00000000-0000-7000-8000-000000000010", type: UnitType.BOOK },
        { id: "00000000-0000-7000-8000-000000000011", type: UnitType.GAME },
      ],
    );

    expect(dbMock.rowsFor(Unit)).toHaveLength(1);
    expect(dbMock.rowsFor(Shelf)).toHaveLength(1);
    expect(dbMock.rowsFor(UnitTranslation)).toEqual([
      expect.objectContaining({
        language: DEFAULT_LANGUAGE,
        title: "Favorites",
      }),
    ]);
    expect(dbMock.rowsFor(ShelfUnit)).toHaveLength(2);
    expect(dbMock.shelfUpdateSet).toHaveBeenCalledWith({ itemCount: 2 });
  });

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

    const insertedSubscriptionRows = dbMock.rowsFor(Subscription);
    expect(dbMock.insert).toHaveBeenCalledTimes(1);
    expect(insertedSubscriptionRows).toHaveLength(2);
    expect(insertedSubscriptionRows[0]).toHaveProperty("subscribedUnitId");
    expect(insertedSubscriptionRows[0]).not.toHaveProperty("targetUnitId");
    expect(
      insertedSubscriptionRows.map((row) => [
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
