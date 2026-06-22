import {
  type ContinueReadingItem,
  type ContinueReadingListQuery,
  type ContinueReadingListResponse,
  type LinkProgressPostBody,
  type ProgressLibraryListResponse,
  type ProgressLibraryRow,
  type ProgressLibraryUnitSummary,
  type ProgressPostLinksResponse,
  type UpdateProgressPostLinkBody,
  parseReadLanguages,
  readCoverUrlFromExtra,
  resolveReadLanguage,
  type UnitProgressListResponse,
  type UnitProgressStatsResponse,
  userUnitProgressStatusValues,
} from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { PROGRESS_BUCKET_COUNT } from "@rezics/search";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { serverJobProducer } from "@/job/job-boundary";
import { searchClient } from "@/meili/search-client";
import { AppError } from "@/utils/errors";
import {
  ContentStructureNode,
  Post,
  ShelfItem,
  Unit,
  UnitTranslation,
  UserContentNodeProgress,
  UserUnitProgress,
  UserUnitProgressPost,
} from "../db/schema";
import { mapProgressPostLinkToDTO, mapProgressToDTO } from "./progress.mapper";
import type {
  ProgressCursor,
  ProgressListInput,
  ProgressUpsertInput,
} from "./progress.types";
import { progressStatusMap } from "./progress.types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const CONTINUE_READING_LIMIT = 12;
const ANCHOR_PREVIEW_MAX = 200;

type UserUnitProgressRow = typeof UserUnitProgress.$inferSelect;
type UserUnitProgressPostRow = typeof UserUnitProgressPost.$inferSelect;
type ProgressStatus = UserUnitProgressRow["status"];

type TranslationRow = {
  language: string;
  title: string | null;
  extra?: unknown;
};

type TitleDisplay = {
  defaultLanguage: string | null;
  translations: TranslationRow[];
};

type UnitDisplay = TitleDisplay & {
  type: string;
  catalogEntryKind: ProgressLibraryUnitSummary["catalogEntryKind"];
  targetUnitId: string | null;
};

type ProgressPage = {
  rows: (UserUnitProgressRow & {
    unit?: UnitDisplay & { targetUnit?: UnitDisplay | null };
    lastReadNode?: { isDeleted: boolean } | null;
  })[];
  nextCursor: string | null;
};

type ContentNodeSummary = {
  ownerUnitId: string;
  isDeleted: boolean;
};

