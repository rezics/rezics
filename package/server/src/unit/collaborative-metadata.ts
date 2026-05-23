import {
  HistoryOutboxPayloadKind,
  isExternallyGoverned,
  type RezicsSessionClaims,
} from "@rezics/contract";
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
  input: {
    title?: unknown;
    subtitle?: unknown;
    summary?: unknown;
    description?: unknown;
    extra?: unknown;
    sourceReleaseUnitId?: unknown;
  },
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
  input: {
    title?: unknown;
    subtitle?: unknown;
    summary?: unknown;
    description?: unknown;
    extra?: unknown;
    sourceReleaseUnitId?: unknown;
  },
): Record<string, unknown> {
  return {
    translations: {
      [language]: Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      ),
    },
  };
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
    const nestedPaths = collectPatchLeafPaths(nested, nextPrefix);
    paths.push(...(nestedPaths.length > 0 ? nestedPaths : [nextPrefix]));
  }
  return uniquePatchPaths(paths);
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
      }),
    }),
  });
}
