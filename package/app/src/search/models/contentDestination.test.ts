import { describe, expect, test } from "bun:test";
import type { ContentSearchDocument } from "@rezics/contract";
import { contentHref } from "./contentDestination";

describe("search result card destinations", () => {
  test("book content cards route to the visible result id, not grouped work metadata", () => {
    const item = {
      id: "release-visible",
      type: "BOOK",
      workUnitId: "hidden-work",
      workUnitIds: ["hidden-work"],
    } as unknown as ContentSearchDocument;

    expect(contentHref(item)).toBe("/book/release-visible");
  });
});
