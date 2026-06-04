import {
  collectEditorialPatchLeafPaths,
  HistoryOutboxPayloadKind,
  type HistoryRestoreSource,
  isExternallyGoverned,
  type RezicsSessionClaims,
} from "@rezics/contract";
import { eq, sql } from "drizzle-orm";
import {
  HistoryOutbox,
  StaffAuditLog,
  Unit,
  UnitCollaborator,
  UnitFieldLock,
} from "../db/schema";
import { AppError } from "../utils/errors";
import { assertCanEditUnitFields, UnitAuthorityError } from "./authority";
import {
  buildEditorialRevisionPayload,
  type HistoryOutboxWriter,
  writeSequencedHistoryOutbox,
} from "./history-outbox";

export type CollaborativeMetadataTx = HistoryOutboxWriter & {
  unit?: {
    findUniqueOrThrow(input: {
      where: { id: string };
      select: { id: true; userId: true };
    }): Promise<{ id: string; userId: string | null }>;
  };
  unitCollaborator: {
    findUnique(input: unknown): Promise<{ roleKey: string } | null>;
  };
  unitFieldLock: {
    findMany(input: unknown): Promise<Array<{ path: string }>>;
  };
  staffAuditLog?: {
    create(input: {
      data: {
        actorUserId: string;
        action: string;
        targetKind: string;
        targetId: string;
        decisionCode: string;
        reason: string;
        before?: unknown;
        after?: unknown;
        metadata?: unknown;
      };
    }): Promise<unknown>;
  };
};

type CollaborativeMetadataDrizzleTx = {
  execute(query: unknown): Promise<{ rows: unknown[] }>;
  select: typeof import("../db/client").db.select;
  insert: typeof import("../db/client").db.insert;
};

export function createDrizzleCollaborativeMetadataTx(
  tx: CollaborativeMetadataDrizzleTx,
): CollaborativeMetadataTx {
  return {
    async $queryRaw(_strings, ...values) {
      const [unitId] = values;
      const result = await tx.execute(sql`
        INSERT INTO "UnitHistoryClock" ("unitId", "nextSequence", "updatedAt")
        VALUES (${unitId}::uuid, 2, now())
        ON CONFLICT ("unitId")
        DO UPDATE SET
          "nextSequence" = "UnitHistoryClock"."nextSequence" + 1,
          "updatedAt" = now()
        RETURNING "nextSequence" - 1 AS sequence
      `);
      return result.rows as never;
    },
    historyOutbox: {
      async create(input) {
        await tx.insert(HistoryOutbox).values({
          unitId: input.data.unitId,
          sequence: Number(input.data.sequence),
          actorUserId: input.data.actorUserId,
          category: input.data.category,
          payload: input.data.payload,
          payloadHash: input.data.payloadHash,
          updatedAt: new Date(),
        });
      },
    },
    unit: {
      async findUniqueOrThrow(input) {
        const [unit] = await tx
          .select({ id: Unit.id, userId: Unit.userId })
          .from(Unit)
          .where(eq(Unit.id, input.where.id))
          .limit(1);
        if (!unit) throw new Error(`Unit not found: ${input.where.id}`);
        return unit;
      },
    },
    unitCollaborator: {
      async findUnique(input) {
        const { unitId, userId } = (
          input as {
            where: { unitId_userId: { unitId: string; userId: string } };
          }
        ).where.unitId_userId;
        const [collaborator] = await tx
          .select({ roleKey: UnitCollaborator.roleKey })
          .from(UnitCollaborator)
          .where(
            sql`${UnitCollaborator.unitId} = ${unitId}::uuid AND ${UnitCollaborator.userId} = ${userId}::uuid`,
          )
          .limit(1);
        return collaborator ?? null;
      },
    },
    unitFieldLock: {
      async findMany(input) {
        const unitId = (input as { where: { unitId: string } }).where.unitId;
        return tx
          .select({ path: UnitFieldLock.path })
          .from(UnitFieldLock)
          .where(eq(UnitFieldLock.unitId, unitId));
      },
    },
    staffAuditLog: {
      async create(input) {
        const data = input.data as typeof input.data & {
          before?: unknown;
          after?: unknown;
        };
        await tx.insert(StaffAuditLog).values({
          actorUserId: data.actorUserId,
          action: data.action,
          targetKind: data.targetKind,
          targetId: data.targetId,
          decisionCode: data.decisionCode,
          reason: data.reason,
          metadata: {
            ...(data.metadata && typeof data.metadata === "object"
              ? (data.metadata as Record<string, unknown>)
              : {}),
            ...(data.before === undefined ? {} : { before: data.before }),
            ...(data.after === undefined ? {} : { after: data.after }),
          },
        });
      },
    },
  };
}

