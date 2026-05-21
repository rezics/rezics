import type { SearchClient } from "@rezics/search/client";
import type { SeedCtx } from "./strategy.js";
import type { SeedManifestEntry, SeedSyncTarget } from "./types.js";

export interface FactorySyncDependencies {
  searchClient: SearchClient;
  syncContent: (client: SearchClient, unitId: string) => Promise<unknown>;
  syncPost: (client: SearchClient, unitId: string) => Promise<unknown>;
  syncRealm: (client: SearchClient, unitId: string) => Promise<unknown>;
  syncEntity: (client: SearchClient, unitId: string) => Promise<unknown>;
  patchContentContainedUnitIds: (
    client: SearchClient,
    unitId: string,
  ) => Promise<unknown>;
}

export interface FactoryTargetedSyncSummary {
  targets: Record<SeedSyncTarget, number>;
  total: number;
}

export async function getDefaultFactorySyncDependencies(): Promise<FactorySyncDependencies> {
  const {
    patchContentContainedUnitIds,
    syncSingleContent,
    syncSingleEntity,
    syncSinglePost,
    syncSingleRealm,
  } = await import("@rezics/search/sync");
  const { searchClient } = await import("../../src/meili/search-client.js");
  return {
    searchClient,
    syncContent: syncSingleContent,
    syncPost: syncSinglePost,
    syncRealm: syncSingleRealm,
    syncEntity: syncSingleEntity,
    patchContentContainedUnitIds,
  };
}

function emptySummary(): FactoryTargetedSyncSummary {
  return {
    targets: {
      content: 0,
      post: 0,
      realm: 0,
      user: 0,
      entity: 0,
      "content-contained-units": 0,
    },
    total: 0,
  };
}

async function syncUser(
  ctx: SeedCtx,
  client: SearchClient,
  unitId: string,
): Promise<void> {
  const user = await ctx.prisma.user.findUnique({
    where: { unitId },
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
      unit: { select: { slug: true } },
    },
  });
  if (!user) return;
  await client.addOrUpdateUsers([
    {
      id: user.unitId,
      unitId: user.unitId,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      bio: user.bio,
      description: user.description,
      followersCount: user.followersCount,
      followingsCount: user.followingsCount,
      joinDate:
        user.joinDate instanceof Date
          ? user.joinDate.toISOString()
          : (user.joinDate ?? null),
      permission: user.permission,
      slug: user.unit?.slug ?? null,
    },
  ]);
}

export async function syncSeedManifestToMeili(
  ctx: SeedCtx,
  manifest: SeedManifestEntry[],
  deps?: FactorySyncDependencies,
): Promise<FactoryTargetedSyncSummary> {
  const resolvedDeps = deps ?? (await getDefaultFactorySyncDependencies());
  const summary = emptySummary();
  const byTarget = new Map<SeedSyncTarget, Set<string>>();

  for (const entry of manifest) {
    for (const target of entry.syncTargets) {
      const ids = byTarget.get(target) ?? new Set<string>();
      ids.add(entry.unitId);
      byTarget.set(target, ids);
    }
  }

  const runTarget = async (
    target: SeedSyncTarget,
    fn: (unitId: string) => Promise<unknown>,
  ) => {
    const ids = byTarget.get(target) ?? new Set<string>();
    for (const unitId of ids) {
      await fn(unitId);
      summary.targets[target]++;
      summary.total++;
    }
  };

  await runTarget("content", (unitId) =>
    resolvedDeps.syncContent(resolvedDeps.searchClient, unitId),
  );
  await runTarget("post", (unitId) =>
    resolvedDeps.syncPost(resolvedDeps.searchClient, unitId),
  );
  await runTarget("realm", (unitId) =>
    resolvedDeps.syncRealm(resolvedDeps.searchClient, unitId),
  );
  await runTarget("entity", (unitId) =>
    resolvedDeps.syncEntity(resolvedDeps.searchClient, unitId),
  );
  await runTarget("content-contained-units", (unitId) =>
    resolvedDeps.patchContentContainedUnitIds(
      resolvedDeps.searchClient,
      unitId,
    ),
  );
  await runTarget("user", (unitId) =>
    syncUser(ctx, resolvedDeps.searchClient, unitId),
  );

  return summary;
}
