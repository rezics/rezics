import { describe, expect, test } from "bun:test";
import { mapBaseBookToDTO } from "./mapper";

function bookRow(overrides: Record<string, unknown> = {}) {
  return {
    unitId: "release-1",
    unit: {
      id: "release-1",
      userId: null,
      user: null,
      workUnitId: null,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      rating: "GENERAL",
      aiDisclosureMode: "UNKNOWN",
      aiDisclosureDetails: null,
      licenseSlug: null,
      defaultLanguage: "en",
      isLanguageNeutral: false,
      translations: [],
      workMemberships: [],
      creditAttributions: [],
      publishedAt: null,
    },
    isbn13: null,
    publicationDate: null,
    pageCount: null,
    textLength: 0,
    chapterCount: 0,
    formatKey: null,
    isLicensed: false,
    extra: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as any;
}

describe("mapBaseBookToDTO", () => {
  test("projects USWN from canonical UnitWork membership", () => {
    const dto = mapBaseBookToDTO(
      bookRow({
        unit: {
          ...bookRow().unit,
          workUnitId: "legacy-work",
          workMemberships: [
            {
              unitId: "release-1",
              workUnitId: "canonical-work",
              role: "RELEASE",
              language: "en",
              position: null,
              displayPolicy: "PRIMARY",
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            },
          ],
        },
      }),
    );

    expect(dto.metadata?.uswn).toBe("canonical-work");
  });

  test("projects null USWN for standalone content", () => {
    const dto = mapBaseBookToDTO(bookRow());

    expect(dto.metadata?.uswn).toBeNull();
  });

  test("projects AI disclosure metadata independently from rating", () => {
    const dto = mapBaseBookToDTO(
      bookRow({
        unit: {
          ...bookRow().unit,
          rating: "GENERAL",
          aiDisclosureMode: "MACHINE_GENERATED",
          aiDisclosureDetails: { provider: "OpenAI", reviewedByHuman: true },
        },
      }),
    );

    expect(dto.rating).toBe("GENERAL");
    expect(dto.aiDisclosureMode).toBe("MACHINE_GENERATED");
    expect(dto.aiDisclosureDetails).toEqual({
      provider: "OpenAI",
      reviewedByHuman: true,
    });
  });
});
