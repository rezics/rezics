import { beforeEach, describe, expect, mock, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";

installPrismaClientMock();

describe("draftService.listMine", () => {
  beforeEach(() => {
    for (const key of Object.keys(prismaMock)) delete prismaMock[key];
  });

  test("derives root post title and excerpt from translation rows only", async () => {
    const findMany = mock(async () => [
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
    prismaMock.post = { findMany };

    const { draftService } = await import("./draft.service");
    const drafts = await draftService.listMine("user-1");

    expect(drafts[0]).toMatchObject({
      id: "post-1",
      kind: "post",
      title: "Japanese draft",
      excerpt: "Japanese body",
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({
          content: expect.anything(),
          extra: expect.anything(),
        }),
      }),
    );
  });

  test("uses primary support language when the default language has no title", async () => {
    prismaMock.post = {
      findMany: mock(async () => [
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
      ]),
    };

    const { draftService } = await import("./draft.service");
    const [draft] = await draftService.listMine("user-1");

    expect(draft?.title).toBe("Primary title");
    expect(draft?.excerpt).toBe("Primary body");
  });
});
