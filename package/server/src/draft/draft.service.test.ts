import { beforeEach, describe, expect, mock, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";

describe("draftService.listMine", () => {
  const listDraftPosts = mock(async () => [] as any[]);

  beforeEach(() => {
    listDraftPosts.mockReset();
    listDraftPosts.mockResolvedValue([]);
  });

  test("derives root post title and excerpt from translation rows only", async () => {
    listDraftPosts.mockResolvedValue([
      {
        unitId: "post-1",
        kind: "POST",
        updatedAt: new Date("2026-05-29T00:00:00.000Z"),
        unit: {
          targetUnitId: null,
          defaultLanguage: "ja",
          supportLanguages: [
            { language: "en", isPrimary: true, sortOrder: 1 },
            { language: "ja", isPrimary: false, sortOrder: 2 },
          ],
          translations: [
            { language: "en", title: "English draft" },
            { language: "ja", title: "Japanese draft" },
          ],
          contentTranslations: [
            { language: "en", content: markdownContentDoc("English body") },
            { language: "ja", content: markdownContentDoc("Japanese body") },
          ],
        },
      },
    ]);

    const { DraftService } = await import("./draft.service");
    const draftService = new DraftService({ listDraftPosts });
    const drafts = await draftService.listMine("user-1");

    expect(drafts[0]).toMatchObject({
      id: "post-1",
      kind: "post",
      title: "Japanese draft",
      excerpt: "Japanese body",
    });
    expect(listDraftPosts).toHaveBeenCalledWith("user-1", 50);
  });

  test("uses primary support language when the default language has no title", async () => {
    listDraftPosts.mockResolvedValue([
      {
        unitId: "review-1",
        kind: "REVIEW",
        updatedAt: new Date("2026-05-29T00:00:00.000Z"),
        unit: {
          targetUnitId: "book-1",
          defaultLanguage: "ja",
          supportLanguages: [
            { language: "en", isPrimary: true, sortOrder: 1 },
            { language: "ja", isPrimary: false, sortOrder: 2 },
          ],
          translations: [
            { language: "ja", title: " " },
            { language: "en", title: "Primary title" },
          ],
          contentTranslations: [
            { language: "ja", content: markdownContentDoc("") },
            { language: "en", content: markdownContentDoc("Primary body") },
          ],
        },
      },
    ]);

    const { DraftService } = await import("./draft.service");
    const draftService = new DraftService({ listDraftPosts });
    const [draft] = await draftService.listMine("user-1");

    expect(draft?.title).toBe("Primary title");
    expect(draft?.excerpt).toBe("Primary body");
  });
});
