import { describe, expect, mock, test } from "bun:test";
import { UnitType } from "../generated/client";
import { syncSeedManifestToMeili } from "./targeted-sync";
import type { SeedCtx } from "./strategy";

describe("syncSeedManifestToMeili", () => {
  test("deduplicates by target and Unit ID without full reindex calls", async () => {
    const syncContent = mock(async () => {});
    const syncPost = mock(async () => {});
    const syncRealm = mock(async () => {});
    const syncEntity = mock(async () => {});
    const patchContentContainedUnitIds = mock(async () => {});

    const summary = await syncSeedManifestToMeili(
      {
        prisma: {},
      } as SeedCtx,
      [
        {
          label: "Shelf",
          unitType: UnitType.SHELF,
          unitId: "shelf-1",
          syncTargets: ["content", "content-contained-units"],
        },
        {
          label: "Shelf again",
          unitType: UnitType.SHELF,
          unitId: "shelf-1",
          syncTargets: ["content", "content-contained-units"],
        },
        {
          label: "Post",
          unitType: UnitType.POST,
          unitId: "post-1",
          syncTargets: ["post"],
        },
      ],
      {
        searchClient: {} as never,
        syncContent,
        syncPost,
        syncRealm,
        syncEntity,
        patchContentContainedUnitIds,
      },
    );

    expect(syncContent).toHaveBeenCalledTimes(1);
    expect(syncContent).toHaveBeenCalledWith({}, "shelf-1");
    expect(patchContentContainedUnitIds).toHaveBeenCalledTimes(1);
    expect(syncPost).toHaveBeenCalledTimes(1);
    expect(syncRealm).not.toHaveBeenCalled();
    expect(syncEntity).not.toHaveBeenCalled();
    expect(summary.total).toBe(3);
  });

  test("syncs users by fetching the canonical slug from the USER unit", async () => {
    const syncContent = mock(async () => {});
    const syncPost = mock(async () => {});
    const syncRealm = mock(async () => {});
    const syncEntity = mock(async () => {});
    const patchContentContainedUnitIds = mock(async () => {});
    const addOrUpdateUsers = mock(async () => {});
    const userFindUnique = mock(async () => ({
      unitId: "user-1",
      email: "reader@example.com",
      name: "Reader",
      avatar: null,
      bio: null,
      description: "Bookish",
      followersCount: 2,
      followingsCount: 3,
      joinDate: new Date("2026-01-02T03:04:05.000Z"),
      permission: { role: ["user"] },
    }));
    const unitFindUnique = mock(async () => ({
      slug: "reader",
      type: UnitType.USER,
    }));

    const summary = await syncSeedManifestToMeili(
      {
        prisma: {
          user: { findUnique: userFindUnique },
          unit: { findUnique: unitFindUnique },
        },
      } as unknown as SeedCtx,
      [
        {
          label: "Reader",
          unitType: UnitType.USER,
          unitId: "user-1",
          syncTargets: ["user"],
        },
      ],
      {
        searchClient: { addOrUpdateUsers } as never,
        syncContent,
        syncPost,
        syncRealm,
        syncEntity,
        patchContentContainedUnitIds,
      },
    );

    expect(userFindUnique).toHaveBeenCalledWith({
      where: { unitId: "user-1" },
      select: {
        unitId: true,
        email: true,
        name: true,
        avatar: true,
        bio: true,
        description: true,
        followersCount: true,
        followingsCount: true,
        joinDate: true,
        permission: true,
      },
    });
    expect(unitFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { slug: true, type: true },
    });
    expect(addOrUpdateUsers).toHaveBeenCalledWith([
      {
        id: "user-1",
        unitId: "user-1",
        email: "reader@example.com",
        name: "Reader",
        avatar: null,
        bio: null,
        description: "Bookish",
        followersCount: 2,
        followingsCount: 3,
        joinDate: "2026-01-02T03:04:05.000Z",
        permission: { role: ["user"] },
        slug: "reader",
      },
    ]);
    expect(summary.targets.user).toBe(1);
    expect(summary.total).toBe(1);
  });
});
