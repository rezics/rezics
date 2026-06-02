import {
  contentDocMarkdownFallback,
  type DraftMetadata,
  mainMarkdownSource,
} from "@rezics/contract";
import { PostKind, prisma, UnitStatus } from "#/prisma/client";
import { postKindToDraftKind, toDraftMetadata } from "./draft.mapper";

/** Draft-eligible post kinds (reply/excerpt/chapter never become drafts). */
const DRAFT_POST_KINDS = [
  PostKind.REVIEW,
  PostKind.REMARK,
  PostKind.POST,
  PostKind.WIKI,
];

/** Collapse a ContentDoc to a single line of plain text, trimmed. */
function plainText(content: unknown): string {
  return (mainMarkdownSource(content) ?? contentDocMarkdownFallback(content))
    .replace(/[#*_>`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveTitle(
  translations: Array<{ title: string | null; language: string }>,
): string {
  for (const translation of translations) {
    if (translation.title?.trim()) {
      return translation.title.trim().slice(0, 120);
    }
  }
  return "";
}

function deriveExcerpt(
  contentTranslations: Array<{ content: unknown; language: string }>,
): string | undefined {
  for (const translation of contentTranslations) {
    const translatedText = plainText(translation.content);
    if (translatedText) return translatedText.slice(0, 200);
  }
  return undefined;
}

export const draftService = {
  /**
   * List the user's draft-status posts across draft-eligible kinds, newest
   * first. Reuses the existing `Unit.status = DRAFT` storage; no separate
   * draft table.
   */
  async listMine(
    userId: string,
    query?: { limit?: number },
  ): Promise<DraftMetadata[]> {
    const take = Math.max(1, Math.min(query?.limit ?? 50, 100));
    const posts = await prisma.post.findMany({
      where: {
        authorUserId: userId,
        kind: { in: DRAFT_POST_KINDS },
        unit: { status: UnitStatus.DRAFT },
      },
      select: {
        unitId: true,
        kind: true,
        unit: {
          select: {
            targetUnitId: true,
            defaultLanguage: true,
            supportLanguages: {
              select: { language: true, isPrimary: true, sortOrder: true },
              orderBy: { sortOrder: "asc" },
            },
            translations: { select: { language: true, title: true } },
            contentTranslations: { select: { language: true, content: true } },
          },
        },
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take,
    });

    const drafts: DraftMetadata[] = [];
    for (const post of posts) {
      const kind = postKindToDraftKind(post.kind);
      if (!kind) continue;
      drafts.push(
        toDraftMetadata({
          unitId: post.unitId,
          kind,
          title: deriveTitle(
            orderByPostLanguage(
              post.unit.translations,
              post.unit.defaultLanguage,
              post.unit.supportLanguages,
            ),
          ),
          excerpt: deriveExcerpt(
            orderByPostLanguage(
              post.unit.contentTranslations,
              post.unit.defaultLanguage,
              post.unit.supportLanguages,
            ),
          ),
          updatedAt: post.updatedAt.toISOString(),
          targetUnitId: post.unit.targetUnitId,
        }),
      );
    }
    return drafts;
  },
};

function orderByPostLanguage<T extends { language: string }>(
  rows: T[],
  defaultLanguage: string | null,
  supportLanguages: Array<{
    language: string;
    isPrimary: boolean;
    sortOrder: number;
  }>,
): T[] {
  const order = [
    defaultLanguage,
    supportLanguages.find((language) => language.isPrimary)?.language,
    ...supportLanguages
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((language) => language.language),
    ...rows.map((row) => row.language),
  ];
  const rank = new Map(
    [
      ...new Set(order.filter((language): language is string => !!language)),
    ].map((language, index) => [language, index]),
  );
  return [...rows].sort(
    (a, b) =>
      (rank.get(a.language) ?? Number.MAX_SAFE_INTEGER) -
      (rank.get(b.language) ?? Number.MAX_SAFE_INTEGER),
  );
}
