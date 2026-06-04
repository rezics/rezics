import {
  type ContinueReadingItem,
  type DashboardSafety,
  type DashboardSummary,
  readCoverUrlFromExtra,
} from "@rezics/contract";
import { and, count, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { governanceEnforcementService } from "@/governance/enforcement.service";
import { progressService } from "@/progress";
import {
  ContentStructureNode,
  RealmMember,
  Shelf,
  Unit,
  UnitTranslation,
  UserContentNodeProgress,
  UserUnitProgress,
} from "../db/schema";
import { notAggregated, section } from "./dashboard.types";

const CONTINUE_READING_LIMIT = 12;
const SHELF_LIMIT = 12;
const REALM_LIMIT = 12;
const ANCHOR_PREVIEW_MAX = 200;

type TranslationRow = {
  language: string;
  title: string | null;
  extra?: unknown;
};

type UnitDisplay = {
  defaultLanguage: string | null;
  translations: TranslationRow[];
};

type ContinueReadingRow = {
  unitId: string;
  lastReadNodeId: string | null;
  lastReadAnchor: unknown;
  unit: UnitDisplay;
  lastReadNode: {
    id: string;
    title: string;
    isDeleted: boolean;
  } | null;
};

type ShelfRow = {
  unitId: string;
  itemCount: number;
  unit: UnitDisplay;
};

type RealmRow = {
  realmUnitId: string;
  unit: UnitDisplay & {
    slug: string | null;
  };
};

export interface DashboardRepository {
  listContinueReading(
    userId: string,
    limit: number,
  ): Promise<ContinueReadingRow[]>;
  countChaptersTotal(bookIds: string[]): Promise<Map<string, number>>;
  listCompletedChapterOwnerUnitIds(
    userId: string,
    bookIds: string[],
  ): Promise<string[]>;
  listShelves(userId: string, limit: number): Promise<ShelfRow[]>;
  listRealms(userId: string, limit: number): Promise<RealmRow[]>;
}

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

async function loadTranslations(
  unitIds: readonly string[],
): Promise<Map<string, TranslationRow[]>> {
  if (unitIds.length === 0) return new Map();
  const db = await getServerDb();
  const rows = await db
    .select({
      unitId: UnitTranslation.unitId,
      language: UnitTranslation.language,
      title: UnitTranslation.title,
      extra: UnitTranslation.extra,
    })
    .from(UnitTranslation)
    .where(inArray(UnitTranslation.unitId, [...unitIds]));
  const byUnit = new Map<string, TranslationRow[]>();
  for (const row of rows) {
    const list = byUnit.get(row.unitId) ?? [];
    list.push({ language: row.language, title: row.title, extra: row.extra });
    byUnit.set(row.unitId, list);
  }
  return byUnit;
}

function createDrizzleDashboardRepository(): DashboardRepository {
  return {
    async listContinueReading(userId, limit) {
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
        .limit(limit);
      const translations = await loadTranslations(
        rows.map((row) => row.unitId),
      );
      return rows.map((row) => ({
        unitId: row.unitId,
        lastReadNodeId: row.lastReadNodeId,
        lastReadAnchor: row.lastReadAnchor,
        unit: {
          defaultLanguage: row.defaultLanguage,
          translations: translations.get(row.unitId) ?? [],
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

    async listShelves(userId, limit) {
      const db = await getServerDb();
      const rows = await db
        .select({
          unitId: Shelf.unitId,
          itemCount: Shelf.itemCount,
          defaultLanguage: Unit.defaultLanguage,
        })
        .from(Shelf)
        .innerJoin(Unit, eq(Unit.id, Shelf.unitId))
        .where(eq(Unit.userId, userId))
        .orderBy(desc(Unit.updatedAt))
        .limit(limit);
      const translations = await loadTranslations(
        rows.map((row) => row.unitId),
      );
      return rows.map((row) => ({
        unitId: row.unitId,
        itemCount: row.itemCount,
        unit: {
          defaultLanguage: row.defaultLanguage,
          translations: translations.get(row.unitId) ?? [],
        },
      }));
    },

    async listRealms(userId, limit) {
      const db = await getServerDb();
      const rows = await db
        .select({
          realmUnitId: RealmMember.realmUnitId,
          slug: Unit.slug,
          defaultLanguage: Unit.defaultLanguage,
        })
        .from(RealmMember)
        .innerJoin(Unit, eq(Unit.id, RealmMember.realmUnitId))
        .where(
          and(eq(RealmMember.userId, userId), eq(RealmMember.state, "ACTIVE")),
        )
        .orderBy(desc(RealmMember.joinedAt))
        .limit(limit);
      const translations = await loadTranslations(
        rows.map((row) => row.realmUnitId),
      );
      return rows.map((row) => ({
        realmUnitId: row.realmUnitId,
        unit: {
          slug: row.slug,
          defaultLanguage: row.defaultLanguage,
          translations: translations.get(row.realmUnitId) ?? [],
        },
      }));
    },
  };
}

const defaultRepository = createDrizzleDashboardRepository();

/** Resolve a display title: default-language → en → first non-empty. */
function pickTitle(unit: UnitDisplay): string {
  const ordered = [
    unit.defaultLanguage
      ? unit.translations.find((t) => t.language === unit.defaultLanguage)
      : undefined,
    unit.translations.find((t) => t.language === "en"),
    ...unit.translations,
  ];
  for (const tr of ordered) {
    if (tr?.title) return tr.title;
  }
  return "";
}

/** Resolve a cover URL from translation extra, same order as title. */
function pickCover(unit: UnitDisplay): string | undefined {
  const ordered = [
    unit.defaultLanguage
      ? unit.translations.find((t) => t.language === unit.defaultLanguage)
      : undefined,
    unit.translations.find((t) => t.language === "en"),
    ...unit.translations,
  ];
  for (const tr of ordered) {
    const url = readCoverUrlFromExtra(tr?.extra);
    if (url) return url;
  }
  return undefined;
}

function pickAnchorText(anchor: unknown): string | undefined {
  if (anchor && typeof anchor === "object" && "text" in anchor) {
    const text = (anchor as { text?: unknown }).text;
    if (typeof text === "string" && text.length > 0) {
      return text.slice(0, ANCHOR_PREVIEW_MAX);
    }
  }
  return undefined;
}

async function loadContinueReading(
  userId: string,
  repository: DashboardRepository = defaultRepository,
): Promise<ContinueReadingItem[]> {
  const rows = await repository.listContinueReading(
    userId,
    CONTINUE_READING_LIMIT,
  );

  if (rows.length === 0) return [];

  const bookIds = rows.map((row) => row.unitId);

  // chaptersTotal: non-deleted content nodes that carry a content Unit.
  const totalByBook = await repository.countChaptersTotal(bookIds);

  // chaptersCompleted: per-node completions for this user within these books.
  const completedRows = await repository.listCompletedChapterOwnerUnitIds(
    userId,
    bookIds,
  );
  const completedByBook = new Map<string, number>();
  for (const ownerUnitId of completedRows) {
    completedByBook.set(
      ownerUnitId,
      (completedByBook.get(ownerUnitId) ?? 0) + 1,
    );
  }

  return rows.map((row): ContinueReadingItem => {
    const nodeAlive = row.lastReadNode && !row.lastReadNode.isDeleted;
    return {
      bookUnitId: row.unitId,
      bookTitle: pickTitle(row.unit),
      bookCoverUrl: pickCover(row.unit),
      lastReadNodeId: row.lastReadNodeId,
      lastReadNodeTitle: nodeAlive ? (row.lastReadNode?.title ?? null) : null,
      lastReadAnchorText: pickAnchorText(row.lastReadAnchor),
      chaptersCompleted: completedByBook.get(row.unitId) ?? 0,
      chaptersTotal: totalByBook.get(row.unitId) ?? 0,
      resumeRoute:
        nodeAlive && row.lastReadNodeId
          ? { kind: "node", bookId: row.unitId, nodeId: row.lastReadNodeId }
          : { kind: "book", bookId: row.unitId },
    };
  });
}

async function loadShelves(
  userId: string,
  repository: DashboardRepository = defaultRepository,
) {
  const shelves = await repository.listShelves(userId, SHELF_LIMIT);
  return shelves.map((shelf) => ({
    shelfUnitId: shelf.unitId,
    title: pickTitle(shelf.unit),
    itemCount: shelf.itemCount,
    coverUrls: [] as string[],
  }));
}

async function loadRealms(
  userId: string,
  repository: DashboardRepository = defaultRepository,
) {
  const members = await repository.listRealms(userId, REALM_LIMIT);
  return members.map((member) => ({
    realmId: member.realmUnitId,
    name: pickTitle(member.unit),
    slug: member.unit.slug ?? undefined,
  }));
}

async function loadSafety(userId: string): Promise<DashboardSafety> {
  const summary = await governanceEnforcementService.activeSummary(userId);
  const blockingKinds = new Set(["ban", "block", "suspend"]);
  return {
    enforcementActive: summary.activeKinds.length > 0,
    accountBlocked: summary.activeKinds.some((kind) => blockingKinds.has(kind)),
    pendingReportsAgainstUser: 0,
    notices: summary.activeKinds.map((kind) => ({
      code: kind,
      message: kind,
    })),
  };
}

export const dashboardService = {
  repository: defaultRepository,

  /**
   * Fan out to server-owned domains, tolerating per-section failure. The
   * notify-service sections (notifications, dms) and per-type drafts/activity
   * are reported as `NOT_AGGREGATED`; the client fetches those through their
   * dedicated hooks rather than scattering them here.
   */
  async summary(userId: string): Promise<DashboardSummary> {
    const [continueReading, shelves, realms, safety] = await Promise.all([
      section(() => loadContinueReading(userId, this.repository)),
      section(() => loadShelves(userId, this.repository)),
      section(() => loadRealms(userId, this.repository)),
      section(() => loadSafety(userId)),
    ]);
    // Progress library rows are progress-owned; shelf links are optional
    // projections for sharing/organization, not the source of truth.
    const libraryProgress = await section(async () => {
      const page = await progressService.listLibrary(userId, {
        limit: CONTINUE_READING_LIMIT,
      });
      return page.rows;
    });

    return {
      continueReading,
      libraryProgress,
      shelves,
      realms,
      safety,
      notifications: notAggregated(),
      dms: notAggregated(),
      drafts: notAggregated(),
      activity: notAggregated(),
    };
  },
};
