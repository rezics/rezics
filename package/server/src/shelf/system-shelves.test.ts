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

  test("bootstrap creates four slug-bearing system shelves with formatted titles", async () => {
    const { bootstrapSystemShelves } = await import("./system-shelves");
    const mocks = makeClient();

    await bootstrapSystemShelves("user-1", "alice", mocks.client as any);

    expect(mocks.unitFindFirst).toHaveBeenCalledTimes(4);
    expect(mocks.unitCreate).toHaveBeenCalledTimes(4);
    expect(mocks.shelfCreate).toHaveBeenCalledTimes(4);

    const unitCreateCalls = mocks.unitCreate.mock.calls as any[];
    const created = unitCreateCalls.map((call) => ({
      slug: call[0].data.slug,
      slugScope: call[0].data.slugScope,
      userId: call[0].data.userId,
      title: call[0].data.translations.create.title,
    }));
    expect(created).toEqual([
      {
        slug: "favorites",
        slugScope: "user-1",
        userId: "user-1",
        title: "alice's Favorites",
      },
      {
        slug: "backlog",
        slugScope: "user-1",
        userId: "user-1",
        title: "alice's Backlog",
      },
      {
        slug: "active",
        slugScope: "user-1",
        userId: "user-1",
        title: "alice's Active",
      },
      {
        slug: "completed",
        slugScope: "user-1",
        userId: "user-1",
        title: "alice's Completed",
      },
    ]);

    expect(
      (mocks.shelfCreate.mock.calls as any[]).map(
        (call) => call[0].data.kindKey,
      ),
    ).toEqual(["favorites", "backlog", "active", "completed"]);
  });

  test("ensure lookup resolves existing shelf via unit slug index without creating", async () => {
    const { ensureSystemShelf } = await import("./system-shelves");
    const mocks = makeClient();
    mocks.unitFindFirst.mockResolvedValueOnce({ id: "existing-active" });

    const result = await ensureSystemShelf(
      "user-1",
      "alice",
      "active",
      mocks.client as any,
    );

    expect(result).toEqual({ unitId: "existing-active", created: false });
    expect(mocks.unitCreate).not.toHaveBeenCalled();
    expect(mocks.shelfCreate).not.toHaveBeenCalled();
    expect(firstArg(mocks.unitFindFirst).where).toEqual({
      type: "SHELF",
      slug: "active",
      slugScope: "user-1",
    });
  });

  test("ensure safety-net create mints slug, scope, and formatted title", async () => {
    const { ensureSystemShelf } = await import("./system-shelves");
    const mocks = makeClient();

    const result = await ensureSystemShelf(
      "user-2",
      "bob",
      "favorites",
      mocks.client as any,
    );

    expect(result).toEqual({ unitId: "favorites-shelf", created: true });
    const created = firstArg(mocks.unitCreate);
    expect(created.data.slug).toBe("favorites");
    expect(created.data.slugScope).toBe("user-2");
    expect(created.data.userId).toBe("user-2");
    expect(created.data.translations.create.title).toBe("bob's Favorites");
  });

  test("ensure create branch recovers from P2002 race and returns created: false", async () => {
    const { ensureSystemShelf } = await import("./system-shelves");
    const mocks = makeClient();

    mocks.unitFindFirst.mockResolvedValueOnce(null);
    mocks.unitCreate.mockImplementationOnce(async () => {
      throw Object.assign(new Error("unique violation"), { code: "P2002" });
    });
    mocks.unitFindFirst.mockResolvedValueOnce({ id: "raced-completed" });

    const result = await ensureSystemShelf(
      "user-3",
      "carol",
      "completed",
      mocks.client as any,
    );

    expect(result).toEqual({ unitId: "raced-completed", created: false });
    expect(mocks.unitFindFirst).toHaveBeenCalledTimes(2);
    expect(mocks.unitCreate).toHaveBeenCalledTimes(1);
    expect(mocks.shelfCreate).not.toHaveBeenCalled();
  });

  test("findSystemShelf returns null when nothing exists", async () => {
    const { findSystemShelf } = await import("./system-shelves");
    const mocks = makeClient();

    const result = await findSystemShelf(
      "user-4",
      "favorites",
      mocks.client as any,
    );

    expect(result).toBeNull();
    expect(mocks.unitFindFirst).toHaveBeenCalledTimes(1);
  });

  test("findSystemShelf returns the unitId when shelf exists", async () => {
    const { findSystemShelf } = await import("./system-shelves");
    const mocks = makeClient();
    mocks.unitFindFirst.mockResolvedValueOnce({ id: "fav-shelf-id" });

    const result = await findSystemShelf(
      "user-4",
      "favorites",
      mocks.client as any,
    );

    expect(result).toBe("fav-shelf-id");
  });
});
