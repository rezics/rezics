import { zoneRouteBaseHref, type ZoneRouteLocation } from "./zoneDetailRoutes";

export type ZoneManagePageKey =
  | "profile"
  | "pages"
  | "sources"
  | "menus"
  | "theme"
  | "lifecycle";

export const ZONE_MANAGE_PAGES = [
  {
    key: "profile",
    labelKey: "zone:manage_profile",
  },
  {
    key: "pages",
    labelKey: "zone:manage_sections",
  },
  {
    key: "sources",
    labelKey: "zone:manage_sources",
  },
  {
    key: "menus",
    labelKey: "zone:manage_menus",
  },
  {
    key: "theme",
    labelKey: "zone:manage_theme",
  },
  {
    key: "lifecycle",
    labelKey: "zone:manage_lifecycle",
  },
] as const satisfies readonly {
  key: ZoneManagePageKey;
  labelKey: `zone:${string}`;
}[];

export function zoneManageBaseHref(location: ZoneRouteLocation): string {
  return `${zoneRouteBaseHref(location)}/manage`;
}

export function zoneManagePageHref(
  location: ZoneRouteLocation,
  page: ZoneManagePageKey = "profile",
): string {
  return `${zoneManageBaseHref(location)}/${page}`;
}

export function zoneManagePageFromPathname(
  pathname: string,
): ZoneManagePageKey {
  return (
    ZONE_MANAGE_PAGES.find((page) => pathname.endsWith(`/manage/${page.key}`))
      ?.key ?? "profile"
  );
}
