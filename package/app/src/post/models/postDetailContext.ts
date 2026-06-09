import { realmReactionScopeKey } from "@rezics/contract";

export type PostDetailContext =
  | { kind: "direct" }
  | { kind: "realm"; realmUnitId: string };

export type PostDetailRouteParams = {
  rootPostUnitId?: string;
  postUnitId?: string;
  wikiUnitId?: string;
  realmId?: string;
};

export type ResolvedPostDetailContext = {
  rootPostUnitId: string;
  context: PostDetailContext;
  realmUnitId: string | null;
  reactionScopeKey: string | undefined;
};

export function resolvePostDetailContext(input: {
  params: PostDetailRouteParams;
  realmUnitId?: string | null;
}): ResolvedPostDetailContext {
  const rootPostUnitId =
    input.params.rootPostUnitId ??
    input.params.postUnitId ??
    input.params.wikiUnitId ??
    "";
  const realmUnitId = input.realmUnitId ?? input.params.realmId ?? null;
  const context: PostDetailContext = realmUnitId
    ? { kind: "realm", realmUnitId }
    : { kind: "direct" };

  return {
    rootPostUnitId,
    context,
    realmUnitId,
    reactionScopeKey:
      context.kind === "realm"
        ? realmReactionScopeKey(context.realmUnitId)
        : undefined,
  };
}
