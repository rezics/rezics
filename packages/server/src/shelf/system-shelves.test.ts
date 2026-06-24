import { describe, expect, mock, test } from "bun:test";

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

async function loadSystemShelves() {
  return import("./system-shelves.ts?system-shelves-test-actual" as string);
}

describe("reserved shelves", () => {
  test("recognizes reserved shelf slugs", async () => {
    const { isReservedShelfSlug, RESERVED_SHELF_SLUG_SET } =
      await loadSystemShelves();

    expect([...RESERVED_SHELF_SLUG_SET]).toEqual(["favorites"]);
    expect(isReservedShelfSlug("favorites")).toBe(true);
    expect(isReservedShelfSlug("custom")).toBe(false);
  });

  test("bootstrap creates the slug-bearing favorites shelf with formatted title", async () => {
    const { bootstrapSystemShelves } = await loadSystemShelves();
    const mocks = makeClient();

    await bootstrapSystemShelves("user-1", "alice", mocks.client as any);

    expect(mocks.unitFindFirst).toHaveBeenCalledTimes(1);
    expect(mocks.unitCreate).toHaveBeenCalledTimes(1);
    expect(mocks.shelfCreate).toHaveBeenCalledTimes(1);

    const created = firstArg(mocks.unitCreate);
    expect({
      slug: created.data.slug,
      slugScope: created.data.slugScope,
      userId: created.data.userId,
      title: created.data.translations.create.title,
    }).toEqual({
      slug: "favorites",
      slugScope: "user-1",
      userId: "user-1",
      title: "alice's Favorites",
    });

    expect(firstArg(mocks.shelfCreate).data).toEqual({
      unitId: "favorites-shelf",
    });
  });

  test("ensure lookup resolves existing shelf via unit slug index without creating", async () => {
    const { ensureSystemShelf } = await loadSystemShelves();
    const mocks = makeClient();
    mocks.unitFindFirst.mockResolvedValueOnce({ id: "existing-favorites" });

    const result = await ensureSystemShelf(
      "user-1",
      "alice",
      "favorites",
      mocks.client as any,
    );

    expect(result).toEqual({ unitId: "existing-favorites", created: false });
    expect(mocks.unitCreate).not.toHaveBeenCalled();
    expect(mocks.shelfCreate).not.toHaveBeenCalled();
    expect(firstArg(mocks.unitFindFirst).where).toEqual({
      type: "SHELF",
      slug: "favorites",
      slugScope: "user-1",
    });
  });

  test("ensure safety-net create mints slug, scope, and formatted title", async () => {
    const { ensureSystemShelf } = await loadSystemShelves();
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

  test("ensure create branch recovers from unique constraint race and returns created: false", async () => {
    const { ensureSystemShelf } = await loadSystemShelves();
    const mocks = makeClient();

    mocks.unitFindFirst.mockResolvedValueOnce(null);
    mocks.unitCreate.mockImplementationOnce(async () => {
      throw Object.assign(new Error("unique violation"), { code: "23505" });
    });
    mocks.unitFindFirst.mockResolvedValueOnce({ id: "raced-favorites" });

    const result = await ensureSystemShelf(
      "user-3",
      "carol",
      "favorites",
      mocks.client as any,
    );

    expect(result).toEqual({ unitId: "raced-favorites", created: false });
    expect(mocks.unitFindFirst).toHaveBeenCalledTimes(2);
    expect(mocks.unitCreate).toHaveBeenCalledTimes(1);
    expect(mocks.shelfCreate).not.toHaveBeenCalled();
  });

  test("findReservedShelfBySlug returns null when nothing exists", async () => {
    const { findReservedShelfBySlug } = await loadSystemShelves();
    const mocks = makeClient();

    const result = await findReservedShelfBySlug(
      "user-4",
      "favorites",
      mocks.client as any,
    );

    expect(result).toBeNull();
    expect(mocks.unitFindFirst).toHaveBeenCalledTimes(1);
  });

  test("findReservedShelfBySlug returns the unitId when shelf exists", async () => {
    const { findReservedShelfBySlug } = await loadSystemShelves();
    const mocks = makeClient();
    mocks.unitFindFirst.mockResolvedValueOnce({ id: "fav-shelf-id" });

    const result = await findReservedShelfBySlug(
      "user-4",
      "favorites",
      mocks.client as any,
    );

    expect(result).toBe("fav-shelf-id");
  });
});
