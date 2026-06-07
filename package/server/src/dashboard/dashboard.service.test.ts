import { describe, expect, mock, test } from "bun:test";
import {
  dashboardSummarySchema,
  type ProgressLibraryRow,
} from "@rezics/contract";
import { Value } from "@sinclair/typebox/value";
import type { DashboardRepository } from "./dashboard.service";

const mockProgressRows: ProgressLibraryRow[] = [
  {
    progress: {
      userId: "user-1",
      unitId: "book-1",
      progress: 0.5,
      status: "ACTIVE",
      isDeleted: false,
      completedCount: 0,
      totalTimeMs: 0,
      lastReadNodeId: null,
      lastReadAnchor: null,
      firstSeenAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-02T00:00:00.000Z",
      extra: null,
    },
    progressUnit: {
      unitId: "book-1",
      title: "Book One",
      unitType: "BOOK",
      catalogEntryKind: "MAIN",
      targetUnitId: null,
    },
    mainUnitContext: null,
    resumeRoute: { kind: "book", bookId: "book-1" },
    shelves: [],
  },
];

const mockListLibrary = mock(async () => ({
  rows: mockProgressRows,
  nextCursor: "next-page",
}));

const emptyDashboardRepository = {
  listContinueReading: mock(async () => []),
  countChaptersTotal: mock(async () => new Map()),
  listCompletedChapterOwnerUnitIds: mock(async () => []),
  listShelves: mock(async () => []),
  listRealms: mock(async () => []),
} satisfies DashboardRepository;

mock.module("@/governance/enforcement.service", () => ({
  governanceEnforcementService: {
    activeSummary: mock(async () => ({ activeKinds: [] })),
  },
}));

mock.module("@/progress", () => ({
  progressService: {
    listLibrary: mockListLibrary,
  },
}));

describe("dashboardService", () => {
  test("unwraps progress library pages into dashboard section rows", async () => {
    const { dashboardService } = await import("./dashboard.service");
    dashboardService.repository = emptyDashboardRepository;

    const summary = await dashboardService.summary("user-1");

    expect(summary.libraryProgress).toEqual({ ok: mockProgressRows });
    expect(Value.Check(dashboardSummarySchema, summary)).toBe(true);
  });

  test("uses app locale before default language for dashboard-owned titles", async () => {
    const { dashboardService } = await import("./dashboard.service");
    const localizedUnit = {
      defaultLanguage: "zh-hant",
      translations: [
        { language: "zh-hant", title: "中文標題" },
        { language: "en", title: "English Title" },
      ],
    };
    const repository = {
      listContinueReading: mock(async () => [
        {
          unitId: "book-1",
          lastReadNodeId: null,
          lastReadAnchor: null,
          unit: localizedUnit,
          lastReadNode: null,
        },
      ]),
      countChaptersTotal: mock(async () => new Map([["book-1", 3]])),
      listCompletedChapterOwnerUnitIds: mock(async () => ["book-1"]),
      listShelves: mock(async () => [
        { unitId: "shelf-1", itemCount: 2, unit: localizedUnit },
      ]),
      listRealms: mock(async () => [
        {
          realmUnitId: "realm-1",
          unit: { ...localizedUnit, slug: "realm-one" },
        },
      ]),
    } satisfies DashboardRepository;
    mockListLibrary.mockClear();
    dashboardService.repository = repository;

    const summary = await dashboardService.summary("user-1", {
      appLocale: "en",
      languages: ["zh-hant"],
    });

    expect(summary.continueReading).toMatchObject({
      ok: [{ bookTitle: "English Title" }],
    });
    expect(summary.shelves).toMatchObject({
      ok: [{ title: "English Title" }],
    });
    expect(summary.realms).toMatchObject({
      ok: [{ name: "English Title" }],
    });
    expect(mockListLibrary.mock.calls[0]?.[1]).toMatchObject({
      appLocale: "en",
      languages: "zh-hant",
    });
  });
});
