import {
  AttributionFieldKey,
  BookFieldKey,
  EntityFieldKey,
  HistoryOutboxPayloadKind,
  type RezicsSessionClaims,
  UnitCommonFieldKey,
  type UnitFieldKey,
} from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { UnitAuthorityError, assertCanEditUnitFields } from "./authority";
import {
  buildEditorialRevisionPayload,
  type HistoryOutboxWriter,
  writeSequencedHistoryOutbox,
} from "./history-outbox";
import { AppError } from "@/utils/errors";

export type CollaborativeMetadataTx = HistoryOutboxWriter & {
  unit: {
    findUniqueOrThrow(input: {
      where: { id: string };
      select: { id: true; userId: true };
    }): Promise<{ id: string; userId: string | null }>;
  };
  unitCollaborator: {
    findUnique(input: unknown): Promise<{ roleKey: string } | null>;
  };
  unitFieldLock: {
    findMany(input: unknown): Promise<Array<{ fieldKey: string }>>;
  };
  unitTranslation: {
    findMany(input: unknown): Promise<unknown[]>;
  };
  book: {
    findUnique(input: unknown): Promise<unknown>;
  };
  entity: {
    findUnique(input: unknown): Promise<unknown>;
  };
  creditAttribution: {
    findMany(input: unknown): Promise<unknown[]>;
  };
  subjectAttribution: {
    findMany(input: unknown): Promise<unknown[]>;
  };
  unitTag: {
    findMany(input: unknown): Promise<unknown[]>;
  };
};

const COLLABORATIVE_METADATA_POLICY = { collaborative: true } as const;

export function toAppError(error: unknown): never {
  if (error instanceof UnitAuthorityError) {
    throw new AppError(403, error.message, {
      code: error.code,
      details: {
        unitId: error.unitId,
        blockedFieldKeys: error.blockedFieldKeys,
      },
    });
  }
  throw error;
}

export async function assertCanEditCollaborativeMetadata(
  tx: CollaborativeMetadataTx,
  actor: RezicsSessionClaims,
  unitId: string,
  changedFieldKeys: readonly UnitFieldKey[],
  options: { verifyAdmin?: (userId: string) => Promise<boolean> } = {},
): Promise<void> {
  const unit = await tx.unit.findUniqueOrThrow({
    where: { id: unitId },
    select: { id: true, userId: true },
  });

  try {
    await assertCanEditUnitFields(
      actor,
      unit,
      changedFieldKeys,
      COLLABORATIVE_METADATA_POLICY,
      { prismaClient: tx as any, verifyAdmin: options.verifyAdmin },
    );
  } catch (error) {
    toAppError(error);
  }
}

export function uniqueFieldKeys(
  fieldKeys: readonly (UnitFieldKey | undefined)[],
): UnitFieldKey[] {
  return [...new Set(fieldKeys.filter(Boolean) as UnitFieldKey[])];
}

export function mapTranslationFieldKeys(input: {
  title?: unknown;
  subtitle?: unknown;
  summary?: unknown;
  description?: unknown;
  extra?: unknown;
  sourceReleaseUnitId?: unknown;
}): UnitFieldKey[] {
  return uniqueFieldKeys([
    input.title !== undefined ? UnitCommonFieldKey.TITLE : undefined,
    input.subtitle !== undefined ? UnitCommonFieldKey.SUBTITLE : undefined,
    input.summary !== undefined ? UnitCommonFieldKey.SUMMARY : undefined,
    input.description !== undefined
      ? UnitCommonFieldKey.DESCRIPTION
      : undefined,
    input.extra !== undefined ? UnitCommonFieldKey.EXTRA : undefined,
    input.sourceReleaseUnitId !== undefined
      ? UnitCommonFieldKey.WORK
      : undefined,
  ]);
}

export function creditRoleFieldKey(role: string): UnitFieldKey {
  const normalized = role.toLowerCase();
  if (normalized.includes("publisher")) {
    return AttributionFieldKey.CREDITS_PUBLISHERS;
  }
  if (normalized.includes("translator")) {
    return AttributionFieldKey.CREDITS_TRANSLATORS;
  }
  if (normalized.includes("illustrator")) {
    return AttributionFieldKey.CREDITS_ILLUSTRATORS;
  }
  return AttributionFieldKey.CREDITS_AUTHORS;
}

export async function writeEditorialMetadataHistory(
  tx: CollaborativeMetadataTx,
  input: {
    unitId: string;
    actorUserId: string;
    changedFieldKeys: readonly UnitFieldKey[];
    message: string;
    slots?: Record<string, unknown>;
  },
): Promise<void> {
  const baseSlots = await loadEditorialSlots(tx, input.unitId);
  const changedFieldKeys = uniqueFieldKeys(input.changedFieldKeys);

  await writeSequencedHistoryOutbox(tx, {
    unitId: input.unitId,
    actorUserId: input.actorUserId,
    buildPayload: (sequence) => ({
      kind: HistoryOutboxPayloadKind.EDITORIAL_REVISION,
      revision: buildEditorialRevisionPayload({
        unitId: input.unitId,
        sequence,
        actorUserId: input.actorUserId,
        changedFieldKeys,
        slots: { ...baseSlots, ...(input.slots ?? {}) },
        message: input.message,
      }),
    }),
  });
}

async function loadEditorialSlots(
  tx: CollaborativeMetadataTx,
  unitId: string,
): Promise<Record<string, unknown>> {
  const [translations, book, entity, credits, subjects, tags] =
    await Promise.all([
      tx.unitTranslation.findMany({
        where: { unitId },
        orderBy: { language: "asc" },
      }),
      tx.book.findUnique({ where: { unitId } }),
      tx.entity.findUnique({ where: { unitId } }),
      tx.creditAttribution.findMany({
        where: { unitId },
        orderBy: [{ role: "asc" }, { sortOrder: "asc" }],
      }),
      tx.subjectAttribution.findMany({
        where: { unitId },
        orderBy: [{ role: "asc" }, { sortOrder: "asc" }],
      }),
      tx.unitTag.findMany({
        where: { unitId },
        orderBy: [
          { pinned: "desc" },
          { position: "asc" },
          { tagUnitId: "asc" },
        ],
      }),
    ]);

  return {
    translations,
    extension: (book ?? entity ?? null) as Prisma.JsonValue | null,
    credits,
    subjects,
    tags,
  };
}
