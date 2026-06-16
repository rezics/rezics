export type ZoneDetailKind = "post" | "wiki" | "unit";

export type ZoneRouteLocation =
  | { kind: "slug"; zoneSlug: string }
  | { kind: "unitId"; zoneUnitId: string };

export type ZoneDetailRoute = {
  href: string;
  presentationContext: { kind: "zone"; routeLocation: ZoneRouteLocation };
  interactionContext: { kind: "direct" };
};

export type RealmPostRoute = {
  href: string;
  presentationContext: { kind: "realm"; realmId: string };
  interactionContext: { kind: "realm"; realmId: string };
};

export function zoneRouteLocationFromZone(input: {
  unitId: string;
  slug?: string | null;
}): ZoneRouteLocation {
  return input.slug
    ? { kind: "slug", zoneSlug: input.slug }
    : { kind: "unitId", zoneUnitId: input.unitId };
}

export function zoneRouteBaseHref(location: ZoneRouteLocation): string {
  return location.kind === "slug"
    ? `/z/${location.zoneSlug}`
    : `/zone/${location.zoneUnitId}`;
}

export function zoneSearchHref(location: ZoneRouteLocation): string {
  return `${zoneRouteBaseHref(location)}/search`;
}

export function zoneManageHref(location: ZoneRouteLocation): string {
  return `${zoneRouteBaseHref(location)}/manage`;
}

export function zoneDetailRoute(input: {
  location?: ZoneRouteLocation;
  zoneSlug?: string;
  kind: ZoneDetailKind;
  unitId: string;
}): ZoneDetailRoute {
  const location = input.location ?? {
    kind: "slug",
    zoneSlug: input.zoneSlug ?? "",
  };
  return {
    href: `${zoneRouteBaseHref(location)}/${input.kind}/${input.unitId}`,
    presentationContext: { kind: "zone", routeLocation: location },
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
