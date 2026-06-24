import { sql } from "drizzle-orm";
import type { ServerDb } from "./client";

export type ServerMaintenanceRepository = {
  repairSeriesContentIndex(
    seriesUnitId: string,
  ): Promise<{ indexedReleaseCount: number; skipped?: string }>;
};

type ReleaseNodeRow = {
  id: string;
  contentUnitId: string;
};

export function createServerMaintenanceRepository(
  database: ServerDb,
): ServerMaintenanceRepository {
  return {
    async repairSeriesContentIndex(seriesUnitId) {
      const series = await database.execute<{ unitId: string }>(
        sql`select "unitId" from "Series" where "unitId" = ${seriesUnitId} limit 1`,
      );
      if (series.rows.length === 0) {
        return { indexedReleaseCount: 0, skipped: "not_series" };
      }

      const releaseNodes = await database.execute<ReleaseNodeRow>(sql`
        select node."id", node."contentUnitId"
        from "ContentStructureNode" node
        inner join "Unit" content_unit on content_unit."id" = node."contentUnitId"
        where node."ownerUnitId" = ${seriesUnitId}
          and content_unit."type" in ('BOOK', 'GAME', 'MEDIA')
        order by node."position" asc, node."id" asc
      `);

      await database.execute(
        sql`delete from "SeriesContentIndex" where "seriesUnitId" = ${seriesUnitId}`,
      );

      const rows = releaseNodes.rows as ReleaseNodeRow[];
      if (rows.length > 0) {
        const tuples = rows.map(
          (node: ReleaseNodeRow) =>
            sql`(${seriesUnitId}, ${node.contentUnitId}, ${node.id}, now(), now())`,
        );
        await database.execute(sql`
          insert into "SeriesContentIndex"
            ("seriesUnitId", "releaseUnitId", "contentNodeId", "createdAt", "updatedAt")
          values ${sql.join(tuples, sql`, `)}
          on conflict do nothing
        `);
      }

      return { indexedReleaseCount: rows.length };
    },
  };
}