type ProgressCreateData = {
  userId: string;
  unitId: string;
  progress: number;
  status: ProgressStatus;
  isDeleted: boolean;
  completedCount: number;
  totalTimeMs: number;
  lastReadNodeId?: string | null;
  lastReadAnchor?: unknown;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

type ProgressUpdateData = {
  lastSeenAt: Date;
  isDeleted: boolean;
  progress?: number;
  status?: ProgressStatus;
  completedCount?: number;
  lastReadNodeId?: string | null;
  lastReadAnchor?: unknown;
  totalTimeMsIncrement?: number;
};

type ProgressShelfLinkRow = {
  unitId: string;
  shelfId: string;
  shelf: { unit: TitleDisplay };
};

type ContinueReadingRow = {
  unitId: string;
  lastReadNodeId: string | null;
  lastReadAnchor: unknown;
  unit: TitleDisplay;
  lastReadNode: {
    id: string;
    title: string;
    isDeleted: boolean;
  } | null;
};

export type ProgressRepository = {
  findProgressState(
    userId: string,
    unitId: string,
  ): Promise<Pick<UserUnitProgressRow, "status" | "completedCount"> | null>;
  findProgress(
    userId: string,
    unitId: string,
  ): Promise<UserUnitProgressRow | null>;
  findPostOwner(postUnitId: string): Promise<{ authorUserId: string } | null>;
  listProgressPostLinks(progressId: string): Promise<UserUnitProgressPostRow[]>;
  upsertProgressPostLink(input: {
    progressId: string;
    postUnitId: string;
    status: ProgressStatus;
    now: Date;
  }): Promise<UserUnitProgressPostRow>;
  updateProgressPostLinkStatus(input: {
    progressId: string;
    postUnitId: string;
    status: ProgressStatus;
    now: Date;
  }): Promise<UserUnitProgressPostRow | null>;
  deleteProgressPostLink(progressId: string, postUnitId: string): Promise<void>;
  findContentNode(nodeId: string): Promise<ContentNodeSummary | null>;
  upsertProgress(input: {
    userId: string;
    unitId: string;
    create: ProgressCreateData;
    update: ProgressUpdateData;
  }): Promise<UserUnitProgressRow>;
  listProgressRows(input: {
    userId: string;
    cursorDate: Date | null;
    cursorUnitId: string | null;
    take: number;
  }): Promise<ProgressPage["rows"]>;
  findShelfLinks(
    userId: string,
    unitIds: string[],
  ): Promise<ProgressShelfLinkRow[]>;
  listContinueReading(input: {
    userId: string;
    take: number;
  }): Promise<ContinueReadingRow[]>;
  countChaptersTotal(bookIds: string[]): Promise<Map<string, number>>;
  listCompletedChapterOwnerUnitIds(
    userId: string,
    bookIds: string[],
  ): Promise<string[]>;
  softDeleteProgress(userId: string, unitId: string, now: Date): Promise<void>;
  upsertNodeCompletion(userId: string, nodeId: string): Promise<void>;
  deleteNodeCompletion(userId: string, nodeId: string): Promise<void>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function encodeCursor(cursor: ProgressCursor): string {
  return encodeURIComponent(JSON.stringify(cursor));
}

function decodeCursor(cursor: string): ProgressCursor {
  try {
    const parsed = JSON.parse(decodeURIComponent(cursor)) as ProgressCursor;
    if (!parsed.lastSeenAt || !parsed.unitId) {
      throw new Error("missing cursor fields");
    }
    return parsed;
  } catch {
    throw new AppError(400, "Invalid progress cursor");
  }
}

function validateInput(input: ProgressUpsertInput): void {
  if (
    input.progress !== undefined &&
    (input.progress < 0 || input.progress > 1)
  ) {
    throw new AppError(400, "progress must be between 0 and 1");
  }

  if (input.addTimeMs !== undefined && input.addTimeMs < 0) {
    throw new AppError(400, "addTimeMs must be non-negative");
  }

  if (input.completedCount !== undefined && input.completedCount < 0) {
    throw new AppError(400, "completedCount must be non-negative");
  }
}

function readFacetCount(
  distribution: Record<string, number> | undefined,
  key: string | number,
): number {
  return distribution?.[String(key)] ?? 0;
}

function enqueueProgressSearch(
  kind:
    | typeof SEARCH_COMMAND_KINDS.progressSync
    | typeof SEARCH_COMMAND_KINDS.progressRemove,
  userId: string,
  unitId: string,
) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      kind,
      { userId, unitId },
      { type: "server", service: "progress" },
    ),
  );
}

function orderedTranslations(
  unit: TitleDisplay,
  readLanguage: ProgressListInput = {},
): TranslationRow[] {
  const resolvedLanguage = resolveReadLanguage({
    appLocale: readLanguage.appLocale,
    languages: parseReadLanguages(readLanguage.languages),
    availableLanguages: unit.translations.map((t) => t.language),
    fallbackLanguage: unit.defaultLanguage,
  });
  const ordered = [
    resolvedLanguage
      ? unit.translations.find((t) => t.language === resolvedLanguage)
      : undefined,
    unit.defaultLanguage
      ? unit.translations.find((t) => t.language === unit.defaultLanguage)
      : undefined,
    unit.translations.find((t) => t.language === "en"),
    ...unit.translations,
  ];
  return ordered.filter((tr): tr is TranslationRow => Boolean(tr));
}

function pickTitle(unit: TitleDisplay, readLanguage: ProgressListInput = {}) {
  for (const tr of orderedTranslations(unit, readLanguage)) {
    if (tr?.title) return tr.title;
  }
  return "";
}

function pickCover(
  unit: TitleDisplay,
  readLanguage: ProgressListInput = {},
): string | undefined {
  for (const tr of orderedTranslations(unit, readLanguage)) {
    const url = readCoverUrlFromExtra(tr?.extra);
    if (url) return url;
  }
  return undefined;
}

function pickAnchorText(anchor: unknown): string | undefined {
  if (anchor && typeof anchor === "object" && "text" in anchor) {
    const text = (anchor as { text?: unknown }).text;
    if (typeof text === "string" && text.length > 0) {
      return text.length <= ANCHOR_PREVIEW_MAX
        ? text
        : text.slice(0, ANCHOR_PREVIEW_MAX);
    }
  }
  return undefined;
}

function unitSummary(
  unitId: string,
  unit: UnitDisplay,
  readLanguage: ProgressListInput = {},
): ProgressLibraryUnitSummary {
  return {
    unitId,
    title: pickTitle(unit, readLanguage) || unitId,
    coverUrl: pickCover(unit, readLanguage),
    unitType: unit.type as ProgressLibraryUnitSummary["unitType"],
    catalogEntryKind: unit.catalogEntryKind,
    targetUnitId: unit.targetUnitId,
  };
}

