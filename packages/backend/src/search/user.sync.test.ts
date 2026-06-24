import { describe, expect, test } from "bun:test";
import { setSearchDb, syncSingleUser, syncUserSegment } from "./sync";

function createDb(rowSets: unknown[][]) {
  const calls = {
    selects: 0,
  };

  const createChain = () => ({
    leftJoin() {
      return createChain();
    },
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
    db: {
      select() {
        calls.selects += 1;
        return {
          from() {
            return createChain();
          },
        };
      },
    },
    calls,
  };
}

describe("Drizzle user search sync", () => {
  test("syncSingleUser builds a user document with Unit slug", async () => {
    const { db } = createDb([
      [
        {
          unitId: "user-1",
          email: "seed@example.com",
          name: "Seed User",
          avatar: null,
          summary: null,
          description: null,
          followersCount: 1,
          followingsCount: 2,
          joinDate: new Date("2026-01-02T03:04:05.000Z"),
          permission: { role: "USER" },
          slug: "seed-user",
        },
      ],
    ]);
    const documents: unknown[] = [];
    setSearchDb(db as never);

    await syncSingleUser(
      {
        addOrUpdateUsers: async (input: unknown[]) => {
          documents.push(...input);
        },
      } as never,
      "user-1",
    );

    expect(documents).toEqual([
      {
        id: "user-1",
        unitId: "user-1",
        email: "seed@example.com",
        name: "Seed User",
        avatar: null,
        summary: null,
        description: null,
        descriptionText: null,
        followersCount: 1,
        followingsCount: 2,
        joinDate: "2026-01-02T03:04:05.000Z",
        permission: { role: "USER" },
        slug: "seed-user",
      },
    ]);
  });

  test("syncSingleUser deletes the stale document when db row is missing", async () => {
    const { db } = createDb([[]]);
    const deleted: string[] = [];
    setSearchDb(db as never);

    await syncSingleUser(
      {
        deleteUsers: async (ids: string[]) => {
          deleted.push(...ids);
        },
      } as never,
      "user-missing",
    );

    expect(deleted).toEqual(["user-missing"]);
  });

  test("syncUserSegment returns cursor from Drizzle rows", async () => {
    const { db } = createDb([
      [
        {
          unitId: "user-1",
          email: "one@example.com",
          name: "One",
          avatar: null,
          summary: null,
          description: null,
          followersCount: 0,
          followingsCount: 0,
          joinDate: null,
          permission: null,
          slug: "one",
        },
        {
          unitId: "user-2",
          email: "two@example.com",
          name: "Two",
          avatar: null,
          summary: null,
          description: null,
          followersCount: 0,
          followingsCount: 0,
          joinDate: null,
          permission: null,
          slug: "two",
        },
      ],
    ]);
    const documents: unknown[] = [];
    setSearchDb(db as never);

    const result = await syncUserSegment(
      {
        addOrUpdateUsers: async (input: unknown[]) => {
          documents.push(...input);
        },
      } as never,
      { limit: 1 },
    );

    expect(result).toEqual({ processed: 1, nextCursor: "user-1" });
    expect(documents).toHaveLength(1);
  });
});
