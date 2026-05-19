import type {
  EditorialRevisionPayload,
  HistoryOutboxPayload,
  StructureEventPayload,
  UnitFieldKey,
} from "@rezics/contract";

type SequenceRow = { sequence: bigint | number | string };

export interface HistoryOutboxWriter {
  $queryRaw<T = unknown>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
  historyOutbox: {
    create(input: {
      data: {
        unitId: string;
        sequence: bigint;
        actorUserId: string;
        category: string;
        payload: unknown;
        payloadHash?: string;
      };
    }): Promise<unknown>;
  };
}

export async function allocateUnitHistorySequence(
  tx: Pick<HistoryOutboxWriter, "$queryRaw">,
  unitId: string,
): Promise<bigint> {
  const rows = await tx.$queryRaw<SequenceRow[]>`
    INSERT INTO "UnitHistoryClock" ("unitId", "nextSequence", "updatedAt")
    VALUES (${unitId}, 2, now())
    ON CONFLICT ("unitId")
    DO UPDATE SET
      "nextSequence" = "UnitHistoryClock"."nextSequence" + 1,
      "updatedAt" = now()
    RETURNING "nextSequence" - 1 AS sequence
  `;
  const sequence = rows[0]?.sequence;
  if (sequence === undefined) {
    throw new Error(`Failed to allocate history sequence for Unit ${unitId}`);
  }
  return BigInt(sequence);
}

function normalizeForCanonicalJson(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(normalizeForCanonicalJson);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, normalizeForCanonicalJson(nested)]),
  );
}

export function canonicalSerialize(value: unknown): string {
  return JSON.stringify(normalizeForCanonicalJson(value));
}

export function hashCanonicalPayload(value: unknown): string {
  return new Bun.CryptoHasher("sha256")
    .update(canonicalSerialize(value))
    .digest("hex");
}

export function buildEditorialRevisionPayload(input: {
  unitId: string;
  sequence: bigint | number;
  actorUserId: string;
  changedFieldKeys: readonly UnitFieldKey[];
  slots: EditorialRevisionPayload["slots"];
  message?: string | null;
}): EditorialRevisionPayload {
  return {
    unitId: input.unitId,
    sequence: Number(input.sequence),
    actorUserId: input.actorUserId,
    changedFieldKeys: [...input.changedFieldKeys],
    slots: input.slots,
    message: input.message ?? null,
  };
}

export function buildStructureEventPayload(input: {
  unitId: string;
  sequence: bigint | number;
  actorUserId: string;
  eventType: string;
  changedFieldKeys: readonly UnitFieldKey[];
  payload: Record<string, unknown>;
  message?: string | null;
}): StructureEventPayload {
  return {
    unitId: input.unitId,
    sequence: Number(input.sequence),
    actorUserId: input.actorUserId,
    eventType: input.eventType,
    changedFieldKeys: [...input.changedFieldKeys],
    payload: input.payload,
    message: input.message ?? null,
  };
}

export async function writeHistoryOutbox(
  tx: HistoryOutboxWriter,
  input: {
    unitId: string;
    actorUserId: string;
    payload: HistoryOutboxPayload;
  },
): Promise<{ sequence: bigint; payloadHash: string }> {
  const sequence = await allocateUnitHistorySequence(tx, input.unitId);
  const payloadHash = hashCanonicalPayload(input.payload);
  await tx.historyOutbox.create({
    data: {
      unitId: input.unitId,
      sequence,
      actorUserId: input.actorUserId,
      category: input.payload.kind,
      payload: input.payload,
      payloadHash,
    },
  });
  return { sequence, payloadHash };
}
