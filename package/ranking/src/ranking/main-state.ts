import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient as ServerPrismaClient } from "@rezics/server/prisma/generated/client";

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
  readonly prisma: ServerPrismaClient;

  constructor(options: MainStateReaderOptions) {
    this.prisma = new ServerPrismaClient({
      adapter: new PrismaPg({
        connectionString: options.serverDatabaseUrl,
        max: 20,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 2_000,
      }),
    });
  }

  async readUnitState(unitId: string): Promise<UnitRankingState> {
    const [unit, post, comment, scoreAggregate, progressCount, realms] =
      await Promise.all([
        this.prisma.unit.findUnique({
          where: { id: unitId },
          select: {
            id: true,
            type: true,
            status: true,
            visibility: true,
            createdAt: true,
            updatedAt: true,
            publishedAt: true,
          },
        }),
        this.prisma.post.findUnique({
          where: { unitId },
          select: {
            unitId: true,
            rootPostUnitId: true,
            parentPostUnitId: true,
            replyCount: true,
            directReplyCount: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.prisma.comment.findUnique({
          where: { unitId },
          select: {
            unitId: true,
            rootUnitId: true,
            realmUnitId: true,
            parentCommentUnitId: true,
            replyCount: true,
            directReplyCount: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.prisma.scoreAggregate.findFirst({
          where: { unitId },
          orderBy: { updatedAt: "desc" },
        }),
        this.prisma.userUnitProgress.count({
          where: { unitId, isDeleted: false },
        }),
        this.prisma.unitRealm.findMany({
          where: { unitId },
          select: { realmUnitId: true },
        }),
      ]);

    return {
      unit,
      post,
      comment,
      scoreAggregate,
      progressCount,
      realms: realms.map((realm: { realmUnitId: string }) => realm.realmUnitId),
    };
  }

  async fullSyncSegment(
    cursor: string | undefined,
    limit: number,
  ): Promise<FullSyncSegment> {
    const rows = await this.prisma.unit.findMany({
      where: {
        status: "PUBLISHED",
        visibility: "PUBLIC",
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
    });
    const current = rows.slice(0, limit);
    const last = current.at(-1);
    return {
      unitIds: current.map((row: { id: string }) => row.id),
      ...(rows.length > limit && last ? { nextCursor: last.id } : {}),
    };
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }
}
