import {
  collectEditorialPatchLeafPaths,
  HistoryOutboxPayloadKind,
  type HistoryRestoreSource,
  isExternallyGoverned,
  type RezicsSessionClaims,
} from "@rezics/contract";
import { AppError } from "@/utils/errors";
import { assertCanEditUnitFields, UnitAuthorityError } from "./authority";
import {
  buildEditorialRevisionPayload,
  type HistoryOutboxWriter,
  writeSequencedHistoryOutbox,
} from "./history-outbox";

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
    findMany(input: unknown): Promise<Array<{ path: string }>>;
  };
};

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
      { prismaClient: tx as any, verifyAdmin: options.verifyAdmin },
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
    input.sourceReleaseUnitId !== undefined
      ? `${prefix}.sourceReleaseUnitId`
      : undefined,
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
  sourceReleaseUnitId?: unknown;
};

export type PreviousTranslationState = {
  title?: string | null;
  subtitle?: string | null;
  summary?: string | null;
  description?: unknown;
  extra?: unknown;
  sourceReleaseUnitId?: string | null;
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
    hasOwn(input, "sourceReleaseUnitId") &&
    (input.sourceReleaseUnitId ?? null) !==
      (previous.sourceReleaseUnitId ?? null)
      ? `${prefix}.sourceReleaseUnitId`
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
        ? "/realm-tag-applications"
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
  if (collectPatchLeafPaths(input.patch).length === 0) return;

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
