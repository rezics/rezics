import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  createEntitySchema,
  entityDTOSchema,
  entityKindKeySchema,
  updateEntitySchema,
} from "./entity";
import { EntitySearchOptionsSchema } from "./meili/entity";

describe("entity kind registry schemas", () => {
  test("accept registered entity kind keys", () => {
    expect(Value.Check(entityKindKeySchema, "person")).toBe(true);
    expect(Value.Check(entityKindKeySchema, "organization")).toBe(true);
    expect(Value.Check(entityKindKeySchema, "game_platform")).toBe(true);
    expect(Value.Check(entityKindKeySchema, "universe")).toBe(true);
  });

  test("reject unregistered entity kind keys", () => {
    expect(Value.Check(entityKindKeySchema, "untracked_custom_kind")).toBe(
      false,
    );
  });

  test("validate create and update entity write shapes", () => {
    expect(
      Value.Check(createEntitySchema, {
        kind: "person",
        avatar: "https://cdn.example/entity.png",
        eligibleCreditRoles: ["author", "translator"],
        eligibleSubjectRoles: ["about"],
        translations: [{ language: "en", title: "Pen Name" }],
      }),
    ).toBe(true);

    expect(
      Value.Check(updateEntitySchema, {
        kind: "untracked_custom_kind",
      }),
    ).toBe(false);
  });

  test("entity DTO exposes avatar", () => {
    expect(
      Value.Check(entityDTOSchema, {
        unitId: "entity-1",
        kind: "person",
        avatar: "https://cdn.example/entity.png",
        verified: false,
        eligibleCreditRoles: ["author"],
        eligibleSubjectRoles: ["about"],
      }),
    ).toBe(true);
  });

  test("entity eligibility arrays validate against attribution registries", () => {
    expect(
      Value.Check(createEntitySchema, {
        kind: "person",
        eligibleCreditRoles: ["author", "translator"],
        eligibleSubjectRoles: ["about"],
        translations: [{ language: "en", title: "Pen Name" }],
      }),
    ).toBe(true);

    expect(
      Value.Check(createEntitySchema, {
        kind: "person",
        eligibleCreditRoles: ["made_up_credit_role"],
        eligibleSubjectRoles: [],
        translations: [{ language: "en", title: "Pen Name" }],
      }),
    ).toBe(false);

    expect(
      Value.Check(updateEntitySchema, {
        eligibleCreditRoles: ["author"],
        eligibleSubjectRoles: ["made_up_subject_role"],
      }),
    ).toBe(false);
  });

  test("entity search options use eligibility role filters", () => {
    expect(
      Value.Check(EntitySearchOptionsSchema, {
        eligibleCreditRole: "author",
        eligibleSubjectRole: "about",
      }),
    ).toBe(true);

    expect(
      Value.Check(EntitySearchOptionsSchema, {
        eligibleCreditRole: "made_up_credit_role",
      }),
    ).toBe(false);
  });
});
