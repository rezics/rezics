import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  creditAttributionBriefSchema,
  creditAttributionRoleKeySchema,
  creditAttributionRoleRegistry,
  linkCreditAttributionSchema,
} from "./credit-attribution";

describe("credit attribution role registry schemas", () => {
  test("accept registered credit role keys", () => {
    expect(Value.Check(creditAttributionRoleKeySchema, "author")).toBe(true);
    expect(Value.Check(creditAttributionRoleKeySchema, "translator")).toBe(
      true,
    );
  });

  test("reject unregistered credit role keys", () => {
    expect(Value.Check(creditAttributionRoleKeySchema, "color_assistant")).toBe(
      false,
    );
  });

  test("link input validates role keys", () => {
    expect(
      Value.Check(linkCreditAttributionSchema, {
        unitId: "book-1",
        entityId: "entity-1",
        role: "author",
      }),
    ).toBe(true);

    expect(
      Value.Check(linkCreditAttributionSchema, {
        unitId: "book-1",
        entityId: "entity-1",
        role: "color_assistant",
      }),
    ).toBe(false);
  });

  test("brief entity exposes avatar", () => {
    expect(
      Value.Check(creditAttributionBriefSchema, {
        entityId: "entity-1",
        name: "Author",
        role: "author",
        entity: {
          unitId: "entity-1",
          kind: "person",
          avatar: "https://cdn.example/entity.png",
        },
      }),
    ).toBe(true);
  });

  test("author registry entry is metadata-prominent for books", () => {
    expect(creditAttributionRoleRegistry.author.appliesToUnitTypes).toContain(
      "BOOK",
    );
    expect(creditAttributionRoleRegistry.author.prominence).toBe("metadata");
    expect(creditAttributionRoleRegistry.author.i18nKey).toBe(
      "attribution.credit.role.author",
    );
  });
});
