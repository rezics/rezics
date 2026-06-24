import type {
  CreateUnitFieldLockInput,
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

  upsertFieldLock(unitId: string, input: CreateUnitFieldLockInput) {
    return apiFetch<UnitFieldLockDTO>(
      `/unit/${encodePathPart(unitId)}/field-locks/${encodePathPart(input.path)}`,
      {
        method: "PUT",
        body: JSON.stringify({ reason: input.reason ?? null }),
      },
    );
  },

  removeFieldLock(unitId: string, path: string) {
    return apiFetch<{ message: string }>(
      `/unit/${encodePathPart(unitId)}/field-locks/${encodePathPart(path)}`,
      { method: "DELETE" },
    );
  },

  retryFailedHistoryOutbox(input: { unitId?: string }) {
    return apiFetch<{ retried: number }>("/admin/history-outbox/retry-failed", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};
