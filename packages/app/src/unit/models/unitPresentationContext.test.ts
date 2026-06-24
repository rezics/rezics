import { describe, expect, test } from "bun:test";
import {
  hiddenUnitPresentationContext,
  realmPresentationContext,
  shouldDisplayPresentationContext,
  unitPresentationContext,
  zonePresentationContext,
} from "./unitPresentationContext";

describe("unit presentation context", () => {
  test("represents a visible unit context by unit kind", () => {
    expect(
      unitPresentationContext({ unitKind: "book", unitId: "book-1" }),
    ).toEqual({
      kind: "unit",
      unitKind: "book",
      unitId: "book-1",
      visibility: "visible",
    });
  });

  test("represents direct post self-context as hidden", () => {
    const context = hiddenUnitPresentationContext("post", "post-1");

    expect(context).toEqual({
      kind: "unit",
      unitKind: "post",
      unitId: "post-1",
      visibility: "hidden",
    });
    expect(shouldDisplayPresentationContext(context)).toBe(false);
  });

  test("keeps realm and zone presentation in the same shape family", () => {
    expect(realmPresentationContext("realm-1")).toEqual({
      kind: "realm",
      realmUnitId: "realm-1",
      visibility: "visible",
    });
    expect(
      zonePresentationContext({ zoneUnitId: "zone-1", zoneSlug: "book" }),
    ).toEqual({
      kind: "zone",
      zoneUnitId: "zone-1",
      zoneSlug: "book",
      visibility: "visible",
    });
  });
});
