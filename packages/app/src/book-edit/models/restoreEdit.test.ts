import { describe, expect, test } from "bun:test";
import { isRestoreEditSubmitDisabled, withRestoreSource } from "./restoreEdit";

describe("restore edit submit state", () => {
  test("blocks restore mode while revision content is loading, failed, or missing", () => {
    expect(
      isRestoreEditSubmitDisabled({
        isRestoreMode: true,
        isLoading: true,
        hasError: false,
        hasContentPayload: false,
      }),
    ).toBe(true);
    expect(
      isRestoreEditSubmitDisabled({
        isRestoreMode: true,
        isLoading: false,
        hasError: true,
        hasContentPayload: false,
      }),
    ).toBe(true);
    expect(
      isRestoreEditSubmitDisabled({
        isRestoreMode: true,
        isLoading: false,
        hasError: false,
        hasContentPayload: false,
      }),
    ).toBe(true);
  });

  test("keeps normal edit mode submit available regardless of history state", () => {
    expect(
      isRestoreEditSubmitDisabled({
        isRestoreMode: false,
        isLoading: true,
        hasError: true,
        hasContentPayload: false,
      }),
    ).toBe(false);
  });

  test("does not attach restore source when restore metadata is disabled", () => {
    const input = {
      patch: {
        translations: {
          en: { title: "New title" },
        },
      },
    };

    expect(
      withRestoreSource(input, {
        enabled: false,
        bookId: "book-1",
        restoreSequence: 12,
        sourcePaths: ["translations.en.title"],
      }),
    ).toBe(input);
  });

  test("attaches restore source only for submitted paths from the loaded revision", () => {
    expect(
      withRestoreSource(
        {
          patch: {
            translations: {
              en: {
                title: "New title",
                summary: "New summary",
              },
            },
          },
        },
        {
          enabled: true,
          bookId: "book-1",
          restoreSequence: 12,
          sourcePaths: ["translations.en.title", "translations.en.subtitle"],
        },
      ).restoreSource,
    ).toEqual({
      kind: "revision",
      unitId: "book-1",
      sequence: 12,
      paths: ["translations.en.title"],
    });
  });
});