function createDrizzleProgressRepository(): ProgressRepository {
  async function hydrateProgressRows(
    rows: UserUnitProgressRow[],
  ): Promise<ProgressPage["rows"]> {
    if (rows.length === 0) return [];

    const db = await getServerDb();
    const unitIds = rows.map((row) => row.unitId);
    const lastReadNodeIds = rows
      .map((row) => row.lastReadNodeId)
      .filter((id): id is string => Boolean(id));

    const units = await db.select().from(Unit).where(inArray(Unit.id, unitIds));
    const targetUnitIds = units
      .map((unit) => unit.targetUnitId)
      .filter((id): id is string => Boolean(id));
    const allUnitIds = [...new Set([...unitIds, ...targetUnitIds])];

    const [targetUnits, translations, lastReadNodes] = await Promise.all([
      targetUnitIds.length
        ? db.select().from(Unit).where(inArray(Unit.id, targetUnitIds))
        : Promise.resolve([]),
      allUnitIds.length
        ? db
            .select()
            .from(UnitTranslation)
            .where(inArray(UnitTranslation.unitId, allUnitIds))
        : Promise.resolve([]),
      lastReadNodeIds.length
        ? db
            .select({
              id: ContentStructureNode.id,
              isDeleted: ContentStructureNode.isDeleted,
            })
            .from(ContentStructureNode)
            .where(inArray(ContentStructureNode.id, lastReadNodeIds))
        : Promise.resolve([]),
    ]);

    const translationsByUnit = new Map<string, TranslationRow[]>();
    for (const translation of translations) {
      const list = translationsByUnit.get(translation.unitId) ?? [];
      list.push({
        language: translation.language,
        title: translation.title,
        extra: translation.extra,
      });
      translationsByUnit.set(translation.unitId, list);
    }

    const toDisplay = (unit: typeof Unit.$inferSelect): UnitDisplay => ({
      type: unit.type,
      catalogEntryKind: unit.catalogEntryKind,
      targetUnitId: unit.targetUnitId,
      defaultLanguage: unit.defaultLanguage,
      translations: translationsByUnit.get(unit.id) ?? [],
    });

    const targetUnitsById = new Map(
      targetUnits.map((unit) => [unit.id, toDisplay(unit)]),
    );
    const unitsById = new Map(
      units.map((unit) => [
        unit.id,
        {
          ...toDisplay(unit),
          targetUnit: unit.targetUnitId
            ? (targetUnitsById.get(unit.targetUnitId) ?? null)
            : null,
        },
      ]),
    );
    const lastReadNodesById = new Map(
      lastReadNodes.map((node) => [
        node.id,
        { isDeleted: node.isDeleted } satisfies { isDeleted: boolean },
      ]),
    );

    return rows.map((row) => ({
      ...row,
      unit: unitsById.get(row.unitId),
      lastReadNode: row.lastReadNodeId
        ? (lastReadNodesById.get(row.lastReadNodeId) ?? null)
        : null,
    }));
  }

  return {
    async findProgressState(userId, unitId) {
      const db = await getServerDb();
      const [row] = await db
        .select({
          status: UserUnitProgress.status,
          completedCount: UserUnitProgress.completedCount,
        })
        .from(UserUnitProgress)
        .where(
          and(
            eq(UserUnitProgress.userId, userId),
            eq(UserUnitProgress.unitId, unitId),
          ),
        )
        .limit(1);
      return row ?? null;
    },
    async findProgress(userId, unitId) {
      const db = await getServerDb();
      const [row] = await db
        .select()
        .from(UserUnitProgress)
        .where(
          and(
            eq(UserUnitProgress.userId, userId),
            eq(UserUnitProgress.unitId, unitId),
          ),
        )
        .limit(1);
      return row ?? null;
    },
    async findPostOwner(postUnitId) {
      const db = await getServerDb();
      const [row] = await db
        .select({ authorUserId: Post.authorUserId })
        .from(Post)
        .where(eq(Post.unitId, postUnitId))
        .limit(1);
      return row ?? null;
    },
    async listProgressPostLinks(progressId) {
      const db = await getServerDb();
      return db
        .select()
        .from(UserUnitProgressPost)
        .where(eq(UserUnitProgressPost.progressId, progressId))
        .orderBy(
          asc(UserUnitProgressPost.createdAt),
          asc(UserUnitProgressPost.postUnitId),
        );
    },
    async upsertProgressPostLink({ progressId, postUnitId, status, now }) {
      const db = await getServerDb();
      const [row] = await db
        .insert(UserUnitProgressPost)
        .values({ progressId, postUnitId, status, updatedAt: now })
        .onConflictDoUpdate({
          target: [
            UserUnitProgressPost.progressId,
            UserUnitProgressPost.postUnitId,
          ],
          set: { status, updatedAt: now },
        })
        .returning();
      if (!row) throw new AppError(500, "Failed to link progress post");
      return row;
    },
    async updateProgressPostLinkStatus({
      progressId,
      postUnitId,
      status,
      now,
    }) {
      const db = await getServerDb();
      const [row] = await db
        .update(UserUnitProgressPost)
        .set({ status, updatedAt: now })
        .where(
          and(
            eq(UserUnitProgressPost.progressId, progressId),
            eq(UserUnitProgressPost.postUnitId, postUnitId),
          ),
        )
        .returning();
      return row ?? null;
    },
    async deleteProgressPostLink(progressId, postUnitId) {
      const db = await getServerDb();
      await db
        .delete(UserUnitProgressPost)
        .where(
          and(
            eq(UserUnitProgressPost.progressId, progressId),
            eq(UserUnitProgressPost.postUnitId, postUnitId),
          ),
        );
    },
    async findContentNode(nodeId) {
      const db = await getServerDb();
      const [node] = await db
        .select({
          ownerUnitId: ContentStructureNode.ownerUnitId,
          isDeleted: ContentStructureNode.isDeleted,
        })
        .from(ContentStructureNode)
        .where(eq(ContentStructureNode.id, nodeId))
        .limit(1);
      return node ?? null;
    },
    async upsertProgress({ userId, unitId, create, update }) {
      const db = await getServerDb();
      const set: Record<string, unknown> = {
        lastSeenAt: update.lastSeenAt,
        isDeleted: update.isDeleted,
      };
      if (update.progress !== undefined) set.progress = update.progress;
      if (update.status !== undefined) set.status = update.status;
      if (update.completedCount !== undefined) {
        set.completedCount = update.completedCount;
      }
      if (update.lastReadNodeId !== undefined) {
        set.lastReadNodeId = update.lastReadNodeId;
      }
      if (update.lastReadAnchor !== undefined) {
        set.lastReadAnchor = update.lastReadAnchor;
      }
      if (update.totalTimeMsIncrement !== undefined) {
        set.totalTimeMs = sql`${UserUnitProgress.totalTimeMs} + ${update.totalTimeMsIncrement}`;
      }

      const [row] = await db
        .insert(UserUnitProgress)
        .values(create)
        .onConflictDoUpdate({
          target: [UserUnitProgress.userId, UserUnitProgress.unitId],
          set,
        })
        .returning();
      if (!row) {
        throw new AppError(500, "Failed to write progress");
      }
      return row;
    },
    async listProgressRows({ userId, cursorDate, cursorUnitId, take }) {
      const db = await getServerDb();
      const conditions = [
        eq(UserUnitProgress.userId, userId),
        eq(UserUnitProgress.isDeleted, false),
      ];
      if (cursorDate && cursorUnitId) {
        conditions.push(
          or(
            lt(UserUnitProgress.lastSeenAt, cursorDate),
            and(
              eq(UserUnitProgress.lastSeenAt, cursorDate),
              lt(UserUnitProgress.unitId, cursorUnitId),
            ),
          )!,
        );
      }

      const rows = await db
        .select()
        .from(UserUnitProgress)
        .where(and(...conditions))
        .orderBy(
          desc(UserUnitProgress.lastSeenAt),
          desc(UserUnitProgress.unitId),
        )
        .limit(take);
      return hydrateProgressRows(rows);
    },
    async findShelfLinks(userId, unitIds) {
      if (unitIds.length === 0) return [];
      const db = await getServerDb();
      const rows = await db
        .select({
          unitId: ShelfItem.itemId,
          shelfId: ShelfItem.shelfId,
          shelfDefaultLanguage: Unit.defaultLanguage,
          translationLanguage: UnitTranslation.language,
          translationTitle: UnitTranslation.title,
        })
        .from(ShelfItem)
        .innerJoin(Unit, eq(ShelfItem.shelfId, Unit.id))
        .leftJoin(
          UnitTranslation,
          eq(UnitTranslation.unitId, ShelfItem.shelfId),
        )
        .where(
          and(
            inArray(ShelfItem.itemId, unitIds),
            eq(ShelfItem.itemType, "unit"),
            eq(Unit.userId, userId),
          ),
        )
        .orderBy(asc(ShelfItem.createdAt), asc(UnitTranslation.language));

      const byShelfLink = new Map<string, ProgressShelfLinkRow>();
      for (const row of rows) {
        const key = `${row.shelfId}:${row.unitId}`;
        const link =
          byShelfLink.get(key) ??
          ({
            unitId: row.unitId,
            shelfId: row.shelfId,
            shelf: {
              unit: {
                defaultLanguage: row.shelfDefaultLanguage,
                translations: [],
              },
            },
          } satisfies ProgressShelfLinkRow);
        if (row.translationLanguage) {
          link.shelf.unit.translations.push({
            language: row.translationLanguage,
            title: row.translationTitle,
          });
        }
        byShelfLink.set(key, link);
      }
      return [...byShelfLink.values()];
    },
    async listContinueReading({ userId, take }) {
      const db = await getServerDb();
      const rows = await db
        .select({
          unitId: UserUnitProgress.unitId,
          lastReadNodeId: UserUnitProgress.lastReadNodeId,
          lastReadAnchor: UserUnitProgress.lastReadAnchor,
          defaultLanguage: Unit.defaultLanguage,
          lastReadNode: {
            id: ContentStructureNode.id,
            title: ContentStructureNode.title,
            isDeleted: ContentStructureNode.isDeleted,
          },
        })
        .from(UserUnitProgress)
        .innerJoin(Unit, eq(Unit.id, UserUnitProgress.unitId))
        .leftJoin(
          ContentStructureNode,
          eq(ContentStructureNode.id, UserUnitProgress.lastReadNodeId),
        )
        .where(
          and(
            eq(UserUnitProgress.userId, userId),
            eq(UserUnitProgress.isDeleted, false),
            inArray(UserUnitProgress.status, ["ACTIVE", "PAUSED"]),
          ),
        )
        .orderBy(desc(UserUnitProgress.lastSeenAt))
        .limit(take);

      const unitIds = rows.map((row) => row.unitId);
      const translations = unitIds.length
        ? await db
            .select({
              unitId: UnitTranslation.unitId,
              language: UnitTranslation.language,
              title: UnitTranslation.title,
              extra: UnitTranslation.extra,
            })
            .from(UnitTranslation)
            .where(inArray(UnitTranslation.unitId, unitIds))
        : [];
      const translationsByUnit = new Map<string, TranslationRow[]>();
      for (const translation of translations) {
        const list = translationsByUnit.get(translation.unitId) ?? [];
        list.push({
          language: translation.language,
          title: translation.title,
          extra: translation.extra,
        });
        translationsByUnit.set(translation.unitId, list);
      }

      return rows.map((row) => ({
        unitId: row.unitId,
        lastReadNodeId: row.lastReadNodeId,
        lastReadAnchor: row.lastReadAnchor,
        unit: {
          defaultLanguage: row.defaultLanguage,
          translations: translationsByUnit.get(row.unitId) ?? [],
        },
        lastReadNode: row.lastReadNode?.id ? row.lastReadNode : null,
      }));
    },
    async countChaptersTotal(bookIds) {
      if (bookIds.length === 0) return new Map();
      const db = await getServerDb();
      const rows = await db
        .select({
          ownerUnitId: ContentStructureNode.ownerUnitId,
          total: count(),
        })
        .from(ContentStructureNode)
        .where(
          and(
            inArray(ContentStructureNode.ownerUnitId, bookIds),
            eq(ContentStructureNode.isDeleted, false),
            isNotNull(ContentStructureNode.contentUnitId),
          ),
        )
        .groupBy(ContentStructureNode.ownerUnitId);
      return new Map(rows.map((row) => [row.ownerUnitId, row.total]));
    },
    async listCompletedChapterOwnerUnitIds(userId, bookIds) {
      if (bookIds.length === 0) return [];
      const db = await getServerDb();
      const rows = await db
        .select({ ownerUnitId: ContentStructureNode.ownerUnitId })
        .from(UserContentNodeProgress)
        .innerJoin(
          ContentStructureNode,
          eq(ContentStructureNode.id, UserContentNodeProgress.nodeId),
        )
        .where(
          and(
            eq(UserContentNodeProgress.userId, userId),
            inArray(ContentStructureNode.ownerUnitId, bookIds),
            eq(ContentStructureNode.isDeleted, false),
          ),
        );
      return rows.map((row) => row.ownerUnitId);
    },
    async softDeleteProgress(userId, unitId, now) {
      const db = await getServerDb();
      await db
        .update(UserUnitProgress)
        .set({ isDeleted: true, lastSeenAt: now })
        .where(
          and(
            eq(UserUnitProgress.userId, userId),
            eq(UserUnitProgress.unitId, unitId),
          ),
        );
    },
    async upsertNodeCompletion(userId, nodeId) {
      const db = await getServerDb();
      await db
        .insert(UserContentNodeProgress)
        .values({ userId, nodeId })
        .onConflictDoNothing();
    },
    async deleteNodeCompletion(userId, nodeId) {
      const db = await getServerDb();
      await db
        .delete(UserContentNodeProgress)
        .where(
          and(
            eq(UserContentNodeProgress.userId, userId),
            eq(UserContentNodeProgress.nodeId, nodeId),
          ),
        );
    },
  };
}

