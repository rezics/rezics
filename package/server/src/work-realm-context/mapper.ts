import type {
  ResolvedWorkRealmContext,
  WorkRealmContextConflict,
  WorkRealmContextDTO,
  WorkRealmContextRole,
} from "@rezics/contract";
import type { WorkRealmContext } from "#/prisma/client";

export function mapWorkRealmContextToDTO(
  row: WorkRealmContext,
): WorkRealmContextDTO {
  return {
    id: row.id,
    workUnitId: row.workUnitId,
    realmUnitId: row.realmUnitId,
    role: row.role as WorkRealmContextRole,
    priority: row.priority,
    locale: row.locale as WorkRealmContextDTO["locale"],
    releaseUnitId: row.releaseUnitId,
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapWorkRealmContextConflict(
  input: Omit<WorkRealmContextConflict, "code">,
): WorkRealmContextConflict {
  return {
    code: "WORK_REALM_CONTEXT_CONFLICT",
    ...input,
  };
}

export function mapResolvedWorkRealmContext(input: {
  releaseUnitId: string;
  workUnitId: string | null;
  contexts: WorkRealmContext[];
  conflicts: WorkRealmContextConflict[];
}): ResolvedWorkRealmContext {
  const official = input.contexts.find(
    (context) => context.role === "official",
  );

  return {
    releaseUnitId: input.releaseUnitId,
    workUnitId: input.workUnitId,
    official: official ? mapWorkRealmContextToDTO(official) : null,
    community: input.contexts
      .filter((context) => context.role === "community")
      .map(mapWorkRealmContextToDTO),
    language: input.contexts
      .filter((context) => context.role === "language")
      .map(mapWorkRealmContextToDTO),
    archive: input.contexts
      .filter((context) => context.role === "archive")
      .map(mapWorkRealmContextToDTO),
    conflicts: input.conflicts,
  };
}
