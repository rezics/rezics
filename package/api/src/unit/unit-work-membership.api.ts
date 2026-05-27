import type {
  UnitWorkMembershipBody,
  WorkMembershipClaimDTO,
  WorkMembershipClaimListResponse,
  WorkMembershipClaimRejectBody,
  UnitWorkMembershipResponse,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const unitWorkMembershipApi = {
  /**
   * `PATCH /unit/:releaseId/work-membership` — set or clear the release's
   * UnitWork membership. Returns LINKED / PENDING / UNLINKED depending on authority and
   * wiki short-circuit.
   */
  patchMembership: async (
    releaseId: string,
    body: UnitWorkMembershipBody,
  ): Promise<UnitWorkMembershipResponse> => {
    return apiFetch<UnitWorkMembershipResponse>(
      `/unit/${releaseId}/work-membership`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
    );
  },

  /**
   * `GET /unit/:workUnitId/work-membership-claims` — work-side claim inbox.
   */
  listClaims: async (
    workUnitId: string,
    status?: WorkMembershipClaimDTO["status"],
  ): Promise<WorkMembershipClaimListResponse> => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiFetch<WorkMembershipClaimListResponse>(
      `/unit/${workUnitId}/work-membership-claims${qs}`,
    );
  },

  approveClaim: async (claimId: string): Promise<WorkMembershipClaimDTO> => {
    return apiFetch<WorkMembershipClaimDTO>(
      `/work-membership-claims/${claimId}/approve`,
      {
        method: "POST",
      },
    );
  },

  rejectClaim: async (
    claimId: string,
    body: WorkMembershipClaimRejectBody,
  ): Promise<WorkMembershipClaimDTO> => {
    return apiFetch<WorkMembershipClaimDTO>(
      `/work-membership-claims/${claimId}/reject`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  },

  withdrawClaim: async (claimId: string): Promise<WorkMembershipClaimDTO> => {
    return apiFetch<WorkMembershipClaimDTO>(
      `/work-membership-claims/${claimId}`,
      {
        method: "DELETE",
      },
    );
  },
};
