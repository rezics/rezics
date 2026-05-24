import { describe, expect, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";
import { repairRichDescriptionValue } from "./repair-rich-description";

describe("repairRichDescriptionValue", () => {
  test("wraps non-empty strings into ContentDoc", () => {
    expect(repairRichDescriptionValue("hello")).toEqual(
      markdownContentDoc("hello"),
    );
  });

  test("converts empty strings to null", () => {
    expect(repairRichDescriptionValue("")).toBeNull();
    expect(repairRichDescriptionValue("   ")).toBeNull();
  });

  test("leaves existing ContentDoc and null values unchanged", () => {
    const doc = markdownContentDoc("already valid");
    expect(repairRichDescriptionValue(doc)).toBe(doc);
    expect(repairRichDescriptionValue(null)).toBeNull();
  });
});
