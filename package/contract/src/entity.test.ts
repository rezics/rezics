import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  createEntitySchema,
  entityDTOSchema,
  entityKindKeySchema,
  updateEntitySchema,
} from "./entity";

describe("entity kind registry schemas", () => {
  test("accept registered entity kind keys", () => {
    expect(Value.Check(entityKindKeySchema, "person")).toBe(true);
    expect(Value.Check(entityKindKeySchema, "organization")).toBe(true);
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
      }),
    ).toBe(true);
  });
});
