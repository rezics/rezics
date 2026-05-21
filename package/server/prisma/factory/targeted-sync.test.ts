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
});
