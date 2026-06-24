import { describe, expect, test } from "bun:test";
import { bucketize } from "./progress";
import { setSearchDb, syncProgressSegment, syncSingleProgress } from "./sync";

function createDb(rowSets: unknown[][]) {
  const createChain = () => ({
    where() {
      return createChain();
    },
    orderBy() {
      return createChain();
    },
    async limit() {
      return rowSets.shift() ?? [];
    },
  });

  return {
    select() {
      return {
        from() {
          return createChain();
        },
      };
    },
  };
}

const progressRow = {
  id: "progress-1",
  userId: "user-1",
  unitId: "unit-1",
  progress: 0.34,
  status: "ACTIVE",
  isDeleted: false,
  lastSeenAt: new Date("2026-05-31T00:00:00.000Z"),
};

describe("bucketize", () => {
  test("maps progress boundaries into ten fixed buckets", () => {
    expect(bucketize(0)).toBe(0);
    expect(bucketize(0.099999)).toBe(0);
    expect(bucketize(0.1)).toBe(1);
    expect(bucketize(0.5)).toBe(5);
    expect(bucketize(0.9)).toBe(9);
    expect(bucketize(0.999999)).toBe(9);
    expect(bucketize(1)).toBe(9);
  });

  test("maps mid-range values and clamps out-of-range input", () => {
    expect(bucketize(0.27)).toBe(2);
    expect(bucketize(0.34)).toBe(3);
    expect(bucketize(0.76)).toBe(7);
    expect(bucketize(-0.1)).toBe(0);
    expect(bucketize(1.1)).toBe(9);
  });
});

describe("user unit progress search sync", () => {
  test("syncSingleProgress reads from Drizzle db", async () => {
    const documents: unknown[] = [];
    setSearchDb(createDb([[progressRow]]) as never);

    await syncSingleProgress(
      {
        addOrUpdateProgress: async (input: unknown[]) => {
          documents.push(...input);
        },
      } as never,
      "user-1",
      "unit-1",
    );

    expect(documents).toEqual([
      {
        id: "user-1:unit-1",
        progressId: "progress-1",
        userId: "user-1",
        unitId: "unit-1",
        status: "ACTIVE",
        progressBucket: 3,
        lastSeenAt: 1780185600,
      },
    ]);
  });

  test("syncSingleProgress removes missing or deleted rows", async () => {
    const deleted: string[] = [];
    setSearchDb(createDb([[{ ...progressRow, isDeleted: true }], []]) as never);
    const client = {
      deleteProgress: async (id: string) => {
        deleted.push(id);
      },
    } as never;

    await syncSingleProgress(client, "user-1", "unit-1");
    await syncSingleProgress(client, "user-1", "unit-2");

    expect(deleted).toEqual(["user-1:unit-1", "user-1:unit-2"]);
  });

  test("syncProgressSegment returns cursor from Drizzle rows", async () => {
    const documents: unknown[] = [];
    setSearchDb(
      createDb([
        [
          progressRow,
          {
            ...progressRow,
            unitId: "unit-2",
            progress: 0.8,
          },
        ],
      ]) as never,
    );

    const result = await syncProgressSegment(
      {
        addOrUpdateProgress: async (input: unknown[]) => {
          documents.push(...input);
        },
      } as never,
      { limit: 1, cursor: "user-0:unit-9" },
    );

    expect(result).toEqual({ processed: 1, nextCursor: "user-1:unit-1" });
    expect(documents).toHaveLength(1);
  });
});