export class ProgressService {
  constructor(
    private readonly repository: ProgressRepository = createDrizzleProgressRepository(),
  ) {}

  async upsert(
    userId: string,
    unitId: string,
    input: ProgressUpsertInput,
  ): Promise<UserUnitProgressRow> {
    validateInput(input);

    const now = new Date();
    const addTimeMs = input.addTimeMs ?? 0;
    const coercedStatus =
      input.status === undefined && input.progress !== undefined
        ? input.progress >= 1
          ? "COMPLETED"
          : undefined
        : input.status !== undefined
          ? progressStatusMap[input.status]
          : undefined;
    const existing =
      coercedStatus === "COMPLETED" || input.completedCount !== undefined
        ? await this.repository.findProgressState(userId, unitId)
        : null;
    const isCompletionTransition =
      coercedStatus === "COMPLETED" && existing?.status !== "COMPLETED";
    const completedCount =
      input.completedCount !== undefined
        ? input.completedCount
        : isCompletionTransition
          ? (existing?.completedCount ?? 0) + 1
          : undefined;

    if (input.lastReadNodeId) {
      const node = await this.repository.findContentNode(input.lastReadNodeId);
      if (!node) {
        throw new AppError(404, "lastReadNodeId does not reference a node", {
          code: "content_structure_node_not_found",
        });
      }
      if (node.isDeleted) {
        throw new AppError(409, "lastReadNodeId targets a deleted node", {
          code: "content_structure_node_deleted",
        });
      }
    }

    const createData: ProgressCreateData = {
      userId,
      unitId,
      progress: input.progress ?? 0,
      status: coercedStatus ?? "BACKLOG",
      isDeleted: false,
      completedCount: completedCount ?? (coercedStatus === "COMPLETED" ? 1 : 0),
      totalTimeMs: addTimeMs,
      ...(input.lastReadNodeId ? { lastReadNodeId: input.lastReadNodeId } : {}),
      lastReadAnchor:
        input.lastReadAnchor !== undefined
          ? (input.lastReadAnchor ?? null)
          : undefined,
      firstSeenAt: now,
      lastSeenAt: now,
    };

    const updateData: ProgressUpdateData = {
      lastSeenAt: now,
      isDeleted: false,
      ...(input.progress !== undefined ? { progress: input.progress } : {}),
      ...(coercedStatus !== undefined ? { status: coercedStatus } : {}),
      ...(completedCount !== undefined ? { completedCount } : {}),
      ...(input.lastReadNodeId !== undefined
        ? { lastReadNodeId: input.lastReadNodeId }
        : {}),
      ...(input.lastReadAnchor !== undefined
        ? { lastReadAnchor: input.lastReadAnchor ?? null }
        : {}),
      ...(input.addTimeMs !== undefined
        ? { totalTimeMsIncrement: addTimeMs }
        : {}),
    };

    const row = await this.repository.upsertProgress({
      userId,
      unitId,
      create: createData,
      update: updateData,
    });

    await enqueueProgressSearch(
      SEARCH_COMMAND_KINDS.progressSync,
      row.userId,
      row.unitId,
    );

    return row;
  }

