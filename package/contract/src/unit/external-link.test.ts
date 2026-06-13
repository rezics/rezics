import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  createUnitExternalLinkSchema,
  unitExternalLinkDTOSchema,
} from "./external-ref";

describe("UnitExternalLink contract", () => {
  test("requires users to provide a source Entity and complete URL", () => {
    const input = {
      unitId: "unit-1",
      sourceEntityUnitId: "source-entity-1",
      url: "https://book.qidian.com/info/123",
      role: "source",
    };

    expect(Value.Check(createUnitExternalLinkSchema, input)).toBe(true);
    expect(
      Value.Check(createUnitExternalLinkSchema, {
        unitId: "unit-1",
        url: "https://book.qidian.com/info/123",
      }),
    ).toBe(false);
  });

  test("exposes source Entity display data with the stored URL", () => {
    expect(
      Value.Check(unitExternalLinkDTOSchema, {
        id: "link-1",
        unitId: "unit-1",
        sourceEntityUnitId: "source-entity-1",
        url: "https://book.qidian.com/info/123",
        role: "source",
        label: "Qidian",
        sourceEntity: {
          unitId: "source-entity-1",
          name: "Qidian",
          verified: true,
        },
        position: "a",
        createdAt: "2026-06-12T00:00:00.000Z",
        updatedAt: "2026-06-12T00:00:00.000Z",
      }),
    ).toBe(true);
  });
});
