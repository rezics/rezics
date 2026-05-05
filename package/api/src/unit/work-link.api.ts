import type {
  WorkLinkBody,
  WorkLinkClaimDTO,
  WorkLinkClaimListResponse,
  WorkLinkClaimRejectBody,
  WorkLinkResponse,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const workLinkApi = {
  /**
   * `PATCH /unit/:releaseId/work-link` — set or clear the release's link to
   * a Work. Returns LINKED / PENDING / UNLINKED depending on authority and
   * wiki short-circuit.
   */
  patchWorkLink: async (
    releaseId: string,
    body: WorkLinkBody,
  ): Promise<WorkLinkResponse> => {
    return apiFetch<WorkLinkResponse>(`/unit/${releaseId}/work-link`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  /**
   * `GET /unit/:workUnitId/work-link-claims` — work-side claim inbox.
   */
  listClaims: async (
    workUnitId: string,
    status?: WorkLinkClaimDTO["status"],
  ): Promise<WorkLinkClaimListResponse> => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiFetch<WorkLinkClaimListResponse>(
      `/unit/${workUnitId}/work-link-claims${qs}`,
    );
  },

  approveClaim: async (claimId: string): Promise<WorkLinkClaimDTO> => {
    return apiFetch<WorkLinkClaimDTO>(`/work-link-claims/${claimId}/approve`, {
      method: "POST",
    });
  },

  rejectClaim: async (
    claimId: string,
    body: WorkLinkClaimRejectBody,
  ): Promise<WorkLinkClaimDTO> => {
    return apiFetch<WorkLinkClaimDTO>(`/work-link-claims/${claimId}/reject`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  withdrawClaim: async (claimId: string): Promise<WorkLinkClaimDTO> => {
    return apiFetch<WorkLinkClaimDTO>(`/work-link-claims/${claimId}`, {
      method: "DELETE",
    });
  },
};
