import { describe, expect, mock, test } from "bun:test";
import {
  installPrismaClientMock,
  prismaMock,
} from "@/test/prisma-client-mock";

installPrismaClientMock();
Object.assign(prismaMock, {});

function makeClient() {
  const userFindUnique = mock(async () => ({ extra: null }));
  const userUpdate = mock(async () => ({}));
  const shelfFindFirst = mock(async () => null as { unitId: string } | null);
  const shelfCreate = mock(async () => ({}));
  const unitCreate = mock(async ({ data }: any) => ({
    id: `${data.translations.create.title.toLowerCase()}-shelf`,
  }));

  return {
    userFindUnique,
    userUpdate,
    shelfFindFirst,
    shelfCreate,
    unitCreate,
    client: {
      user: {
        findUnique: userFindUnique,
        update: userUpdate,
      },
      shelf: {
        findFirst: shelfFindFirst,
        create: shelfCreate,
      },
      unit: {
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

  test("bootstrap creates four system shelves and patches user extra", async () => {
    const { bootstrapSystemShelves } = await import("./system-shelves");
    const mocks = makeClient();

    await bootstrapSystemShelves("user-1", mocks.client as any);

    expect(mocks.unitCreate).toHaveBeenCalledTimes(4);
    expect(mocks.shelfCreate).toHaveBeenCalledTimes(4);
    expect(mocks.userUpdate).toHaveBeenCalledTimes(4);
    expect(
      (mocks.shelfCreate.mock.calls as any[]).map(
        (call) => call[0].data.kindKey,
      ),
    ).toEqual(["favorites", "backlog", "active", "completed"]);
  });

  test("lazy fallback reuses existing shelf and patches missing pointer", async () => {
    const { getOrCreateSystemShelf } = await import("./system-shelves");
    const mocks = makeClient();
    mocks.shelfFindFirst.mockResolvedValueOnce({ unitId: "existing-active" });

    const shelfId = await getOrCreateSystemShelf(
      "user-1",
      "active",
      mocks.client as any,
    );

    expect(shelfId).toBe("existing-active");
    expect(mocks.unitCreate).not.toHaveBeenCalled();
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { unitId: "user-1" },
      data: {
        extra: {
          shelves: {
            active: "existing-active",
          },
        },
      },
    });
    expect(firstArg(mocks.userUpdate).data.extra.shelves.active).toBe(
      "existing-active",
    );
  });
});
