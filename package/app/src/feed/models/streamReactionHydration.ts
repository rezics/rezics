import type { StreamRow } from "@rezics/contract";

export type ReactionHydrationGroup = {
  contextUnitId: string | null;
  targetIds: string[];
};

export const GLOBAL_REACTION_CONTEXT_KEY = "__global__";

export function groupPostReactionTargets(rows: readonly StreamRow[]) {
  const groups = new Map<string, ReactionHydrationGroup>();
  for (const row of rows) {
    if (row.type !== "post") continue;
    const contextUnitId = row.contextUnitId ?? null;
    const key = contextUnitId ?? GLOBAL_REACTION_CONTEXT_KEY;
    const group = groups.get(key) ?? {
      contextUnitId,
      targetIds: [],
    };
    group.targetIds.push(row.post.unitId);
    groups.set(key, group);
  }
  return [...groups.values()];
}
