import { describe, expect, mock, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";
import type { PostWithRelations } from "./types";

mock.module("@/unit/publication-policy", () => ({
  publicUnitEligibilityWhere: {},
  resolveStoredLicenseSlug: (value: unknown) => value,
}));
mock.module("@/unit/variant-context", () => ({
  variantContextForRow: () => null,
}));
mock.module("@/utils/sanitizeUser", () => ({
  mapPublicUser: (user: unknown) => user,
  publicUserSelect: {},
}));

const { mapPostToDTO } = await import("./post.mapper");

const basePost = {
  unitId: "post-1",
  authorUserId: "user-1",
  variantUnitId: null,
  kind: "POST",
  scoreEntryId: null,
  replyCount: 0,
  directReplyCount: 0,
  lastReplyAt: null,
  isLocked: false,
  state: null,
  extra: null,
  createdAt: new Date("2026-06-02T00:00:00.000Z"),
  updatedAt: new Date("2026-06-02T00:00:00.000Z"),
  unit: {
    targetUnitId: null,
    status: "PUBLISHED",
    visibility: "PUBLIC",
    licenseSlug: null,
    user: null,
    contentModerationState: null,
    inRealms: [],
    supportLanguages: [
      { unitId: "post-1", language: "en", isPrimary: true, sortOrder: 0 },
      { unitId: "post-1", language: "ja", isPrimary: false, sortOrder: 1 },
    ],
    translations: [],
    contentTranslations: [],
  },
} as unknown as PostWithRelations;

describe("mapPostToDTO", () => {
  test("resolves post title and body from translations", () => {
    const dto = mapPostToDTO({
      ...basePost,
      unit: {
        ...basePost.unit,
        translations: [
          { unitId: "post-1", language: "en", title: "English title" },
        ],
        contentTranslations: [
          {
            unitId: "post-1",
            language: "en",
            content: markdownContentDoc("translated body"),
          },
        ],
      },
    } as unknown as PostWithRelations);

    expect(dto.resolvedLanguage).toBe("en");
    expect(dto.title).toBe("English title");
    expect(dto.content).toEqual(markdownContentDoc("translated body"));
  });

  test("keeps resolved supported language even when fields are missing", () => {
    const dto = mapPostToDTO({
      ...basePost,
      unit: {
        ...basePost.unit,
        translations: [
          { unitId: "post-1", language: "ja", title: "Japanese title" },
        ],
        contentTranslations: [],
      },
    } as unknown as PostWithRelations);

    expect(dto.resolvedLanguage).toBe("en");
    expect(dto.title).toBeNull();
    expect(dto.content).toBeNull();
  });

  test("resolves list preview from request language candidates", () => {
    const dto = mapPostToDTO(
      {
        ...basePost,
        unit: {
          ...basePost.unit,
          translations: [
            { unitId: "post-1", language: "ja", title: "Japanese title" },
          ],
          contentTranslations: [],
        },
      } as unknown as PostWithRelations,
      undefined,
      ["ja", "en"],
    );

    expect(dto.resolvedLanguage).toBe("ja");
    expect(dto.title).toBe("Japanese title");
  });

  test("returns null title and body when translations are absent", () => {
    const dto = mapPostToDTO(basePost);

    expect(dto.resolvedLanguage).toBe("en");
    expect(dto.title).toBeNull();
    expect(dto.content).toBeNull();
  });
});
