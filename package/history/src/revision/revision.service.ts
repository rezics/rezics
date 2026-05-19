import type {
  EditorialRevisionPayload,
  StructureEventPayload,
  UnitRevisionDTO,
  UnitRevisionTimelinePage,
} from "@rezics/contract";
import { prisma } from "#/prisma/client";

type HistoryDb = Pick<
  typeof prisma,
  "revisionContent" | "unitRevision" | "structureEvent"
>;

function mapRevision(row: {
  id: string;
  unitId: string;
  sequence: bigint;
  contentHash: string;
  actorUserId: string;
  changedFieldKeys: string[];
  message: string | null;
  createdAt: Date;
  ingestedAt: Date;
  content?: { hash: string; payload: unknown; createdAt: Date } | null;
}): UnitRevisionDTO {
  return {
    id: row.id,
    unitId: row.unitId,
    sequence: Number(row.sequence),
    contentHash: row.contentHash,
    actorUserId: row.actorUserId,
    changedFieldKeys:
      row.changedFieldKeys as UnitRevisionDTO["changedFieldKeys"],
    message: row.message,
    createdAt: row.createdAt,
    ingestedAt: row.ingestedAt,
    content: row.content
      ? {
          hash: row.content.hash,
          payload: row.content.payload as Record<string, unknown>,
          createdAt: row.content.createdAt,
        }
      : undefined,
  };
}

export class RevisionService {
  constructor(private readonly db: HistoryDb = prisma) {}

  async upsertRevisionContent(input: {
    hash: string;
    payload: unknown;
  }): Promise<void> {
    await this.db.revisionContent.upsert({
      where: { hash: input.hash },
      update: {},
      create: { hash: input.hash, payload: input.payload as never },
    });
  }

  async insertUnitRevision(input: {
    payload: EditorialRevisionPayload;
    contentHash: string;
    createdAt?: Date;
  }): Promise<UnitRevisionDTO> {
    await this.upsertRevisionContent({
      hash: input.contentHash,
      payload: input.payload.slots,
    });
    const row = await this.db.unitRevision.upsert({
      where: {
        unitId_sequence: {
          unitId: input.payload.unitId,
          sequence: BigInt(input.payload.sequence),
        },
      },
      update: {},
      create: {
        unitId: input.payload.unitId,
        sequence: BigInt(input.payload.sequence),
        contentHash: input.contentHash,
        actorUserId: input.payload.actorUserId,
        changedFieldKeys: input.payload.changedFieldKeys,
        message: input.payload.message ?? null,
        createdAt: input.createdAt ?? new Date(),
      },
      include: { content: true },
    });
    return mapRevision(row);
  }

  async insertStructureEvent(input: {
    payload: StructureEventPayload;
    createdAt?: Date;
  }): Promise<void> {
    await this.db.structureEvent.upsert({
      where: {
        unitId_sequence_eventType: {
          unitId: input.payload.unitId,
          sequence: BigInt(input.payload.sequence),
          eventType: input.payload.eventType,
        },
      },
      update: {},
      create: {
        unitId: input.payload.unitId,
        sequence: BigInt(input.payload.sequence),
        eventType: input.payload.eventType,
        actorUserId: input.payload.actorUserId,
        changedFieldKeys: input.payload.changedFieldKeys,
        payload: input.payload.payload as never,
        message: input.payload.message ?? null,
        createdAt: input.createdAt ?? new Date(),
      },
    });
  }

  async listUnitRevisions(input: {
    unitId: string;
    limit?: number;
    cursor?: string | null;
  }): Promise<UnitRevisionTimelinePage> {
    const limit = Math.max(1, Math.min(input.limit ?? 20, 100));
    const rows = await this.db.unitRevision.findMany({
      where: { unitId: input.unitId },
      orderBy: { sequence: "desc" },
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      include: { content: true },
    });

    const pageRows = rows.slice(0, limit);
    const next = rows.length > limit ? rows[limit]?.id : null;
    return {
      revisions: pageRows.map(mapRevision),
      nextCursor: next ?? null,
    };
  }

  async getUnitRevision(input: {
    unitId: string;
    sequence: number;
  }): Promise<UnitRevisionDTO | null> {
    const row = await this.db.unitRevision.findUnique({
      where: {
        unitId_sequence: {
          unitId: input.unitId,
          sequence: BigInt(input.sequence),
        },
      },
      include: { content: true },
    });
    return row ? mapRevision(row) : null;
  }
}

export const revisionService = new RevisionService();
