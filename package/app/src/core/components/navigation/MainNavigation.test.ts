import { describe, expect, test } from "bun:test";
import {
  NAVIGATION,
  type NavigationTranslateFn,
  REMOVED_MAIN_SIDEBAR_SEGMENTS,
} from "./MainNavigation";
import type { NavigationItem } from "./navigation";

const EN: Record<string, string> = {
  "shell:navigation_home": "Home",
  "shell:navigation_login": "Sign in",
  "shell:navigation_create_account": "Create account",
  "shell:navigation_zones": "Zones",
  "shell:navigation_all_zones": "All Zones",
  "shell:navigation_no_subscribed_zones": "No subscribed zones",
  "shell:navigation_realms": "Realms",
  "shell:navigation_all_realms": "All Realms",
  "shell:navigation_no_subscribed_realms": "No subscribed realms",
  "shell:navigation_loading": "Loading {section}...",
};
const t: NavigationTranslateFn = (key, params) => {
  let value = EN[key] ?? key;
  if (params)
    for (const [k, v] of Object.entries(params))
      value = value.replace(`{${k}}`, v);
  return value;
};

function flattenItems(items: readonly NavigationItem[]): NavigationItem[] {
  return items.flatMap((item) =>
    item.kind === "section" ? [item, ...flattenItems(item.children)] : [item],
  );
}

describe("NAVIGATION", () => {
  test("builds the authenticated main sidebar as Home plus Zones and Realms sections", () => {
    const navigation = NAVIGATION(
      { isAuthenticated: true, isAdmin: false },
      {
        zones: {
          items: [{ unitId: "zone-1", title: "Books", href: "/z/books" }],
        },
        realms: {
          items: [{ unitId: "realm-1", title: "Fiction", href: "/r/fiction" }],
        },
      },
      t,
    );

    const sections = navigation.filter((item) => item.kind === "section");
    expect(sections).toHaveLength(3);
    expect(navigation[0]).toMatchObject({ kind: "section", id: "home" });
    expect(navigation[1]).toMatchObject({ kind: "divider" });
    expect(
      navigation[0].kind === "section" ? navigation[0].title : "unexpected",
    ).toBeUndefined();
    expect(
      navigation[0].kind === "section"
        ? navigation[0].children.map((item) =>
            item.kind === "item" ? item.title : item.kind,
          )
        : [],
    ).toEqual(["Home"]);

    expect(navigation[2]).toMatchObject({
      kind: "section",
      id: "zones",
      title: "Zones",
      collapsible: true,
      defaultOpen: true,
    });
    expect(
      navigation[2].kind === "section"
        ? navigation[2].children.map((item) =>
            item.kind === "item" ? item.title : item.kind,
          )
        : [],
    ).toEqual(["All Zones", "Books"]);

    expect(navigation[3]).toMatchObject({
      kind: "section",
      id: "realms",
      title: "Realms",
      collapsible: true,
      defaultOpen: true,
    });
    expect(
      navigation[3].kind === "section"
        ? navigation[3].children.map((item) =>
            item.kind === "item" ? item.title : item.kind,
          )
        : [],
    ).toEqual(["All Realms", "Fiction"]);
  });

  test("removes sidebar-only entry points without encoding route removal", () => {
    const navigation = NAVIGATION(
      { isAuthenticated: true, isAdmin: false },
      { zones: { items: [] }, realms: { items: [] } },
      t,
    );
    const segments = flattenItems(navigation)
      .filter(
        (item): item is Extract<NavigationItem, { kind: "item" }> =>
          item.kind === "item",
      )
      .map((item) => item.segment);

    for (const segment of REMOVED_MAIN_SIDEBAR_SEGMENTS) {
      expect(segments).not.toContain(segment);
    }
  });

  test("shows subscription status rows after each All entry", () => {
    const navigation = NAVIGATION(
      { isAuthenticated: true, isAdmin: false },
      {
        zones: { items: [], isLoading: true },
        realms: { items: [], isLoading: true },
      },
      t,
    );
    const zones = navigation.find(
      (item) => item.kind === "section" && item.id === "zones",
    );
    const realms = navigation.find(
      (item) => item.kind === "section" && item.id === "realms",
    );

    expect(
      zones?.kind === "section"
        ? zones.children.map((item) =>
            item.kind === "item" || item.kind === "status"
              ? item.title
              : item.kind,
          )
        : [],
    ).toEqual(["All Zones", "Loading zones..."]);
    expect(
      realms?.kind === "section"
        ? realms.children.map((item) =>
            item.kind === "item" || item.kind === "status"
              ? item.title
              : item.kind,
          )
        : [],
    ).toEqual(["All Realms", "Loading realms..."]);
  });

  test("orders subscription entries by pinned state and position while excluding removed entries", () => {
    const navigation = NAVIGATION(
      { isAuthenticated: true, isAdmin: false },
      {
        zones: {
          items: [
            {
              unitId: "zone-unpinned",
              title: "Unpinned",
              href: "/z/unpinned",
              subscribedType: "ZONE",
              pinned: false,
              position: "V",
              state: "ACTIVE",
            },
            {
              unitId: "zone-removed",
              title: "Removed",
              href: "/z/removed",
              subscribedType: "ZONE",
              pinned: true,
              position: "0",
              state: "REMOVED",
            },
            {
              unitId: "zone-pinned",
              title: "Pinned",
              href: "/z/pinned",
              subscribedType: "ZONE",
              pinned: true,
              position: "Z",
              state: "ACTIVE",
            },
          ],
        },
        realms: { items: [] },
      },
      t,
    );
    const zones = navigation.find(
      (item) => item.kind === "section" && item.id === "zones",
    );

    expect(
      zones?.kind === "section"
        ? zones.children.map((item) =>
            item.kind === "item" ? item.title : item.kind,
          )
        : [],
    ).toEqual(["All Zones", "Pinned", "Unpinned"]);
    const pinnedItem =
      zones?.kind === "section"
        ? zones.children.find(
            (item) => item.kind === "item" && item.title === "Pinned",
          )
        : null;
    expect(pinnedItem).toMatchObject({
      kind: "item",
      subscriptionListEntry: {
        subscribedUnitId: "zone-pinned",
        subscribedType: "ZONE",
        pinned: true,
        position: "Z",
      },
    });
  });

  test("does not render Zones or Realms sections for unauthenticated users", () => {
    const navigation = NAVIGATION(
      { isAuthenticated: false, isAdmin: false },
      {
        zones: {
          items: [{ unitId: "zone-1", title: "Books", href: "/z/books" }],
        },
        realms: {
          items: [{ unitId: "realm-1", title: "Fiction", href: "/r/fiction" }],
        },
      },
      t,
    );

    expect(
      navigation.some((item) => item.kind === "section" && item.id === "zones"),
    ).toBe(false);
    expect(
      navigation.some(
        (item) => item.kind === "section" && item.id === "realms",
      ),
    ).toBe(false);
    expect(
      navigation[0].kind === "section" ? navigation[0].title : "unexpected",
    ).toBeUndefined();
    expect(
      flattenItems(navigation)
        .filter(
          (item): item is Extract<NavigationItem, { kind: "item" }> =>
            item.kind === "item",
        )
        .map((item) => item.title),
    ).toEqual(["Home", "Sign in", "Create account"]);
  });
});