  async get(
    userId: string,
    unitId: string,
  ): Promise<UserUnitProgressRow | null> {
    const row = await this.repository.findProgress(userId, unitId);
    return row?.isDeleted ? null : row;
  }

  private async getOwnedProgress(
    userId: string,
    unitId: string,
  ): Promise<UserUnitProgressRow> {
    const row = await this.get(userId, unitId);
    if (!row) throw new AppError(404, "Progress not found");
    return row;
  }

  private async assertPostOwner(
    userId: string,
    postUnitId: string,
  ): Promise<void> {
    const post = await this.repository.findPostOwner(postUnitId);
    if (!post) throw new AppError(404, "Post not found");
    if (post.authorUserId !== userId) {
      throw new AppError(403, "Cannot link another user's post to progress");
    }
  }

  async listPostLinks(
    userId: string,
    unitId: string,
  ): Promise<ProgressPostLinksResponse> {
    const progress = await this.get(userId, unitId);
    if (!progress) return { links: [] };
    const rows = await this.repository.listProgressPostLinks(progress.id);
    return { links: rows.map(mapProgressPostLinkToDTO) };
  }

  async linkPost(
    userId: string,
    unitId: string,
    input: LinkProgressPostBody,
  ): Promise<ProgressPostLinksResponse["links"][number]> {
    await this.assertPostOwner(userId, input.postUnitId);
    let progress = await this.get(userId, unitId);
    if (!progress) {
      progress = await this.upsert(userId, unitId, {
        status: input.status ?? "BACKLOG",
      });
    }
    const row = await this.repository.upsertProgressPostLink({
      progressId: progress.id,
      postUnitId: input.postUnitId,
      status: input.status ?? progress.status,
      now: new Date(),
    });
    return mapProgressPostLinkToDTO(row);
  }

