import type {
  EditorialRevisionPayload,
  StructureEventDTO,
  StructureEventPayload,
  StructureEventTimelinePage,
  UnitRevisionDTO,
  UnitRevisionTimelinePage,
} from "@rezics/contract";

type HistoryDb = {
  revisionContent: {
    upsert(input: unknown): Promise<unknown>;
  };
  unitRevision: {
    upsert(input: unknown): Promise<unknown>;
    findMany(input: unknown): Promise<unknown[]>;
    findUnique(input: unknown): Promise<unknown | null>;
  };
  structureEvent: {
    upsert(input: unknown): Promise<unknown>;
    findMany(input: unknown): Promise<unknown[]>;
    findUnique(input: unknown): Promise<unknown | null>;
  };
};

let defaultDbPromise: Promise<HistoryDb> | null = null;

async function getDefaultDb(): Promise<HistoryDb> {
  defaultDbPromise ??= import("#/prisma/client").then(
    ({ prisma }) => prisma as unknown as HistoryDb,
  );
  return defaultDbPromise;
}

function mapRevision(
  row: {
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
  },
  options: { includeContent?: boolean } = {},
): UnitRevisionDTO {
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
    content:
      options.includeContent && row.content
        ? {
            hash: row.content.hash,
            payload: row.content.payload as Record<string, unknown>,
            createdAt: row.content.createdAt,
          }
        : undefined,
  };
}

function mapStructureEvent(
  row: {
    id: string;
    unitId: string;
    sequence: bigint;
    eventType: string;
    actorUserId: string;
    changedFieldKeys: string[];
    payload: unknown;
    message: string | null;
    createdAt: Date;
    ingestedAt: Date;
  },
  options: { includePayload?: boolean } = {},
): StructureEventDTO {
  return {
    id: row.id,
    unitId: row.unitId,
    sequence: Number(row.sequence),
    eventType: row.eventType,
    actorUserId: row.actorUserId,
    changedFieldKeys:
      row.changedFieldKeys as StructureEventDTO["changedFieldKeys"],
    payload: options.includePayload
      ? (row.payload as Record<string, unknown>)
      : undefined,
    message: row.message,
    createdAt: row.createdAt,
    ingestedAt: row.ingestedAt,
  };
}

function canonicalSerialize(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalSerialize(item)).join(",")}]`;
  }
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([key, nested]) => `${JSON.stringify(key)}:${canonicalSerialize(nested)}`,
    )
    .join(",")}}`;
}

export function computeRevisionContentHash(slots: unknown): string {
  return new Bun.CryptoHasher("sha256")
    .update(canonicalSerialize(slots))
    .digest("hex");
}

export class RevisionService {
  constructor(private readonly db?: HistoryDb) {}

  private database(): Promise<HistoryDb> {
    return this.db ? Promise.resolve(this.db) : getDefaultDb();
  }

  async upsertRevisionContent(input: {
    hash: string;
    payload: unknown;
  }): Promise<void> {
    const db = await this.database();
    await db.revisionContent.upsert({
      where: { hash: input.hash },
      update: {},
      create: { hash: input.hash, payload: input.payload as never },
    });
  }

  async insertUnitRevision(input: {
    payload: EditorialRevisionPayload;
    contentHash?: string | null;
    createdAt?: Date;
  }): Promise<UnitRevisionDTO> {
    const db = await this.database();
    const contentHash = computeRevisionContentHash(input.payload.slots);
    await this.upsertRevisionContent({
      hash: contentHash,
      payload: input.payload.slots,
    });
    const row = await db.unitRevision.upsert({
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
        contentHash,
        actorUserId: input.payload.actorUserId,
        changedFieldKeys: input.payload.changedFieldKeys,
        message: input.payload.message ?? null,
        createdAt: input.createdAt ?? new Date(),
      },
      include: { content: true },
    });
    return mapRevision(row as Parameters<typeof mapRevision>[0], {
      includeContent: true,
    });
  }

  async insertStructureEvent(input: {
    payload: StructureEventPayload;
    createdAt?: Date;
  }): Promise<void> {
    const db = await this.database();
    await db.structureEvent.upsert({
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
    includeContent?: boolean;
  }): Promise<UnitRevisionTimelinePage> {
    const db = await this.database();
    const limit = Math.max(1, Math.min(input.limit ?? 20, 100));
    const rows = await db.unitRevision.findMany({
      where: { unitId: input.unitId },
      orderBy: { sequence: "desc" },
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      include: input.includeContent ? { content: true } : undefined,
    });

    const pageRows = rows.slice(0, limit);
    const next =
      rows.length > limit
        ? (rows[limit] as { id?: string } | undefined)?.id
        : null;
    return {
      revisions: pageRows.map((row) =>
        mapRevision(row as Parameters<typeof mapRevision>[0], {
          includeContent: input.includeContent,
        }),
      ),
      nextCursor: next ?? null,
    };
  }

  async getUnitRevision(input: {
    unitId: string;
    sequence: number;
    includeContent?: boolean;
  }): Promise<UnitRevisionDTO | null> {
    const db = await this.database();
    const row = await db.unitRevision.findUnique({
      where: {
        unitId_sequence: {
          unitId: input.unitId,
          sequence: BigInt(input.sequence),
        },
      },
      include: input.includeContent === false ? undefined : { content: true },
    });
    return row
      ? mapRevision(row as Parameters<typeof mapRevision>[0], {
          includeContent: input.includeContent !== false,
        })
      : null;
  }

  async listStructureEvents(input: {
    unitId: string;
    limit?: number;
    cursor?: string | null;
    eventType?: string | null;
    includePayload?: boolean;
  }): Promise<StructureEventTimelinePage> {
    const db = await this.database();
    const limit = Math.max(1, Math.min(input.limit ?? 50, 100));
    const rows = await db.structureEvent.findMany({
      where: {
        unitId: input.unitId,
        ...(input.eventType ? { eventType: input.eventType } : {}),
      },
      orderBy: { sequence: "desc" },
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });

    const pageRows = rows.slice(0, limit);
    const next =
      rows.length > limit
        ? (rows[limit] as { id?: string } | undefined)?.id
        : null;
    return {
      events: pageRows.map((row) =>
        mapStructureEvent(row as Parameters<typeof mapStructureEvent>[0], {
          includePayload: input.includePayload,
        }),
      ),
      nextCursor: next ?? null,
    };
  }

  async getStructureEvent(input: {
    unitId: string;
    sequence: number;
    eventType: string;
    includePayload?: boolean;
  }): Promise<StructureEventDTO | null> {
    const db = await this.database();
    const row = await db.structureEvent.findUnique({
      where: {
        unitId_sequence_eventType: {
          unitId: input.unitId,
          sequence: BigInt(input.sequence),
          eventType: input.eventType,
        },
      },
    });
    return row
      ? mapStructureEvent(row as Parameters<typeof mapStructureEvent>[0], {
          includePayload: input.includePayload !== false,
        })
      : null;
  }
}

export const revisionService = new RevisionService();
