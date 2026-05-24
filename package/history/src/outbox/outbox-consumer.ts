import { PrismaPg } from "@prisma/adapter-pg";
import {
  type EditorialRevisionPayload,
  type HistoryOutboxPayload,
  HistoryOutboxPayloadKind,
} from "@rezics/contract";

type HistoryOutboxRow = {
  id: string;
  unitId: string;
  sequence: bigint | number;
  actorUserId: string;
  category: string;
  payload: unknown;
  payloadHash: string | null;
  attempts: number;
  createdAt: Date;
};

type MainOutboxDb = {
  historyOutbox: {
    findMany(input: unknown): Promise<HistoryOutboxRow[]>;
    update(input: unknown): Promise<HistoryOutboxRow>;
    updateMany(input: unknown): Promise<{ count: number }>;
  };
};

type HistoryFailureDb = {
  outboxProcessingFailure: {
    upsert(input: unknown): Promise<unknown>;
  };
};

type RevisionWriter = {
  insertUnitRevision(input: {
    payload: EditorialRevisionPayload | LegacyEditorialRevisionPayload;
    contentHash: string;
    createdAt?: Date;
  }): Promise<unknown>;
  insertStructureEvent(input: {
    payload: Extract<
      HistoryOutboxPayload,
      { kind: typeof HistoryOutboxPayloadKind.STRUCTURE_EVENT }
    >["event"];
    createdAt?: Date;
  }): Promise<unknown>;
};

type LegacyEditorialRevisionPayload = Omit<
  EditorialRevisionPayload,
  "patch" | "legacyChangedKeys"
> & {
  changedFieldKeys: string[];
  slots: Record<string, unknown>;
};

export type OutboxConsumerResult = {
  claimed: number;
  processed: number;
  failed: number;
};

export type OutboxConsumerOptions = {
  batchSize?: number;
  now?: Date;
  consumerId?: string | null;
};

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

