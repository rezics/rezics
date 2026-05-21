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
      "shelves",
      "realms",
      "users",
      "entities",
    ]);
  });

  test("realm scope omits realms, users, and entities", () => {
    const out = permittedCategoriesForScope({ kind: "realm", realmId: "r" });
    expect(out).not.toContain("realms");
    expect(out).not.toContain("users");
    expect(out).not.toContain("entities");
    expect(out).toContain("books");
    expect(out).toContain("shelves");
  });

  test("user scope omits users", () => {
    const out = permittedCategoriesForScope({ kind: "user", userId: "u" });
    expect(out).not.toContain("users");
    expect(out).toContain("entities");
    expect(out).toContain("realms");
  });

  test("book scope omits books, realms, users, and entities", () => {
    const out = permittedCategoriesForScope({ kind: "book", unitId: "b" });
    expect(out).not.toContain("books");
    expect(out).not.toContain("realms");
    expect(out).not.toContain("users");
    expect(out).not.toContain("entities");
    expect(out).toContain("reviews");
    expect(out).toContain("shelves");
  });
});
