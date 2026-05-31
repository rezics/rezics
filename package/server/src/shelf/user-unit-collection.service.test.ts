import { describe, expect, mock, test } from "bun:test";

describe("applyUserUnitCollectionMetadata", () => {
  test("uses patch semantics for search text and user tags", async () => {
    const upsert = mock(async () => ({}));
    const deleteMany = mock(async () => ({ count: 2 }));
    const createMany = mock(async () => ({ count: 2 }));
    const tx = {
      userUnitCollection: { upsert },
      userTagApplication: { deleteMany, createMany },
    } as any;

    const { applyUserUnitCollectionMetadata } = await import(
      "./user-unit-collection.service"
    );
    await applyUserUnitCollectionMetadata(tx, "user-1", "unit-1", {
      searchText: null,
      tagUnitIds: ["tag-1", "tag-1", " ", "tag-2"],
    });

    expect(upsert).toHaveBeenCalledWith({
      where: { userId_unitId: { userId: "user-1", unitId: "unit-1" } },
      create: { userId: "user-1", unitId: "unit-1", searchText: null },
      update: { searchText: null },
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", unitId: "unit-1" },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "user-1",
          unitId: "unit-1",
          tagUnitId: "tag-1",
          position: "00000000",
        },
        {
          userId: "user-1",
          unitId: "unit-1",
          tagUnitId: "tag-2",
          position: "00000001",
        },
      ],
      skipDuplicates: true,
    });
  });

  test("omitted metadata leaves existing rows untouched", async () => {
    const upsert = mock(async () => ({}));
    const deleteMany = mock(async () => ({ count: 0 }));
    const createMany = mock(async () => ({ count: 0 }));
    const tx = {
      userUnitCollection: { upsert },
      userTagApplication: { deleteMany, createMany },
    } as any;

    const { applyUserUnitCollectionMetadata } = await import(
      "./user-unit-collection.service"
    );
    await applyUserUnitCollectionMetadata(tx, "user-1", "unit-1", {});

    expect(upsert).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });
});
