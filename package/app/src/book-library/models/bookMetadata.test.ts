import { describe, expect, test } from "bun:test";
import type { BookDTO } from "@rezics/contract";
import { resolveMetadataPanelUswn } from "./bookMetadata";

describe("resolveMetadataPanelUswn", () => {
  test("uses server-provided USWN metadata", () => {
    expect(
      resolveMetadataPanelUswn({
        unitId: "release-1",
        workUnitId: "legacy-work",
        metadata: { uswn: "canonical-work" },
      } as BookDTO),
    ).toBe("canonical-work");
  });

  test("does not compute USWN from legacy workUnitId", () => {
    expect(
      resolveMetadataPanelUswn({
        unitId: "standalone-1",
        workUnitId: "legacy-work",
      } as BookDTO),
    ).toBeNull();
  });
});