const COLLABORATIVE_METADATA_POLICY = { collaborative: true } as const;

export function toAppError(error: unknown): never {
  if (error instanceof UnitAuthorityError) {
    throw new AppError(403, error.message, {
      code: error.code,
      details: {
        unitId: error.unitId,
        blockedPaths: error.blockedPaths,
        offendingLockPath: error.offendingLockPath,
        offendingPatchPath: error.offendingPatchPath,
      },
    });
  }
  throw error;
}

export async function assertCanEditCollaborativeMetadata(
  tx: CollaborativeMetadataTx,
  actor: RezicsSessionClaims,
  unitId: string,
  patchPaths: readonly string[],
  options: { verifyAdmin?: (userId: string) => Promise<boolean> } = {},
): Promise<void> {
  if (!tx.unit) {
    throw new Error("Collaborative metadata authority requires Unit access.");
  }
  const unit = await tx.unit.findUniqueOrThrow({
    where: { id: unitId },
    select: { id: true, userId: true },
  });

  try {
    await assertCanEditUnitFields(
      actor,
      unit,
      patchPaths,
      COLLABORATIVE_METADATA_POLICY,
      {
        lookup: {
          async findCollaboratorRole(unitId, userId) {
            const collaborator = await tx.unitCollaborator.findUnique({
              where: { unitId_userId: { unitId, userId } },
              select: { roleKey: true },
            });
            return collaborator?.roleKey ?? null;
          },
          async listFieldLockPaths(unitId) {
            const locks = await tx.unitFieldLock.findMany({
              where: { unitId },
              select: { path: true },
            });
            return locks.map((lock) => lock.path);
          },
        },
        verifyAdmin: options.verifyAdmin,
      },
    );
  } catch (error) {
    toAppError(error);
  }
}

export function uniquePatchPaths(
  paths: readonly (string | undefined)[],
): string[] {
  return [...new Set(paths.filter(Boolean) as string[])];
}

export function mapTranslationPatchPaths(
  input: TranslationPatchInput,
  language?: string,
): string[] {
  const prefix = language ? `translations.${language}` : "translations";
  return uniquePatchPaths([
    input.title !== undefined ? `${prefix}.title` : undefined,
    input.subtitle !== undefined ? `${prefix}.subtitle` : undefined,
    input.summary !== undefined ? `${prefix}.summary` : undefined,
    input.description !== undefined ? `${prefix}.description` : undefined,
    input.extra !== undefined ? `${prefix}.extra` : undefined,
    input.sourceUnitId !== undefined ? `${prefix}.sourceUnitId` : undefined,
  ]);
}

export function translationPatch(
  language: string,
  input: TranslationPatchInput,
): Record<string, unknown> {
  return {
    translations: {
      [language]: Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      ),
    },
  };
}

export type TranslationPatchInput = {
  title?: unknown;
  subtitle?: unknown;
  summary?: unknown;
  description?: unknown;
  extra?: unknown;
  sourceUnitId?: unknown;
};

export type PreviousTranslationState = {
  title?: string | null;
  subtitle?: string | null;
  summary?: string | null;
  description?: unknown;
  extra?: unknown;
  sourceUnitId?: string | null;
};

export function mapActualTranslationPatchPaths(
  input: TranslationPatchInput,
  previous: PreviousTranslationState | null,
  language: string,
): string[] {
  if (!previous) {
    return mapTranslationPatchPaths(input, language);
  }

  const prefix = `translations.${language}`;
  return uniquePatchPaths([
    changedNullableString(input, previous, "title")
      ? `${prefix}.title`
      : undefined,
    changedNullableString(input, previous, "subtitle")
      ? `${prefix}.subtitle`
      : undefined,
    changedNullableString(input, previous, "summary")
      ? `${prefix}.summary`
      : undefined,
    hasOwn(input, "description") &&
    !sameJson(input.description ?? null, previous.description)
      ? `${prefix}.description`
      : undefined,
    hasOwn(input, "extra") && !sameJson(input.extra ?? null, previous.extra)
      ? `${prefix}.extra`
      : undefined,
    hasOwn(input, "sourceUnitId") &&
    (input.sourceUnitId ?? null) !== (previous.sourceUnitId ?? null)
      ? `${prefix}.sourceUnitId`
      : undefined,
  ]);
}

export function translationPatchFromPaths(
  language: string,
  input: TranslationPatchInput,
  paths: readonly string[],
): Record<string, unknown> {
  const prefix = `translations.${language}.`;
  const fields = new Set(
    paths
      .filter((path) => path.startsWith(prefix))
      .map((path) => path.slice(prefix.length).split(".")[0]),
  );
  return translationPatch(
    language,
    Object.fromEntries(
      Object.entries(input).filter(
        ([key, value]) => value !== undefined && fields.has(key),
      ),
    ),
  );
}

