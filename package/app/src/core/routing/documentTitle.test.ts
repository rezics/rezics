import { describe, expect, test } from "bun:test";
import {
  documentTitle,
  titleOfBook,
  titleOfPost,
  titleOfUser,
} from "./documentTitle";

describe("documentTitle", () => {
  test("normalizes empty parts and appends the site title once", () => {
    expect(documentTitle(["", "Book", null, "Rezics"])).toBe("Book | Rezics");
    expect(documentTitle(["Book", "Reviews"])).toBe("Book | Reviews | Rezics");
  });

  test("selects resolved and translated entity titles", () => {
    expect(
      titleOfBook(
        {
          unitId: "book-1",
          title: null,
          translations: [
            { unitId: "book-1", language: "en", title: "English" },
            { unitId: "book-1", language: "zh-hant", title: "繁體" },
          ],
        },
        { appLocale: "zh-hant", languages: ["en"] },
      ),
    ).toBe("繁體");
    expect(titleOfPost({ unitId: "post-1", title: "Thread" })).toBe("Thread");
    expect(titleOfUser({ unitId: "user-1", slug: "alice" })).toBe("alice");
  });
});
