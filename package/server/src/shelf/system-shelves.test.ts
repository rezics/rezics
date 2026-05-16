import { describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();
Object.assign(prismaMock, {});

function makeClient() {
  const unitFindFirst = mock(async () => null as { id: string } | null);
  const shelfCreate = mock(async () => ({}));
  const unitCreate = mock(async ({ data }: any) => ({
    id: `${data.slug}-shelf`,
  }));

  return {
    unitFindFirst,
    shelfCreate,
    unitCreate,
    client: {
      shelf: {
        create: shelfCreate,
      },
      unit: {
        findFirst: unitFindFirst,
        create: unitCreate,
      },
    },
  };
}

function firstArg(fn: { mock: { calls: unknown[][] } }) {
  return fn.mock.calls[0]?.[0] as any;
}

describe("system shelves", () => {
  test("recognizes reserved system kind keys", async () => {
    const { isSystemKindKey, SYSTEM_KIND_KEYS } = await import(
      "./system-shelves"
    );

    expect(SYSTEM_KIND_KEYS).toEqual([
      "favorites",
      "backlog",
      "active",
      "completed",
    ]);
    expect(isSystemKindKey("favorites")).toBe(true);
    expect(isSystemKindKey("custom")).toBe(false);
  });

  test("bootstrap creates four slug-bearing system shelves", async () => {
    const { bootstrapSystemShelves } = await import("./system-shelves");
    const mocks = makeClient();

    await bootstrapSystemShelves("user-1", mocks.client as any);

    expect(mocks.unitFindFirst).toHaveBeenCalledTimes(4);
    expect(mocks.unitCreate).toHaveBeenCalledTimes(4);
    expect(mocks.shelfCreate).toHaveBeenCalledTimes(4);

    const unitCreateCalls = mocks.unitCreate.mock.calls as any[];
    const slugAndScopePerCall = unitCreateCalls.map((call) => ({
      slug: call[0].data.slug,
      slugScope: call[0].data.slugScope,
      userId: call[0].data.userId,
    }));
    expect(slugAndScopePerCall).toEqual([
      { slug: "favorites", slugScope: "user-1", userId: "user-1" },
      { slug: "backlog", slugScope: "user-1", userId: "user-1" },
      { slug: "active", slugScope: "user-1", userId: "user-1" },
      { slug: "completed", slugScope: "user-1", userId: "user-1" },
    ]);

    expect(
      (mocks.shelfCreate.mock.calls as any[]).map(
        (call) => call[0].data.kindKey,
      ),
    ).toEqual(["favorites", "backlog", "active", "completed"]);
  });

  test("lookup resolves existing shelf via unit slug index without creating", async () => {
    const { getOrCreateSystemShelf } = await import("./system-shelves");
    const mocks = makeClient();
    mocks.unitFindFirst.mockResolvedValueOnce({ id: "existing-active" });

    const shelfId = await getOrCreateSystemShelf(
      "user-1",
      "active",
      mocks.client as any,
    );

    expect(shelfId).toBe("existing-active");
    expect(mocks.unitCreate).not.toHaveBeenCalled();
    expect(mocks.shelfCreate).not.toHaveBeenCalled();
    expect(firstArg(mocks.unitFindFirst).where).toEqual({
      type: "SHELF",
      slug: "active",
      slugScope: "user-1",
    });
  });

  test("safety-net create mints slug + scope when no shelf exists", async () => {
    const { getOrCreateSystemShelf } = await import("./system-shelves");
    const mocks = makeClient();

    const shelfId = await getOrCreateSystemShelf(
      "user-2",
      "favorites",
      mocks.client as any,
    );

    expect(shelfId).toBe("favorites-shelf");
    const created = firstArg(mocks.unitCreate);
    expect(created.data.slug).toBe("favorites");
    expect(created.data.slugScope).toBe("user-2");
    expect(created.data.userId).toBe("user-2");
  });

  test("create branch recovers from P2002 race by re-issuing find", async () => {
    const { getOrCreateSystemShelf } = await import("./system-shelves");
    const mocks = makeClient();

    mocks.unitFindFirst.mockResolvedValueOnce(null);
    mocks.unitCreate.mockImplementationOnce(async () => {
      throw Object.assign(new Error("unique violation"), { code: "P2002" });
    });
    mocks.unitFindFirst.mockResolvedValueOnce({ id: "raced-completed" });

    const shelfId = await getOrCreateSystemShelf(
      "user-3",
      "completed",
      mocks.client as any,
    );

    expect(shelfId).toBe("raced-completed");
    expect(mocks.unitFindFirst).toHaveBeenCalledTimes(2);
    expect(mocks.unitCreate).toHaveBeenCalledTimes(1);
    expect(mocks.shelfCreate).not.toHaveBeenCalled();
  });
});
