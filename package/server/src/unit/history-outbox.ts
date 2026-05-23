import type {
  EditorialRevisionPayload,
  HistoryOutboxPayload,
  StructureEventPayload,
} from "@rezics/contract";
import { isExternallyGoverned } from "@rezics/contract";

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
        payload: any;
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
  patch: EditorialRevisionPayload["patch"];
  message?: string | null;
  restoreSource?: EditorialRevisionPayload["restoreSource"];
}): EditorialRevisionPayload {
  return {
    unitId: input.unitId,
    sequence: Number(input.sequence),
    actorUserId: input.actorUserId,
    patch: input.patch,
    message: input.message ?? null,
    restoreSource: input.restoreSource,
  };
}

export function buildStructureEventPayload(input: {
  unitId: string;
  sequence: bigint | number;
  actorUserId: string;
  eventType: string;
  changedFieldKeys: readonly string[];
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

function collectLeafPaths(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  const paths: string[] = [];
  for (const [key, nested] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (key === "$unset") {
      if (Array.isArray(nested)) {
        paths.push(
          ...nested.filter((path): path is string => typeof path === "string"),
        );
      }
      continue;
    }
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    const nestedPaths = collectLeafPaths(nested, nextPrefix);
    paths.push(...(nestedPaths.length > 0 ? nestedPaths : [nextPrefix]));
  }
  return [...new Set(paths)];
}

function stripExternallyGovernedPatch(
  patch: Record<string, unknown>,
): Record<string, unknown> | null {
  const leafPaths = collectLeafPaths(patch);
  if (leafPaths.length === 0) return patch;
  if (leafPaths.every((path) => isExternallyGoverned(path))) {
    return null;
  }
  return patch;
}

export async function writeHistoryOutbox(
  tx: HistoryOutboxWriter,
  input: {
    unitId: string;
    actorUserId: string;
    payload: HistoryOutboxPayload;
  },
): Promise<{ sequence: bigint; payloadHash: string }> {
  return writeSequencedHistoryOutbox(tx, {
    unitId: input.unitId,
    actorUserId: input.actorUserId,
    buildPayload: () => input.payload,
  });
}

export async function writeSequencedHistoryOutbox(
  tx: HistoryOutboxWriter,
  input: {
    unitId: string;
    actorUserId: string;
    buildPayload: (sequence: bigint) => HistoryOutboxPayload;
  },
): Promise<{ sequence: bigint; payloadHash: string }> {
  const sequence = await allocateUnitHistorySequence(tx, input.unitId);
  const payload = input.buildPayload(sequence);
  if ("revision" in payload) {
    const patch = stripExternallyGovernedPatch(payload.revision.patch);
    if (!patch) {
      return { sequence, payloadHash: hashCanonicalPayload({}) };
    }
  }
  const payloadHash =
    "revision" in payload
      ? hashCanonicalPayload(payload.revision.patch)
      : hashCanonicalPayload(payload);
  await tx.historyOutbox.create({
    data: {
      unitId: input.unitId,
      sequence,
      actorUserId: input.actorUserId,
      category: payload.kind,
      payload,
      payloadHash,
    },
  });
  return { sequence, payloadHash };
}
