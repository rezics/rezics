import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  createWorkRealmContextSchema,
  resolvedWorkRealmContextSchema,
  updateWorkRealmContextSchema,
  workRealmContextConflictSchema,
  workRealmContextRoleSchema,
} from "./work-realm-context";

describe("WorkRealmContext contract schemas", () => {
  test("accept supported context roles", () => {
    for (const role of ["official", "community", "language", "archive"]) {
      expect(Value.Check(workRealmContextRoleSchema, role)).toBe(true);
    }

    expect(Value.Check(workRealmContextRoleSchema, "owner")).toBe(false);
  });

  test("validates create and update inputs", () => {
    expect(
      Value.Check(createWorkRealmContextSchema, {
        workUnitId: "work-1",
        realmUnitId: "realm-1",
        role: "official",
        priority: 10,
        locale: "en",
        releaseUnitId: null,
      }),
    ).toBe(true);
    expect(
      Value.Check(updateWorkRealmContextSchema, {
        role: "community",
        locale: null,
        releaseUnitId: "release-1",
      }),
    ).toBe(true);
    expect(
      Value.Check(createWorkRealmContextSchema, {
        workUnitId: "work-1",
        realmUnitId: "realm-1",
        role: "official",
        unsupported: true,
      }),
    ).toBe(false);
  });

  test("validates conflict and resolve DTOs", () => {
    const conflict = {
      code: "WORK_REALM_CONTEXT_CONFLICT",
      workUnitId: "work-1",
      role: "official",
      locale: null,
      releaseUnitId: null,
      contextIds: ["ctx-1", "ctx-2"],
    };

    expect(Value.Check(workRealmContextConflictSchema, conflict)).toBe(true);
    expect(
      Value.Check(resolvedWorkRealmContextSchema, {
        releaseUnitId: "release-1",
        workUnitId: "work-1",
        official: null,
        community: [],
        language: [],
        archive: [],
        conflicts: [conflict],
      }),
    ).toBe(true);
  });
});