function hashPayload(value: unknown): string {
  return new Bun.CryptoHasher("sha256")
    .update(canonicalSerialize(value))
    .digest("hex");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function retryAfter(attempts: number, now: Date): Date {
  const delaySeconds = Math.min(60 * 60, 2 ** Math.max(0, attempts - 1) * 30);
  return new Date(now.getTime() + delaySeconds * 1000);
}

function asPayload(row: HistoryOutboxRow): HistoryOutboxPayload {
  return row.payload as HistoryOutboxPayload;
}

function editorialContent(
  revision: EditorialRevisionPayload | LegacyEditorialRevisionPayload,
) {
  return "patch" in revision ? revision.patch : revision.slots;
}

export class HistoryOutboxConsumer {
  constructor(
    private readonly mainDb: MainOutboxDb,
    private readonly historyDb: HistoryFailureDb,
    private readonly revisions: RevisionWriter,
  ) {}

  async consumeBatch(
    options: OutboxConsumerOptions = {},
  ): Promise<OutboxConsumerResult> {
    const now = options.now ?? new Date();
    const rows = await this.claimRows({
      batchSize: options.batchSize ?? 25,
      now,
      consumerId: options.consumerId ?? null,
    });
    let processed = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        await this.processRow(row);
        await this.markProcessed(row.id);
        processed += 1;
      } catch (error) {
        await this.markFailed(row, error, now);
        failed += 1;
      }
    }

    return { claimed: rows.length, processed, failed };
  }

  async consumeOutboxId(
    outboxId: string,
    options: Omit<OutboxConsumerOptions, "batchSize"> = {},
  ): Promise<OutboxConsumerResult> {
    const now = options.now ?? new Date();
    const rows = await this.claimRows({
      batchSize: 1,
      now,
      consumerId: options.consumerId ?? null,
      outboxId,
    });
    let processed = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        await this.processRow(row);
        await this.markProcessed(row.id);
        processed += 1;
      } catch (error) {
        await this.markFailed(row, error, now);
        failed += 1;
      }
    }

    return { claimed: rows.length, processed, failed };
  }

  private async claimRows(input: {
    batchSize: number;
    now: Date;
    consumerId: string | null;
    outboxId?: string;
  }): Promise<HistoryOutboxRow[]> {
    const candidates = await this.mainDb.historyOutbox.findMany({
      where: {
        ...(input.outboxId ? { id: input.outboxId } : {}),
        status: { in: ["pending", "failed"] },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: input.now } }],
      },
      orderBy: { createdAt: "asc" },
      take: input.batchSize,
    });
    const claimed: HistoryOutboxRow[] = [];

    for (const row of candidates) {
      const result = await this.mainDb.historyOutbox.updateMany({
        where: {
          id: row.id,
          status: { in: ["pending", "failed"] },
          attempts: row.attempts,
        },
        data: {
          status: "processing",
          attempts: { increment: 1 },
          nextAttemptAt: null,
          lastError: null,
          ...(input.consumerId ? { processedById: input.consumerId } : {}),
        },
      });
      if (result.count !== 1) continue;

      claimed.push(
        await this.mainDb.historyOutbox.update({
          where: { id: row.id },
          data: {},
        }),
      );
    }

    return claimed;
  }

  private async processRow(row: HistoryOutboxRow): Promise<void> {
    const payload = asPayload(row);
    switch (payload.kind) {
      case HistoryOutboxPayloadKind.EDITORIAL_REVISION:
      case HistoryOutboxPayloadKind.LOCK_MUTATION:
      case HistoryOutboxPayloadKind.COLLABORATOR_MUTATION:
        await this.insertRevision(payload.revision, row);
        return;
      case HistoryOutboxPayloadKind.STRUCTURE_EVENT:
        await this.revisions.insertStructureEvent({
          payload: payload.event,
          createdAt: row.createdAt,
        });
        return;
    }
  }

  private async insertRevision(
    revision: EditorialRevisionPayload,
    row: HistoryOutboxRow,
  ): Promise<void> {
    await this.revisions.insertUnitRevision({
      payload: revision,
      contentHash: row.payloadHash ?? hashPayload(editorialContent(revision)),
      createdAt: row.createdAt,
    });
  }

  private async markProcessed(outboxId: string): Promise<void> {
    await this.mainDb.historyOutbox.update({
      where: { id: outboxId },
      data: {
        status: "processed",
        processedAt: new Date(),
        nextAttemptAt: null,
        lastError: null,
      },
    });
  }

  private async markFailed(
    row: HistoryOutboxRow,
    error: unknown,
    now: Date,
  ): Promise<void> {
    const attempts = row.attempts;
    const message = errorMessage(error);
    const retryAt = retryAfter(attempts, now);
    await this.mainDb.historyOutbox.update({
      where: { id: row.id },
      data: {
        status: "failed",
        lastError: message,
        nextAttemptAt: retryAt,
      },
    });
    await this.historyDb.outboxProcessingFailure.upsert({
      where: { outboxId: row.id },
      update: {
        attempts,
        lastError: message,
        retryAfter: retryAt,
      },
      create: {
        outboxId: row.id,
        attempts,
        lastError: message,
        retryAfter: retryAt,
      },
    });
  }
}

export async function createDefaultHistoryOutboxConsumer() {
  const { env } = await import("../env");

  const [
    { PrismaClient: MainPrismaClient },
    { prisma: historyPrisma },
    { revisionService: defaultRevisionService },
  ] = await Promise.all([
    import("@rezics/server/prisma/generated/client"),
    import("../../prisma/client"),
    import("../revision/revision.service"),
  ]);
  const mainPrisma = new MainPrismaClient({
    adapter: new PrismaPg({
      connectionString: env.SERVER_DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 2_000,
    }),
  });

  return new HistoryOutboxConsumer(
    mainPrisma as unknown as MainOutboxDb,
    historyPrisma as unknown as HistoryFailureDb,
    defaultRevisionService,
  );
}
