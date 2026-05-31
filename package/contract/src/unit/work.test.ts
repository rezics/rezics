import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  createUnitWorkSchema,
  unitWorkDTOSchema,
  unitWorkRoleSchema,
  workDomainSearchMetadataSchema,
} from "./work";

describe("unit work contract schemas", () => {
  test("accepts release membership writes", () => {
    expect(
      Value.Check(createUnitWorkSchema, {
        unitId: "release-1",
        workUnitId: "work-1",
        role: "RELEASE",
        language: "en",
        position: "a0",
        displayPolicy: "PRIMARY",
      }),
    ).toBe(true);
  });

  test("accepts content membership DTOs", () => {
    expect(
      Value.Check(unitWorkDTOSchema, {
        unitId: "post-1",
        workUnitId: "work-1",
        role: "POST",
        language: null,
        position: null,
        displayPolicy: "SECONDARY",
        createdAt: "2026-05-27T00:00:00.000Z",
        updatedAt: "2026-05-27T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  test("accepts derived Series work-domain membership DTOs", () => {
    expect(
      Value.Check(unitWorkDTOSchema, {
        unitId: "series-1",
        workUnitId: "work-1",
        role: "SERIES",
        language: null,
        position: null,
        displayPolicy: "PRIMARY",
      }),
    ).toBe(true);
  });

  test("rejects unknown membership roles", () => {
    expect(Value.Check(unitWorkRoleSchema, "COMMENT")).toBe(false);
  });

  test("accepts work-domain search metadata", () => {
    expect(
      Value.Check(workDomainSearchMetadataSchema, {
        workUnitId: "work-1",
        ownTagIds: ["tag-own"],
        workTagIds: ["tag-work"],
        allTagIds: ["tag-own", "tag-work"],
        ownTagLabels: ["Own"],
        workTagLabels: ["Work"],
        allTagLabels: ["Own", "Work"],
        position: "a0",
        displayPolicy: "PRIMARY",
      }),
    ).toBe(true);
  });
});