export function creditRolePatchPath(role: string): string {
  const normalized = role.toLowerCase();
  if (normalized.includes("publisher")) {
    return "credits.publishers";
  }
  if (normalized.includes("translator")) {
    return "credits.translators";
  }
  if (normalized.includes("illustrator")) {
    return "credits.illustrators";
  }
  return "credits.authors";
}

export function collectPatchLeafPaths(value: unknown, prefix = ""): string[] {
  if (!prefix) {
    return uniquePatchPaths(collectEditorialPatchLeafPaths(value));
  }
  const nested = collectEditorialPatchLeafPaths(value).map(
    (path) => `${prefix}.${path}`,
  );
  return nested.length > 0 ? uniquePatchPaths(nested) : [prefix];
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function hasOwn<T extends object>(
  input: T,
  key: PropertyKey,
): key is keyof T {
  return Object.hasOwn(input, key);
}

export function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function changedNullableString(
  input: TranslationPatchInput,
  previous: PreviousTranslationState,
  key: "title" | "subtitle" | "summary",
): boolean {
  return hasOwn(input, key) && (input[key] ?? null) !== (previous[key] ?? null);
}

function cloneJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneJsonValue);
  if (!isPlainRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, cloneJsonValue(nested)]),
  );
}

function unsetPath(target: Record<string, unknown>, path: string): void {
  const segments = path.split(".").filter(Boolean);
  if (segments.length === 0) return;

  let cursor: Record<string, unknown> = target;
  for (const segment of segments.slice(0, -1)) {
    const next = cursor[segment];
    if (!isPlainRecord(next)) return;
    cursor = next;
  }

  delete cursor[segments[segments.length - 1] as string];
}

export function applySparsePatch<T = unknown>(current: T, patch: unknown): T {
  if (!isPlainRecord(patch)) {
    return cloneJsonValue(patch) as T;
  }

  const base = isPlainRecord(current)
    ? (cloneJsonValue(current) as Record<string, unknown>)
    : {};

  for (const [key, value] of Object.entries(patch)) {
    if (key === "$unset") continue;
    base[key] = isPlainRecord(value)
      ? applySparsePatch(base[key], value)
      : cloneJsonValue(value);
  }

  const unset = patch.$unset;
  if (Array.isArray(unset)) {
    for (const path of unset) {
      if (typeof path === "string") unsetPath(base, path);
    }
  }

  return base as T;
}

export function assertEditorialPatchAllowed(patch: Record<string, unknown>) {
  const offendingPath = collectPatchLeafPaths(patch).find((path) =>
    isExternallyGoverned(path),
  );
  if (!offendingPath) return;

  throw new AppError(400, "Path is externally governed", {
    code: "EXTERNALLY_GOVERNED_PATH",
    details: {
      offendingPath,
      useApi: offendingPath.startsWith("realmTagApplications")
        ? "/realm-tag-application"
        : "/tags",
    },
  });
}

export async function writeEditorialMetadataHistory(
  tx: CollaborativeMetadataTx,
  input: {
    unitId: string;
    actorUserId: string;
    patch: Record<string, unknown>;
    message: string;
    restoreSource?: HistoryRestoreSource;
  },
): Promise<void> {
  assertEditorialPatchAllowed(input.patch);
  const patchPaths = collectPatchLeafPaths(input.patch);
  if (patchPaths.length === 0) return;

  const isCreationMessage = input.message.endsWith(".create");
  if (!isCreationMessage && tx.unit && tx.staffAuditLog) {
    const unit = await tx.unit.findUniqueOrThrow({
      where: { id: input.unitId },
      select: { id: true, userId: true },
    });
    if (unit.userId && unit.userId !== input.actorUserId) {
      await tx.staffAuditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "content.editorial.cross_owner_update",
          targetKind: "unit",
          targetId: input.unitId,
          decisionCode: "ALLOWED",
          reason: input.message,
          before: {
            ownerUserId: unit.userId,
            patchPaths,
          },
          after: {
            patch: input.patch,
          },
          metadata: {
            message: input.message,
            ...(input.restoreSource
              ? { restoreSource: input.restoreSource }
              : {}),
          },
        },
      });
    }
  }

  await writeSequencedHistoryOutbox(tx, {
    unitId: input.unitId,
    actorUserId: input.actorUserId,
    buildPayload: (sequence) => ({
      kind: HistoryOutboxPayloadKind.EDITORIAL_REVISION,
      revision: buildEditorialRevisionPayload({
        unitId: input.unitId,
        sequence,
        actorUserId: input.actorUserId,
        patch: input.patch,
        message: input.message,
        restoreSource: input.restoreSource,
      }),
    }),
  });
}
