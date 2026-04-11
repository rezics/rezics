import type { AdminStatsResponse } from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { searchClient } from "@/meili/search-client";

export class StatsService {
  async getStats(): Promise<AdminStatsResponse> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      users,
      books,
      posts,
      unresolvedFeedback,
      meiliHealthy,
      bookTrend,
      postTrend,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.book.count(),
      prisma.post.count(),
      prisma.feedback.count({ where: { resolved: false } }),
      this.checkMeiliHealth(),
      prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT date_trunc('day', "createdAt")::date AS date, COUNT(*)::bigint AS count
        FROM "Book"
        WHERE "createdAt" >= ${thirtyDaysAgo}
        GROUP BY date
        ORDER BY date ASC
      `,
      prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT date_trunc('day', "createdAt")::date AS date, COUNT(*)::bigint AS count
        FROM "Post"
        WHERE "createdAt" >= ${thirtyDaysAgo}
        GROUP BY date
        ORDER BY date ASC
      `,
    ]);

    const contentTrend = this.buildContentTrend(
      thirtyDaysAgo,
      bookTrend,
      postTrend,
    );

    return {
      counts: { users, books, comments: posts, unresolvedFeedback },
      health: {
        server: "ok",
        meili: meiliHealthy ? "ok" : "unreachable",
      },
      contentTrend,
    };
  }

  private async checkMeiliHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const healthy = await searchClient.checkHealth();
      clearTimeout(timeout);
      return healthy;
    } catch {
      return false;
    }
  }

  private buildContentTrend(
    startDate: Date,
    bookTrend: { date: Date; count: bigint }[],
    postTrend: { date: Date; count: bigint }[],
  ): AdminStatsResponse["contentTrend"] {
    const bookMap = new Map(
      bookTrend.map((r) => [
        r.date.toISOString().slice(0, 10),
        Number(r.count),
      ]),
    );
    const postMap = new Map(
      postTrend.map((r) => [
        r.date.toISOString().slice(0, 10),
        Number(r.count),
      ]),
    );

    const result: AdminStatsResponse["contentTrend"] = [];
    const current = new Date(startDate);
    const today = new Date();

    while (current <= today) {
      const dateStr = current.toISOString().slice(0, 10);
      result.push({
        date: dateStr,
        books: bookMap.get(dateStr) ?? 0,
        comments: postMap.get(dateStr) ?? 0,
      });
      current.setDate(current.getDate() + 1);
    }

    return result;
  }
}

export const statsService = new StatsService();
