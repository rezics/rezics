import {
  type UnitInteractionContext,
  type UnitPresentationContext,
  realmPresentationContext,
  zonePresentationContext,
} from "../../unit/models/unitPresentationContext";

export type ZoneDetailKind = "post" | "wiki" | "unit";

export type ZoneRouteLocation =
  | { kind: "slug"; zoneSlug: string }
  | { kind: "unitId"; zoneUnitId: string };

export type ZoneDetailRoute = {
  href: string;
  routeLocation: ZoneRouteLocation;
  presentationContext: Extract<UnitPresentationContext, { kind: "zone" }>;
  interactionContext: Extract<UnitInteractionContext, { kind: "direct" }>;
};

export type RealmPostRoute = {
  href: string;
  presentationContext: Extract<UnitPresentationContext, { kind: "realm" }>;
  interactionContext: Extract<UnitInteractionContext, { kind: "realm" }>;
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
    routeLocation: location,
    presentationContext: zonePresentationContext(
      location.kind === "slug"
        ? { zoneSlug: location.zoneSlug }
        : { zoneUnitId: location.zoneUnitId },
    ),
    interactionContext: { kind: "direct" },
  };
}

export function directPostHref(postUnitId: string) {
  return `/post/${postUnitId}`;
}

export function realmPostRoute(input: {
  realmUnitId: string;
  postUnitId: string;
}): RealmPostRoute {
  return {
    href: `/realm/${input.realmUnitId}/post/${input.postUnitId}`,
    presentationContext: realmPresentationContext(input.realmUnitId),
    interactionContext: { kind: "realm", realmUnitId: input.realmUnitId },
  };
}
