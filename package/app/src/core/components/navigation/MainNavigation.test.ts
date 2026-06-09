import { describe, expect, test } from "bun:test";
import { NAVIGATION, REMOVED_MAIN_SIDEBAR_SEGMENTS } from "./MainNavigation";
import type { NavigationItem } from "./navigation";

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
});
