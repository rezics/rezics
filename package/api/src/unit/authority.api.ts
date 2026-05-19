import type {
  CreateUnitFieldLockInput,
  LockFieldKey,
  UnitCollaboratorDTO,
  UnitCollaboratorListResponse,
  UnitFieldLockDTO,
  UnitFieldLockListResponse,
  UpsertUnitCollaboratorInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

const encodePathPart = (value: string) => encodeURIComponent(value);

export const unitAuthorityApi = {
  listCollaborators(unitId: string) {
    return apiFetch<UnitCollaboratorListResponse>(
      `/unit/${encodePathPart(unitId)}/collaborators`,
    );
  },

  upsertCollaborator(unitId: string, input: UpsertUnitCollaboratorInput) {
    return apiFetch<UnitCollaboratorDTO>(
      `/unit/${encodePathPart(unitId)}/collaborators/${encodePathPart(input.userId)}`,
      {
        method: "PUT",
        body: JSON.stringify({ roleKey: input.roleKey }),
      },
    );
  },

  removeCollaborator(unitId: string, userId: string) {
    return apiFetch<{ message: string }>(
      `/unit/${encodePathPart(unitId)}/collaborators/${encodePathPart(userId)}`,
      { method: "DELETE" },
    );
  },

  listFieldLocks(unitId: string) {
    return apiFetch<UnitFieldLockListResponse>(
      `/unit/${encodePathPart(unitId)}/field-locks`,
    );
  },

  upsertFieldLock(
    unitId: string,
    input: CreateUnitFieldLockInput & { fieldKey: LockFieldKey },
  ) {
    return apiFetch<UnitFieldLockDTO>(
      `/unit/${encodePathPart(unitId)}/field-locks/${encodePathPart(input.fieldKey)}`,
      {
        method: "PUT",
        body: JSON.stringify({ reason: input.reason ?? null }),
      },
    );
  },

  removeFieldLock(unitId: string, fieldKey: LockFieldKey) {
    return apiFetch<{ message: string }>(
      `/unit/${encodePathPart(unitId)}/field-locks/${encodePathPart(fieldKey)}`,
      { method: "DELETE" },
    );
  },
};
