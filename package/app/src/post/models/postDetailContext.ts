import {
  hiddenUnitPresentationContext,
  realmPresentationContext,
  type UnitInteractionContext,
  type UnitPresentationContext,
} from "../../unit/models/unitPresentationContext";

export type PostDetailContext = UnitInteractionContext;

export type PostDetailRouteParams = {
  rootPostUnitId?: string;
  postUnitId?: string;
  wikiUnitId?: string;
  realmId?: string;
};

export type ResolvedPostDetailContext = {
  rootPostUnitId: string;
  context: PostDetailContext;
  interactionContext: UnitInteractionContext;
  presentationContext: UnitPresentationContext;
  realmUnitId: string | null;
  reactionContextUnitId: string | null;
};

export function resolvePostDetailContext(input: {
  params: PostDetailRouteParams;
  realmUnitId?: string | null;
  presentationContext?: UnitPresentationContext | null;
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
  const presentationContext =
    input.presentationContext ??
    (context.kind === "realm"
      ? realmPresentationContext(context.realmUnitId)
      : hiddenUnitPresentationContext("post", rootPostUnitId));

  return {
    rootPostUnitId,
    context,
    interactionContext: context,
    presentationContext,
    realmUnitId,
    reactionContextUnitId:
      context.kind === "realm" ? context.realmUnitId : null,
  };
}
