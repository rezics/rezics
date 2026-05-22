import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  linkSubjectAttributionSchema,
  subjectAttributionBySubjectQuerySchema,
  subjectAttributionRoleKeySchema,
  subjectAttributionRoleRegistry,
} from "./subject-attribution";

describe("subject attribution role registry schemas", () => {
  test("accept registered subject role keys", () => {
    expect(
      Value.Check(subjectAttributionRoleKeySchema, "primary_character"),
    ).toBe(true);
    expect(
      Value.Check(subjectAttributionRoleKeySchema, "featured_character"),
    ).toBe(true);
  });

  test("reject unregistered subject role keys", () => {
    expect(Value.Check(subjectAttributionRoleKeySchema, "sect_founder")).toBe(
      false,
    );
  });

  test("link and query inputs validate role keys", () => {
    expect(
      Value.Check(linkSubjectAttributionSchema, {
        unitId: "post-1",
        entityId: "entity-1",
        role: "primary_character",
      }),
    ).toBe(true);

    expect(
      Value.Check(subjectAttributionBySubjectQuerySchema, {
        role: "sect_founder",
      }),
    ).toBe(false);
  });

  test("primary character registry entry provides character kind hint", () => {
    expect(
      subjectAttributionRoleRegistry.primary_character.entityKindHints,
    ).toContain("character");
    expect(subjectAttributionRoleRegistry.primary_character.key).toBe(
      "primary_character",
    );
  });
});
