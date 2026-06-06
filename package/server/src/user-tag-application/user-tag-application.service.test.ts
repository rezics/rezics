import { describe, expect, mock, test } from "bun:test";
import type { UserSettings } from "@rezics/contract";
import type {
  UserTagApplicationRepository,
  UserTagApplicationService,
} from "./user-tag-application.service";
import type { UserTagApplicationRow } from "./user-tag-application.types";

function tagRow(
  patch: Partial<UserTagApplicationRow> = {},
): UserTagApplicationRow {
  return {
    userId: "user-1",
    unitId: "unit-1",
    tagUnitId: "tag-1",
    position: "00000000",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...patch,
  };
}

function createRepository(
  overrides: Partial<UserTagApplicationRepository> = {},
): UserTagApplicationRepository {
  return {
    listForUnit: mock(async () => []),
    getOwnerSettings: mock(async (): Promise<UserSettings | null> => ({})),
    isFollower: mock(async () => false),
    replaceTagsForUnit: mock(async () => {}),
    getTagPosition: mock(async () => null),
    updatePosition: mock(async () => tagRow()),
    deleteOne: mock(async () => {}),
    ...overrides,
  };
}

async function createService(
  repository: UserTagApplicationRepository,
): Promise<UserTagApplicationService> {
  const { UserTagApplicationService } = await import(
    "./user-tag-application.service"
  );
  return new UserTagApplicationService(repository);
}

describe("UserTagApplicationService", () => {
  test("direct user tag visibility follows profile privacy", async () => {
    const { canViewDirectUserTags } = await import(
      "./user-tag-application.service"
    );

    expect(
      canViewDirectUserTags({
        ownerUserId: "owner-1",
        viewerUserId: "owner-1",
        settings: { privacy: { userTags: "private" } },
      }),
    ).toBe(true);
    expect(
      canViewDirectUserTags({
        ownerUserId: "owner-1",
        viewerUserId: "viewer-1",
        settings: { privacy: { userTags: "public" } },
      }),
    ).toBe(true);
    expect(
      canViewDirectUserTags({
        ownerUserId: "owner-1",
        viewerUserId: "viewer-1",
        settings: { privacy: { userTags: "followers" } },
        isFollower: true,
      }),
    ).toBe(true);
    expect(
      canViewDirectUserTags({
        ownerUserId: "owner-1",
        viewerUserId: "viewer-1",
        settings: { privacy: { userTags: "followers" } },
      }),
    ).toBe(false);
    expect(
      canViewDirectUserTags({
        ownerUserId: "owner-1",
        viewerUserId: "viewer-1",
        settings: {},
      }),
    ).toBe(false);
  });

  test("lists caller-scoped tags for one unit", async () => {
    const listForUnit = mock(async () => []);
    const repository = createRepository({ listForUnit });

    await (await createService(repository)).listForUnit("user-1", "unit-1");

    expect(listForUnit).toHaveBeenCalledWith("user-1", "unit-1");
  });

  test("lists another user's tags only when direct privacy permits", async () => {
    const tagRows = [tagRow({ userId: "owner-1" })];
    const getOwnerSettings = mock(
      async (): Promise<UserSettings> => ({
        privacy: { userTags: "followers" },
      }),
    );
    const isFollower = mock(async () => true);
    const listForUnit = mock(async () => tagRows);
    const repository = createRepository({
      getOwnerSettings,
      isFollower,
      listForUnit,
    });

    const rows = await (await createService(repository)).listForUserUnit(
      "owner-1",
      "unit-1",
      "viewer-1",
    );

    expect(getOwnerSettings).toHaveBeenCalledWith("owner-1");
    expect(isFollower).toHaveBeenCalledWith("viewer-1", "owner-1");
    expect(listForUnit).toHaveBeenCalledWith("owner-1", "unit-1");
    expect(rows).toBe(tagRows);
  });

  test("hides another user's direct tags when privacy blocks", async () => {
    const listForUnit = mock(async () => []);
    const repository = createRepository({
      getOwnerSettings: mock(async () => ({})),
      isFollower: mock(async () => false),
      listForUnit,
    });

    const rows = await (await createService(repository)).listForUserUnit(
      "owner-1",
      "unit-1",
      "viewer-1",
    );

    expect(rows).toEqual([]);
    expect(listForUnit).not.toHaveBeenCalled();
  });

  test("setForUnit replaces tags through the repository", async () => {
    const tagRows = [tagRow({ tagUnitId: "tag-1" })];
    const replaceTagsForUnit = mock(async () => {});
    const listForUnit = mock(async () => tagRows);
    const repository = createRepository({
      replaceTagsForUnit,
      listForUnit,
    });

    const rows = await (await createService(repository)).setForUnit("user-1", {
      unitId: "unit-1",
      tagUnitIds: ["tag-1", "tag-2"],
    });

    expect(replaceTagsForUnit).toHaveBeenCalledWith("user-1", "unit-1", [
      "tag-1",
      "tag-2",
    ]);
    expect(listForUnit).toHaveBeenCalledWith("user-1", "unit-1");
    expect(rows).toBe(tagRows);
  });

  test("setForUnit tags the requested unit id without resolving Unit.targetUnitId", async () => {
    const replaceTagsForUnit = mock(async () => {});
    const repository = createRepository({
      replaceTagsForUnit,
    });

    await (await createService(repository)).setForUnit("user-1", {
      unitId: "unit-1",
      tagUnitIds: ["tag-1"],
    });

    expect(replaceTagsForUnit).toHaveBeenCalledWith("user-1", "unit-1", [
      "tag-1",
    ]);
  });

  test("reorder writes a position between neighboring tags", async () => {
    const getTagPosition = mock(
      async (_userId: string, _unitId: string, tagUnitId: string) =>
        tagUnitId === "before-tag" ? "00000010" : "00000020",
    );
    const updated = tagRow({ tagUnitId: "tag-1", position: "00000015" });
    const updatePosition = mock(async () => updated);
    const repository = createRepository({ getTagPosition, updatePosition });

    const row = await (await createService(repository)).reorder("user-1", {
      unitId: "unit-1",
      tagUnitId: "tag-1",
      beforeTagUnitId: "before-tag",
      afterTagUnitId: "after-tag",
    });

    expect(getTagPosition).toHaveBeenCalledWith(
      "user-1",
      "unit-1",
      "before-tag",
    );
    expect(getTagPosition).toHaveBeenCalledWith(
      "user-1",
      "unit-1",
      "after-tag",
    );
    expect(updatePosition).toHaveBeenCalledWith(
      "user-1",
      "unit-1",
      "tag-1",
      "00000011",
    );
    expect(row).toBe(updated);
  });

  test("deleteOne only deletes the caller-owned user tag", async () => {
    const deleteOne = mock(async () => {});
    const repository = createRepository({ deleteOne });

    await (await createService(repository)).deleteOne(
      "user-1",
      "unit-1",
      "tag-1",
    );

    expect(deleteOne).toHaveBeenCalledWith("user-1", "unit-1", "tag-1");
  });
});
