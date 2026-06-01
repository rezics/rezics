import {
  type ContinueReadingItem,
  type DashboardSafety,
  type DashboardSummary,
  readCoverUrlFromExtra,
} from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { governanceEnforcementService } from "@/governance/enforcement.service";
import { progressService } from "@/progress";
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
): Promise<ContinueReadingItem[]> {
  const rows = await prisma.userUnitProgress.findMany({
    where: { userId, isDeleted: false, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { lastSeenAt: "desc" },
    take: CONTINUE_READING_LIMIT,
    include: {
      unit: {
        select: {
          id: true,
          defaultLanguage: true,
          translations: {
            select: { language: true, title: true, extra: true },
          },
        },
      },
      lastReadNode: { select: { id: true, title: true, isDeleted: true } },
    },
  });

  if (rows.length === 0) return [];

  const bookIds = rows.map((row) => row.unitId);

  // chaptersTotal: non-deleted content nodes that carry a content Unit.
  const totals = await prisma.contentStructureNode.groupBy({
    by: ["ownerUnitId"],
    where: {
      ownerUnitId: { in: bookIds },
      isDeleted: false,
      contentUnitId: { not: null },
    },
    _count: { _all: true },
  });
  const totalByBook = new Map(
    totals.map((row) => [row.ownerUnitId, row._count._all]),
  );

  // chaptersCompleted: per-node completions for this user within these books.
  const completedRows = await prisma.userContentNodeProgress.findMany({
    where: { userId, node: { ownerUnitId: { in: bookIds }, isDeleted: false } },
    select: { node: { select: { ownerUnitId: true } } },
  });
  const completedByBook = new Map<string, number>();
  for (const row of completedRows) {
    const owner = row.node.ownerUnitId;
    completedByBook.set(owner, (completedByBook.get(owner) ?? 0) + 1);
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

async function loadShelves(userId: string) {
  const shelves = await prisma.shelf.findMany({
    where: { unit: { userId } },
    take: SHELF_LIMIT,
    orderBy: { unit: { updatedAt: "desc" } },
    select: {
      unitId: true,
      itemCount: true,
      unit: {
        select: {
          defaultLanguage: true,
          translations: { select: { language: true, title: true } },
        },
      },
    },
  });
  return shelves.map((shelf) => ({
    shelfUnitId: shelf.unitId,
    title: pickTitle(shelf.unit),
    itemCount: shelf.itemCount,
    coverUrls: [] as string[],
  }));
}

async function loadRealms(userId: string) {
  const members = await prisma.realmMember.findMany({
    where: { userId, state: "ACTIVE" },
    take: REALM_LIMIT,
    orderBy: { joinedAt: "desc" },
    select: {
      realmUnitId: true,
      realm: {
        select: {
          unit: {
            select: {
              slug: true,
              defaultLanguage: true,
              translations: { select: { language: true, title: true } },
            },
          },
        },
      },
    },
  });
  return members.map((member) => ({
    realmId: member.realmUnitId,
    name: pickTitle(member.realm.unit),
    slug: member.realm.unit.slug ?? undefined,
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
  /**
   * Fan out to server-owned domains, tolerating per-section failure. The
   * notify-service sections (notifications, dms) and per-type drafts/activity
   * are reported as `NOT_AGGREGATED`; the client fetches those through their
   * dedicated hooks rather than scattering them here.
   */
  async summary(userId: string): Promise<DashboardSummary> {
    const [continueReading, shelves, realms, safety] = await Promise.all([
      section(() => loadContinueReading(userId)),
      section(() => loadShelves(userId)),
      section(() => loadRealms(userId)),
      section(() => loadSafety(userId)),
    ]);
    // Progress library rows are progress-owned; shelf links are optional
    // projections for sharing/organization, not the source of truth.
    const libraryProgress = await section(() =>
      progressService.listLibrary(userId, { limit: CONTINUE_READING_LIMIT }),
    );

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
