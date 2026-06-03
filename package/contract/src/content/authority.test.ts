import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { PostKind, postKindLiterals } from "../post";
import {
  CreationMode,
  creationModeSchema,
  EXTERNALLY_GOVERNED_PATHS,
  isExternallyGoverned,
  lockPathIntersectsPatchPath,
  pathsIntersect,
  UNIT_FIELD_LOCK_ALL,
  UnitAuthorityRoleKey,
  unitAuthorityRoleKeySchema,
  unitFieldLockSchema,
} from "./authority";

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

  test("field lock accepts free-form paths", () => {
    expect(UNIT_FIELD_LOCK_ALL).toBe("*");
    expect(
      Value.Check(unitFieldLockSchema, {
        unitId: "unit-1",
        path: "translations.en.title",
        lockedById: "user-1",
        reason: null,
        createdAt: "2026-05-23T00:00:00.000Z",
      }),
    ).toBe(true);
    expect(
      Value.Check(unitFieldLockSchema, {
        unitId: "unit-1",
        fieldKey: "identity.title",
        lockedById: "user-1",
        createdAt: "2026-05-23T00:00:00.000Z",
      }),
    ).toBe(false);
  });

  test("path intersection uses dot-boundary prefix matching", () => {
    expect(pathsIntersect("credits.authors", "credits.authors")).toBe(true);
    expect(pathsIntersect("credits", "credits.authors")).toBe(true);
    expect(pathsIntersect("credits.authors", "credits")).toBe(true);
    expect(pathsIntersect("credits.authors", "credits.translators")).toBe(
      false,
    );
    expect(pathsIntersect("tags", "tagSummary")).toBe(false);
  });

  test("whole-object lock intersects editorial patch paths", () => {
    expect(
      lockPathIntersectsPatchPath(UNIT_FIELD_LOCK_ALL, "translations.en.title"),
    ).toBe(true);
    expect(
      lockPathIntersectsPatchPath("credits.authors", "credits.translators"),
    ).toBe(false);
  });

  test("externally governed paths are prefix-boundary matched", () => {
    expect(EXTERNALLY_GOVERNED_PATHS).toEqual(["tags", "realmTagApplications"]);
    expect(isExternallyGoverned("tags")).toBe(true);
    expect(isExternallyGoverned("tags.primary")).toBe(true);
    expect(isExternallyGoverned("realmTagApplications.foo")).toBe(true);
    expect(isExternallyGoverned("tagSummary")).toBe(false);
  });
});
