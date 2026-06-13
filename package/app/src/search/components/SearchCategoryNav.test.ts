import { describe, expect, test } from "bun:test";
import { permittedCategoriesForScope } from "./permittedCategories";

describe("permittedCategoriesForScope", () => {
  test("global scope permits every category", () => {
    expect(permittedCategoriesForScope({ kind: "global" })).toEqual([
      "all",
      "mixed",
      "books",
      "reviews",
      "excerpts",
      "remarks",
      "posts",
      "comments",
      "shelves",
      "realms",
      "zones",
      "users",
      "entities",
    ]);
  });

  test("realm scope omits realms, zones, users, and entities", () => {
    const out = permittedCategoriesForScope({ kind: "realm", realmId: "r" });
    expect(out).not.toContain("realms");
    expect(out).not.toContain("zones");
    expect(out).not.toContain("users");
    expect(out).not.toContain("entities");
    expect(out).toContain("books");
    expect(out).toContain("comments");
    expect(out).toContain("shelves");
  });

  test("zone scope omits realms, zones, users, and entities", () => {
    const out = permittedCategoriesForScope({
      kind: "zone",
      zoneUnitId: "zone-1",
    });
    expect(out).not.toContain("realms");
    expect(out).not.toContain("zones");
    expect(out).not.toContain("users");
    expect(out).not.toContain("entities");
    expect(out).toContain("books");
    expect(out).toContain("comments");
    expect(out).toContain("shelves");
  });

  test("user scope omits users", () => {
    const out = permittedCategoriesForScope({ kind: "user", userId: "u" });
    expect(out).not.toContain("users");
    expect(out).toContain("entities");
    expect(out).toContain("realms");
    expect(out).toContain("zones");
    expect(out).toContain("comments");
  });

  test("book scope omits books, realms, zones, users, and entities", () => {
    const out = permittedCategoriesForScope({ kind: "book", unitId: "b" });
    expect(out).not.toContain("books");
    expect(out).not.toContain("realms");
    expect(out).not.toContain("zones");
    expect(out).not.toContain("users");
    expect(out).not.toContain("entities");
    expect(out).toContain("reviews");
    expect(out).toContain("comments");
    expect(out).toContain("shelves");
  });

  test("saved scope only exposes shelf search categories", () => {
    expect(
      permittedCategoriesForScope({
        kind: "saved",
        shelfId: "saved-shelf-1",
        userId: "user-1",
      }),
    ).toEqual(["all", "shelves"]);
  });
});
