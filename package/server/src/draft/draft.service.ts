import {
  contentDocMarkdownFallback,
  type DraftMetadata,
  mainMarkdownSource,
} from "@rezics/contract";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  ContentTranslation,
  Post,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
} from "../db/schema";
import { postKindToDraftKind, toDraftMetadata } from "./draft.mapper";

/** Draft-eligible post kinds (reply/excerpt/chapter never become drafts).
 * 可作为草稿的 post 类型（reply/excerpt/chapter 永远不会成为草稿）。 */
const DRAFT_POST_KINDS = ["REVIEW", "REMARK", "POST", "WIKI"] as const;
const DRAFT_UNIT_STATUS = "DRAFT";

type DraftPostRow = {
  unitId: string;
  kind: string | null;
  updatedAt: Date;
  unit: {
    targetUnitId: string | null;
    defaultLanguage: string | null;
    supportLanguages: Array<{
      language: string;
      isPrimary: boolean;
      sortOrder: number;
    }>;
    translations: Array<{ language: string; title: string | null }>;
    contentTranslations: Array<{ language: string; content: unknown }>;
  };
};

type DraftRepository = {
  listDraftPosts(userId: string, take: number): Promise<DraftPostRow[]>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function groupRowsByUnitId<T extends { unitId: string }>(
  rows: readonly T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const list = grouped.get(row.unitId);
    if (list) {
      list.push(row);
    } else {
      grouped.set(row.unitId, [row]);
    }
  }
  return grouped;
}

function createDrizzleDraftRepository(): DraftRepository {
  return {
    async listDraftPosts(userId, take) {
      const db = await getServerDb();
      const posts = await db
        .select({
          unitId: Post.unitId,
          kind: Post.kind,
          updatedAt: Post.updatedAt,
          targetUnitId: Unit.targetUnitId,
          defaultLanguage: Unit.defaultLanguage,
        })
        .from(Post)
        .innerJoin(Unit, eq(Unit.id, Post.unitId))
        .where(
          and(
            inArray(Post.kind, [...DRAFT_POST_KINDS]),
            eq(Post.authorUserId, userId),
            eq(Unit.status, DRAFT_UNIT_STATUS),
          ),
        )
        .orderBy(desc(Post.updatedAt))
        .limit(take);

      const unitIds = posts.map((post) => post.unitId);
      if (unitIds.length === 0) return [];

      const [translations, contentTranslations, supportLanguages] =
        await Promise.all([
          db
            .select({
              unitId: UnitTranslation.unitId,
              language: UnitTranslation.language,
              title: UnitTranslation.title,
            })
            .from(UnitTranslation)
            .where(inArray(UnitTranslation.unitId, unitIds)),
          db
            .select({
              unitId: ContentTranslation.unitId,
              language: ContentTranslation.language,
              content: ContentTranslation.content,
            })
            .from(ContentTranslation)
            .where(inArray(ContentTranslation.unitId, unitIds)),
          db
            .select({
              unitId: UnitSupportLanguage.unitId,
              language: UnitSupportLanguage.language,
              isPrimary: UnitSupportLanguage.isPrimary,
              sortOrder: UnitSupportLanguage.sortOrder,
            })
            .from(UnitSupportLanguage)
            .where(inArray(UnitSupportLanguage.unitId, unitIds))
            .orderBy(asc(UnitSupportLanguage.sortOrder)),
        ]);

      const translationsByUnitId = groupRowsByUnitId(translations);
      const contentTranslationsByUnitId =
        groupRowsByUnitId(contentTranslations);
      const supportLanguagesByUnitId = groupRowsByUnitId(supportLanguages);

      return posts.map((post) => ({
        unitId: post.unitId,
        kind: post.kind,
        updatedAt: post.updatedAt,
        unit: {
          targetUnitId: post.targetUnitId,
          defaultLanguage: post.defaultLanguage,
          translations: translationsByUnitId.get(post.unitId) ?? [],
          contentTranslations:
            contentTranslationsByUnitId.get(post.unitId) ?? [],
          supportLanguages: supportLanguagesByUnitId.get(post.unitId) ?? [],
        },
      }));
    },
  };
}

/** Collapse a ContentDoc to a single line of plain text, trimmed.
 * 将 ContentDoc 折叠为单行纯文本，并去除首尾空白。 */
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

export class DraftService {
  constructor(private readonly repository = createDrizzleDraftRepository()) {}

  /**
   * List the user's draft-status posts across draft-eligible kinds, newest
   * first. Reuses the existing `Unit.status = DRAFT` storage; no separate
   * draft table.
   * 列出用户在所有可作为草稿的类型下处于草稿状态的 post，按最新优先排序。
   * 复用既有的 `Unit.status = DRAFT` 存储，不使用单独的草稿表。
   */
  async listMine(
    userId: string,
    query?: { limit?: number },
  ): Promise<DraftMetadata[]> {
    const take = Math.max(1, Math.min(query?.limit ?? 50, 100));
    const posts = await this.repository.listDraftPosts(userId, take);

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
  }
}

export const draftService = new DraftService();

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
