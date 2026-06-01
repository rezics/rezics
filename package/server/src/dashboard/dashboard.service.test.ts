import { describe, expect, mock, test } from "bun:test";
import { dashboardSummarySchema } from "@rezics/contract";
import { Value } from "@sinclair/typebox/value";

const mockProgressRows = [
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
    unit: {
      unitId: "book-1",
      title: "Book One",
      unitType: "BOOK",
    },
    resumeRoute: { kind: "book", bookId: "book-1" },
    shelves: [],
  },
];

const mockListLibrary = mock(async () => ({
  rows: mockProgressRows,
  nextCursor: "next-page",
}));

mock.module("#/prisma/client", () => ({
  prisma: {
    userUnitProgress: { findMany: mock(async () => []) },
    contentStructureNode: { groupBy: mock(async () => []) },
    userContentNodeProgress: { findMany: mock(async () => []) },
    shelf: { findMany: mock(async () => []) },
    realmMember: { findMany: mock(async () => []) },
  },
}));

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

    const summary = await dashboardService.summary("user-1");

    expect(summary.libraryProgress).toEqual({ ok: mockProgressRows });
    expect(Value.Check(dashboardSummarySchema, summary)).toBe(true);
  });
});