  async updatePostLink(
    userId: string,
    unitId: string,
    postUnitId: string,
    input: UpdateProgressPostLinkBody,
  ): Promise<ProgressPostLinksResponse["links"][number]> {
    const progress = await this.getOwnedProgress(userId, unitId);
    await this.assertPostOwner(userId, postUnitId);
    const row = await this.repository.updateProgressPostLinkStatus({
      progressId: progress.id,
      postUnitId,
      status: input.status,
      now: new Date(),
    });
    if (!row) throw new AppError(404, "Progress post link not found");
    return mapProgressPostLinkToDTO(row);
  }

  async unlinkPost(
    userId: string,
    unitId: string,
    postUnitId: string,
  ): Promise<void> {
    const progress = await this.getOwnedProgress(userId, unitId);
    await this.repository.deleteProgressPostLink(progress.id, postUnitId);
  }

  private async listRows(
    userId: string,
    query: ProgressListInput = {},
  ): Promise<ProgressPage> {
    const limit = Math.max(
      1,
      Math.min(Number(query.limit ?? DEFAULT_LIMIT), MAX_LIMIT),
    );
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const cursorDate = cursor ? new Date(cursor.lastSeenAt) : null;

    if (cursorDate && Number.isNaN(cursorDate.getTime())) {
      throw new AppError(400, "Invalid progress cursor");
    }

    const rows = await this.repository.listProgressRows({
      userId,
      cursorDate: cursorDate ?? null,
      cursorUnitId: cursor?.unitId ?? null,
      take: limit + 1,
    });

    const pageRows = rows.slice(0, limit);
    const last = pageRows.at(-1);
    const nextCursor =
      rows.length > limit && last
        ? encodeCursor({
            lastSeenAt: last.lastSeenAt.toISOString(),
            unitId: last.unitId,
          })
        : null;

    return { rows: pageRows, nextCursor };
  }

