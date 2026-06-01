import { realmReactionScopeKey } from "@rezics/contract";

export function realmContextPostHref(input: {
  realmId: string;
  postUnitId: string;
}): string {
  return `/realm/${input.realmId}/post/${input.postUnitId}`;
}

export function realmContextReactionScopeKey(realmId: string): string {
  return realmReactionScopeKey(realmId);
}
