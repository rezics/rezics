import { afterEach, describe, expect, test } from "bun:test";
import {
  createI18nRuntime,
  resetI18nRuntimeForTests,
} from "@rezics/i18n/runtime";
import {
  documentTitle,
  resolveTitleLabel,
  titleOfBook,
  titleOfPost,
  titleOfUser,
} from "./documentTitle";

const resources = {
  "zh-hant": {
    common: {},
    shell: {},
    auth: {},
    page: { book_tabs_info: "資訊" },
  },
} as const;

const backend = {
  type: "backend" as const,
  init() {},
  read(
    language: string,
    namespace: string,
    callback: (error: Error | null, data: Record<string, string>) => void,
  ) {
    const languageResources =
      resources[language as keyof typeof resources] ?? {};
    const namespaceResources =
      languageResources[namespace as keyof typeof languageResources] ?? {};
    callback(null, namespaceResources);
  },
};

afterEach(() => {
  resetI18nRuntimeForTests();
});

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

  test("loads lazy namespaces before resolving route title labels", async () => {
    createI18nRuntime({
      initialLocale: "zh-hant",
      extraPlugins: [backend],
    });

    await expect(resolveTitleLabel("page:book_tabs_info")).resolves.toBe(
      "資訊",
    );
  });
});
