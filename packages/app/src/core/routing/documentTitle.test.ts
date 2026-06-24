import { describe, expect, test } from "bun:test";
import {
  documentTitle,
  productTitleMeta,
  titleContext,
  titleOfBook,
  titleOfEntity,
  titleOfPost,
  titleOfRealm,
  titleMeta,
  titleSubject,
  titleOfUser,
} from "./documentTitle";

describe("documentTitle", () => {
  test("renders unit-kind policy and contexts through one contract", () => {
    expect(
      documentTitle({ subject: titleSubject("book", "Weathering With You") }),
    ).toBe("Weathering With You : book");
    expect(documentTitle({ subject: titleSubject("post", "Thread") })).toBe(
      "Thread",
    );
    expect(
      documentTitle({
        subject: titleSubject("post", "Thread"),
        contexts: [titleContext("realm", "Taiwanese Lesbians")],
      }),
    ).toBe("Thread : r/Taiwanese Lesbians");
    expect(
      documentTitle({
        subject: titleSubject("post", "Thread"),
        contexts: [titleContext("zone", "Makoto Shinkai")],
      }),
    ).toBe("Thread : z/Makoto Shinkai");
  });

  test("does not render ids, slugs, i18n keys, tab labels, or product suffixes", () => {
    expect(
      titleMeta({
        subject: titleSubject(
          "post",
          titleOfPost({ unitId: "post-1", title: "Thread" }),
        ),
        contexts: [
          titleContext(
            "realm",
            titleOfRealm({
              unitId: "realm-1",
              slug: "realm-slug",
              title: "Realm",
              translations: [],
            }),
          ),
        ],
      }),
    ).toEqual({
      meta: [{ title: "Thread : r/Realm" }],
    });
    const title = titleMeta({
      subject: titleSubject(
        "book",
        titleOfBook({ unitId: "book-1", title: "Book", translations: [] }),
      ),
    }).meta[0]?.title;
    expect(title).not.toContain("Rezics");
    expect(title).not.toContain("book-1");
    expect(title).not.toContain("資訊");
    expect(title).not.toContain("book_tabs_info");
    expect(title).not.toContain("|");
  });

  test("selects resolved and translated entity titles without id or slug fallback", () => {
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
    expect(titleOfUser({ unitId: "user-1", slug: "alice" })).toBeNull();
    expect(
      titleOfEntity({
        unitId: "entity-1",
        slug: "entity-slug",
        translations: [],
      }),
    ).toBeNull();
  });

  test("renders the product title only through the explicit product contract", () => {
    expect(productTitleMeta()).toEqual({
      meta: [{ title: "Rezics" }],
    });
    expect(
      documentTitle({
        subject: titleSubject("product", "Rezics"),
      }),
    ).toBe("Rezics");
  });
});
