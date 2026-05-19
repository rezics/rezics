import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  AttributionFieldKey,
  BookFieldKey,
  CreationMode,
  EntityFieldKey,
  GameFieldKey,
  MediaFieldKey,
  UNIT_FIELD_KEYS,
  UNIT_FIELD_LOCK_ALL,
  UnitAuthorityRoleKey,
  UnitCommonFieldKey,
  WikiPostFieldKey,
  creationModeSchema,
  lockFieldKeySchema,
  unitAuthorityRoleKeySchema,
  unitFieldKeySchema,
} from "./content-authority";
import { PostKind, postKindLiterals } from "./post";

describe("content authority vocabulary", () => {
  test("creation mode literals are stable", () => {
    expect(CreationMode.WIKI).toBe("wiki");
    expect(CreationMode.PERSONAL).toBe("personal");
    expect(Value.Check(creationModeSchema, "wiki")).toBe(true);
    expect(Value.Check(creationModeSchema, "personal")).toBe(true);
    expect(Value.Check(creationModeSchema, "community")).toBe(false);
  });

  test("post kind includes wiki", () => {
    expect(PostKind.WIKI).toBe("WIKI");
    expect(Value.Check(postKindLiterals, "WIKI")).toBe(true);
  });

  test("authority role literals are stable", () => {
    expect(UnitAuthorityRoleKey.OWNER).toBe("owner");
    expect(UnitAuthorityRoleKey.MAINTAINER).toBe("maintainer");
    expect(UnitAuthorityRoleKey.EDITOR).toBe("editor");
    expect(UnitAuthorityRoleKey.VIEWER).toBe("viewer");
    expect(Value.Check(unitAuthorityRoleKeySchema, "editor")).toBe(true);
    expect(Value.Check(unitAuthorityRoleKeySchema, "admin")).toBe(false);
  });

  test("field key vocabulary covers planned semantic groups", () => {
    const expected = [
      UnitCommonFieldKey.TITLE,
      UnitCommonFieldKey.COVER,
      BookFieldKey.ISBN_13,
      EntityFieldKey.KIND,
      GameFieldKey.PLATFORM,
      MediaFieldKey.KIND,
      AttributionFieldKey.CREDITS_AUTHORS,
      AttributionFieldKey.SUBJECTS,
      AttributionFieldKey.TAGS,
      WikiPostFieldKey.BODY,
    ];

    expect(new Set(UNIT_FIELD_KEYS).size).toBe(UNIT_FIELD_KEYS.length);
    for (const fieldKey of expected) {
      expect(UNIT_FIELD_KEYS).toContain(fieldKey);
      expect(Value.Check(unitFieldKeySchema, fieldKey)).toBe(true);
      expect(Value.Check(lockFieldKeySchema, fieldKey)).toBe(true);
    }
  });

  test("whole-object lock is accepted only by lock schema", () => {
    expect(UNIT_FIELD_LOCK_ALL).toBe("*");
    expect(Value.Check(lockFieldKeySchema, UNIT_FIELD_LOCK_ALL)).toBe(true);
    expect(Value.Check(unitFieldKeySchema, UNIT_FIELD_LOCK_ALL)).toBe(false);
  });
});
