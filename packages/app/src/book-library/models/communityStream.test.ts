import { describe, expect, test } from "bun:test";
import {
  resolveBookCommunityStreamQuery,
  resolvePostTargetVariantLabel,
} from "./communityStream";

describe("book community stream helpers", () => {
  test("uses the current catalog entry as the stream target", () => {
    expect(
      resolveBookCommunityStreamQuery({
        currentCatalogEntryUnitId: "entry-1",
      }),
    ).toEqual({ mode: "entry", targetUnitId: "entry-1" });
  });

  test("labels variant-target posts without labelling current-entry posts", () => {
    const titles = { "variant-2": "Translated Edition" };

    expect(
      resolvePostTargetVariantLabel(
        { targetUnitId: "variant-2" },
        "entry-1",
        titles,
      ),
    ).toBe("Translated Edition");
    expect(
      resolvePostTargetVariantLabel(
        { targetUnitId: "entry-1" },
        "entry-1",
        titles,
      ),
    ).toBeUndefined();
  });
});
