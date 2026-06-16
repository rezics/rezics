export type ZoneDetailKind = "post" | "wiki" | "unit";

export type ZoneDetailRoute = {
  href: string;
  presentationContext: { kind: "zone"; zoneSlug: string };
  interactionContext: { kind: "direct" };
};

export type RealmPostRoute = {
  href: string;
  presentationContext: { kind: "realm"; realmId: string };
  interactionContext: { kind: "realm"; realmId: string };
};

export function zoneDetailRoute(input: {
  zoneSlug: string;
  kind: ZoneDetailKind;
  unitId: string;
}): ZoneDetailRoute {
  return {
    href: `/z/${input.zoneSlug}/${input.kind}/${input.unitId}`,
    presentationContext: { kind: "zone", zoneSlug: input.zoneSlug },
    interactionContext: { kind: "direct" },
  };
}

export function directPostHref(postUnitId: string) {
  return `/post/${postUnitId}`;
}

export function realmPostRoute(input: {
  realmId: string;
  postUnitId: string;
}): RealmPostRoute {
  return {
    href: `/realm/${input.realmId}/post/${input.postUnitId}`,
    presentationContext: { kind: "realm", realmId: input.realmId },
    interactionContext: { kind: "realm", realmId: input.realmId },
  };
}
