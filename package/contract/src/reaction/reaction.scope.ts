export const DIRECT_REACTION_SCOPE_KEY = "direct" as const;
export const REALM_REACTION_SCOPE_PREFIX = "realm:" as const;

export type DirectReactionScopeKey = typeof DIRECT_REACTION_SCOPE_KEY;
export type RealmReactionScopeKey =
  `${typeof REALM_REACTION_SCOPE_PREFIX}${string}`;
export type ReactionScopeKey = DirectReactionScopeKey | RealmReactionScopeKey;

export type ReactionScope =
  | { kind: "direct" }
  | { kind: "realm"; realmUnitId: string };

export function realmReactionScopeKey(
  realmUnitId: string,
): RealmReactionScopeKey {
  return `${REALM_REACTION_SCOPE_PREFIX}${realmUnitId}`;
}

export function parseReactionScopeKey(scopeKey: string): ReactionScope | null {
  if (scopeKey === DIRECT_REACTION_SCOPE_KEY) return { kind: "direct" };
  if (!scopeKey.startsWith(REALM_REACTION_SCOPE_PREFIX)) return null;
  const realmUnitId = scopeKey.slice(REALM_REACTION_SCOPE_PREFIX.length);
  return realmUnitId.length > 0 ? { kind: "realm", realmUnitId } : null;
}
