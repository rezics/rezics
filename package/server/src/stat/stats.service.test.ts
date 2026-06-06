import { describe, expect, mock, test } from "bun:test";
import type { AdminStatsResponse } from "@rezics/contract";

mock.module("@/diagnostic/system-status.service", () => ({
  getSystemStatusSummary: mock(async () => {
    throw new Error("not used");
  }),
}));

mock.module("@/meili/search-client", () => ({
  searchClient: {
    checkHealth: mock(async () => true),
  },
}));

type BuildContentTrend = (
  startDate: Date,
  bookTrend: { date: Date | string; count: bigint }[],
  postTrend: { date: Date | string; count: bigint }[],
) => AdminStatsResponse["contentTrend"];

describe("StatsService", () => {
  test("builds content trend from raw SQL date strings", async () => {
    const { StatsService } = await import("./stats.service");
    const service = new StatsService() as unknown as {
      buildContentTrend: BuildContentTrend;
    };
    const startDate = new Date();
    const date = startDate.toISOString().slice(0, 10);

    const trend = service.buildContentTrend(
      startDate,
      [{ date, count: 2n }],
      [{ date: new Date(`${date}T00:00:00.000Z`), count: 3n }],
    );

    expect(trend[0]).toEqual({ date, books: 2, comments: 3 });
  });
});
