import { describe, expect, test } from "bun:test";
import { PostKind } from "@rezics/contract";
import {
  buildInternalSharePostCreateInput,
  buildSharePostContent,
  defaultSharePostTitle,
  normalizeSharePostTitle,
} from "./sharePost";

describe("share post helpers", () => {
  test("builds direct internal share posts as ordinary posts with empty main content", () => {
    expect(
      buildInternalSharePostCreateInput({
        targetUnitId: "book-1",
        targetUnitType: "BOOK",
        language: "en",
        title: " Example Book ",
      }),
    ).toEqual({
      kind: PostKind.POST,
      language: "en",
      title: "Example Book",
      content: {
        schema: "rezics.content",
        version: 1,
        main: { type: "markdown", source: "" },
        afterMain: [
          {
            type: "unit-ref",
            source: { unitId: "book-1", unitType: "BOOK" },
          },
        ],
      },
      status: "PUBLISHED",
    });
  });

  test("builds write-share content with ordinary markdown plus the structured unit ref", () => {
    expect(
      buildSharePostContent({
        targetUnitId: "unit-1",
        body: "  worth reading  ",
      }),
    ).toEqual({
      schema: "rezics.content",
      version: 1,
      main: { type: "markdown", source: "worth reading" },
      afterMain: [{ type: "unit-ref", source: { unitId: "unit-1" } }],
    });
  });

  test("normalizes empty share titles to the fallback ordinary post title", () => {
    expect(normalizeSharePostTitle("")).toBe(defaultSharePostTitle);
    expect(normalizeSharePostTitle(null)).toBe(defaultSharePostTitle);
  });
});
