import { realmReactionScopeKey } from "@rezics/contract";

export type PostThreadRouteParams = {
  rootPostUnitId?: string;
  postUnitId?: string;
  realmId?: string;
};

export type PostThreadContext = {
  rootPostUnitId: string;
  realmUnitId: string | null;
  reactionScopeKey: string | undefined;
};

export function resolvePostThreadContext(input: {
  params: PostThreadRouteParams;
  realmUnitId?: string | null;
}): PostThreadContext {
  const rootPostUnitId =
    input.params.rootPostUnitId ?? input.params.postUnitId ?? "";
  const realmUnitId = input.realmUnitId ?? input.params.realmId ?? null;
  return {
    rootPostUnitId,
    realmUnitId,
    reactionScopeKey: realmUnitId
      ? realmReactionScopeKey(realmUnitId)
      : undefined,
  };
}
