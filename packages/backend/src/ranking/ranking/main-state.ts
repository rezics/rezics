import { createServerDb } from "../../../../server/src/db/factory";
import { sql } from "drizzle-orm";

export type MainStateReaderOptions = {
  serverDatabaseUrl: string;
};

export type UnitRankingState = {
  unit: any | null;
  post: any | null;
  comment: any | null;
  scoreAggregate: any | null;
  progressCount: number;
  realms: string[];
};

export type FullSyncSegment = {
  unitIds: string[];
  nextCursor?: string;
};

export class MainStateReader {
  private readonly serverDb: ReturnType<typeof createServerDb>;

  constructor(options: MainStateReaderOptions) {
    this.serverDb = createServerDb(options.serverDatabaseUrl);
  }

  async readUnitState(unitId: string): Promise<UnitRankingState> {
    const db = this.serverDb.db;
    const [unit, post, comment, scoreAggregate, progressRows, realmRows] =
      await Promise.all([
        db.execute(sql`
          select
            "id",
            "type",
            "status",
            "visibility",
            "moderationStatus",
            "catalogEntryKind",
            "createdAt",
            "updatedAt",
            "publishedAt"
          from "Unit"
          where "id" = ${unitId}
          limit 1
        `),
        db.execute(sql`
          select
            "unitId",
            "rootPostUnitId",
            "parentPostUnitId",
            "replyCount",
            "directReplyCount",
            "createdAt",
            "updatedAt"
          from "Post"
          where "unitId" = ${unitId}
          limit 1
        `),
        db.execute(sql`
          select
            "id",
            "id" as "unitId",
            "rootUnitId",
            "realmUnitId",
            "parentCommentId",
            "replyCount",
            "directReplyCount",
            "moderationStatus",
            "deletedAt",
            "createdAt",
            "updatedAt"
          from "Comment"
          where "id" = ${unitId}
          limit 1
        `),
        db.execute(sql`
          select *
          from "ScoreAggregate"
          where "unitId" = ${unitId}
          order by "updatedAt" desc
          limit 1
        `),
        db.execute<{ count: string | number | bigint }>(sql`
          select count(*) as count
          from "UserUnitProgress"
          where "unitId" = ${unitId}
            and "isDeleted" = false
        `),
        db.execute<{ realmUnitId: string }>(sql`
          select "realmUnitId"
          from "UnitRealm"
          where "unitId" = ${unitId}
        `),
      ]);

    const progressCountRaw = progressRows.rows[0]?.count ?? 0;

    return {
      unit: unit.rows[0] ?? null,
      post: post.rows[0] ?? null,
      comment: comment.rows[0] ?? null,
      scoreAggregate: scoreAggregate.rows[0] ?? null,
      progressCount: Number(progressCountRaw),
      realms: realmRows.rows.map((realm) => realm.realmUnitId),
    };
  }

  async fullSyncSegment(
    cursor: string | undefined,
    limit: number,
  ): Promise<FullSyncSegment> {
    const rows = await this.serverDb.db.execute<{ id: string }>(sql`
      select "id"
      from "Unit"
      where "status" = 'PUBLISHED'
        and "visibility" = 'PUBLIC'
        ${cursor ? sql`and "id" > ${cursor}` : sql``}
      order by "id" asc
      limit ${limit + 1}
    `);
    const current = rows.rows.slice(0, limit);
    const last = current.at(-1);
    return {
      unitIds: current.map((row) => row.id),
      ...(rows.rows.length > limit && last ? { nextCursor: last.id } : {}),
    };
  }

  async disconnect() {
    await this.serverDb.disconnect();
  }
}