  async list(
    userId: string,
    query: ProgressListInput = {},
  ): Promise<UnitProgressListResponse> {
    const page = await this.listRows(userId, query);
    return {
      rows: page.rows.map(mapProgressToDTO),
      nextCursor: page.nextCursor,
    };
  }

  async listLibrary(
    userId: string,
    query: ProgressListInput = {},
  ): Promise<ProgressLibraryListResponse> {
    const page = await this.listRows(userId, query);
    if (page.rows.length === 0) {
      return { rows: [], nextCursor: null };
    }

    const unitIds = page.rows.map((row) => row.unitId);
    const unitIdSet = new Set(unitIds);
    const shelfRows = await this.repository.findShelfLinks(userId, unitIds);
    const shelvesByUnit = new Map<string, ProgressLibraryRow["shelves"]>();
    for (const shelfRow of shelfRows) {
      if (!unitIdSet.has(shelfRow.unitId)) continue;
      const link = {
        shelfId: shelfRow.shelfId,
        title: pickTitle(shelfRow.shelf.unit, query) || shelfRow.shelfId,
      };
      const shelves = shelvesByUnit.get(shelfRow.unitId) ?? [];
      shelves.push(link);
      shelvesByUnit.set(shelfRow.unitId, shelves);
    }

    return {
      rows: page.rows.flatMap((row): ProgressLibraryRow[] => {
        const unit = row.unit;
        if (!unit) return [];
        const lastReadNode =
          "lastReadNode" in row
            ? (row.lastReadNode as { isDeleted?: boolean } | null)
            : null;
        const lastReadNodeId =
          lastReadNode && !lastReadNode.isDeleted ? row.lastReadNodeId : null;

        return [
          {
            progress: mapProgressToDTO(row),
            progressUnit: unitSummary(row.unitId, unit, query),
            mainUnitContext:
              unit.catalogEntryKind === "VARIANT" &&
              unit.targetUnitId &&
              unit.targetUnit
                ? unitSummary(unit.targetUnitId, unit.targetUnit, query)
                : null,
            // Progress rows are anchored to the exact unit the user touched.
            // Even when that unit is a VARIANT, resume routes keep that id.
            // 进度行锚定到用户实际操作的那个 unit。
            // 即使该 unit 是 VARIANT，恢复阅读的路由仍保留该 id。
            resumeRoute:
              unit.type === "BOOK"
                ? lastReadNodeId
                  ? { kind: "node", bookId: row.unitId, nodeId: lastReadNodeId }
                  : { kind: "book", bookId: row.unitId }
                : undefined,
            shelves: shelvesByUnit.get(row.unitId) ?? [],
          },
        ];
      }),
      nextCursor: page.nextCursor,
    };
  }

