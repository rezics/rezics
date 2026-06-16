import {
  realmDetailBaseHref,
  type RealmDetailRouteLocation,
} from "./realmDetailRoutes";

export type RealmManagePageKey =
  | "profile"
  | "organization"
  | "dock"
  | "moderation"
  | "members"
  | "danger";

export const REALM_MANAGE_PAGES = [
  {
    key: "profile",
    labelKey: "community:realm_manage_tab_profile",
  },
  {
    key: "organization",
    labelKey: "community:realm_manage_tab_organization",
  },
  {
    key: "dock",
    labelKey: "community:realm_manage_tab_dock",
  },
  {
    key: "moderation",
    labelKey: "community:realm_manage_tab_moderation",
  },
  {
    key: "members",
    labelKey: "community:realm_manage_tab_members",
  },
  {
    key: "danger",
    labelKey: "community:realm_manage_tab_danger",
  },
] as const satisfies readonly {
  key: RealmManagePageKey;
  labelKey: `community:${string}`;
}[];

export function realmManageBaseHref(
  location: RealmDetailRouteLocation,
): string {
  return `${realmDetailBaseHref(location)}/manage`;
}

export function realmManagePageHref(
  location: RealmDetailRouteLocation,
  page: RealmManagePageKey = "profile",
): string {
  return `${realmManageBaseHref(location)}/${page}`;
}

export function realmManagePageFromPathname(
  pathname: string,
): RealmManagePageKey {
  return (
    REALM_MANAGE_PAGES.find((page) => pathname.endsWith(`/manage/${page.key}`))
      ?.key ?? "profile"
  );
}
