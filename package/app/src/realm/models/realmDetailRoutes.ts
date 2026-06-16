import {
  isPublicRealmIdRouteParams,
  type PublicRealmSlugRouteParams,
} from "@rezics/contract";

export type RealmDetailTab = "stream" | "wiki" | "tags" | "dock";

export type RealmDetailRouteLocation =
  | { kind: "unitId"; realmId: string }
  | { kind: "slug"; realmSlug: string };

const TAB_SUFFIXES = {
  stream: "",
  wiki: "/wiki",
  tags: "/tags",
  dock: "/dock",
} as const satisfies Record<RealmDetailTab, string>;

export function realmDetailLocationFromSlugParams(
  params: PublicRealmSlugRouteParams,
): RealmDetailRouteLocation {
  return { kind: "slug", realmSlug: params.realmSlug };
}

export function realmSummaryHref(input: {
  realmId: string;
  slug?: string | null;
}): string {
  return realmDetailHref(
    input.slug
      ? { kind: "slug", realmSlug: input.slug }
      : { kind: "unitId", realmId: input.realmId },
  );
}

export function isRealmUnitIdParam(realmId: string): boolean {
  return isPublicRealmIdRouteParams({ unitId: realmId });
}

export function realmDetailHref(
  location: RealmDetailRouteLocation,
  tab: RealmDetailTab = "stream",
): string {
  return `${realmDetailBaseHref(location)}${TAB_SUFFIXES[tab]}`;
}

export function realmManageHref(location: RealmDetailRouteLocation): string {
  return `${realmDetailBaseHref(location)}/manage`;
}

export function realmCreateHref(location: RealmDetailRouteLocation): string {
  return `${realmDetailBaseHref(location)}/create`;
}

export function realmSearchHref(location: RealmDetailRouteLocation): string {
  return `${realmDetailBaseHref(location)}/search`;
}

export function realmDetailBaseHref(
  location: RealmDetailRouteLocation,
): string {
  switch (location.kind) {
    case "slug":
      return `/r/${location.realmSlug}`;
    case "unitId":
      return `/realm/${location.realmId}`;
  }
}