  async continueReading(
    userId: string,
    query: ContinueReadingListQuery = {},
  ): Promise<ContinueReadingListResponse> {
    const limit = Math.max(
      1,
      Math.min(Number(query.limit ?? CONTINUE_READING_LIMIT), MAX_LIMIT),
    );
    const rows = await this.repository.listContinueReading({
      userId,
      take: limit,
    });

    if (rows.length === 0) return { items: [] };

    const bookIds = rows.map((row) => row.unitId);
    const [totalByBook, completedRows] = await Promise.all([
      this.repository.countChaptersTotal(bookIds),
      this.repository.listCompletedChapterOwnerUnitIds(userId, bookIds),
    ]);
    const completedByBook = new Map<string, number>();
    for (const ownerUnitId of completedRows) {
      completedByBook.set(
        ownerUnitId,
        (completedByBook.get(ownerUnitId) ?? 0) + 1,
      );
    }

    return {
      items: rows.map((row): ContinueReadingItem => {
        const nodeAlive = row.lastReadNode && !row.lastReadNode.isDeleted;
        return {
          bookUnitId: row.unitId,
          bookTitle: pickTitle(row.unit, query),
          bookCoverUrl: pickCover(row.unit, query),
          lastReadNodeId: row.lastReadNodeId,
          lastReadNodeTitle: nodeAlive
            ? (row.lastReadNode?.title ?? null)
            : null,
          lastReadAnchorText: pickAnchorText(row.lastReadAnchor),
          chaptersCompleted: completedByBook.get(row.unitId) ?? 0,
          chaptersTotal: totalByBook.get(row.unitId) ?? 0,
          resumeRoute:
            nodeAlive && row.lastReadNodeId
              ? { kind: "node", bookId: row.unitId, nodeId: row.lastReadNodeId }
              : { kind: "book", bookId: row.unitId },
        };
      }),
    };
  }

  async delete(userId: string, unitId: string): Promise<void> {
    await this.repository.softDeleteProgress(userId, unitId, new Date());

    await enqueueProgressSearch(
      SEARCH_COMMAND_KINDS.progressRemove,
      userId,
      unitId,
    );
  }

  async toggleNodeCompletion(
    userId: string,
    bookUnitId: string,
    nodeId: string,
    isCompleted: boolean,
  ): Promise<void> {
    const node = await this.repository.findContentNode(nodeId);
    if (!node) {
      throw new AppError(404, "Content structure node not found", {
        code: "content_structure_node_not_found",
      });
    }
    if (node.ownerUnitId !== bookUnitId) {
      throw new AppError(
        422,
        "Node does not belong to the specified book Unit",
        { code: "content_structure_node_cross_book" },
      );
    }
    if (node.isDeleted) {
      throw new AppError(409, "Cannot mark a deleted node as completed", {
        code: "content_structure_node_deleted",
      });
    }

    if (isCompleted) {
      await this.repository.upsertNodeCompletion(userId, nodeId);
    } else {
      await this.repository.deleteNodeCompletion(userId, nodeId);
    }
  }

  async progressStats(unitId: string): Promise<UnitProgressStatsResponse> {
    const response = await searchClient.progressIndex.search("", {
      filter: [`unitId = "${unitId}"`],
      facets: ["status", "progressBucket"],
      limit: 0,
    });
    const facets = response.facetDistribution ?? {};
    const statusFacet = facets.status as Record<string, number> | undefined;
    const bucketFacet = facets.progressBucket as
      | Record<string, number>
      | undefined;
    const statusCounts = Object.fromEntries(
      userUnitProgressStatusValues.map((status) => [
        status,
        readFacetCount(statusFacet, status),
      ]),
    ) as UnitProgressStatsResponse["statusCounts"];
    const bucketCounts = Array.from(
      { length: PROGRESS_BUCKET_COUNT },
      (_, bucket) => readFacetCount(bucketFacet, bucket),
    );

    return {
      viewerCount: response.estimatedTotalHits ?? response.hits.length,
      statusCounts,
      bucketCounts,
    };
  }
}

export const progressService = new ProgressService();
