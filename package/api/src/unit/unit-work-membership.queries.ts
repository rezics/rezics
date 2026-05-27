import type {
  WorkMembershipClaimDTO,
  WorkMembershipClaimListResponse,
} from "@rezics/contract";
import { queryOptions } from "@tanstack/react-query";
import { unitWorkMembershipApi } from "./unit-work-membership.api";
import { unitWorkMembershipKeys } from "./unit-work-membership.keys";

export function workMembershipClaimsByWorkQuery(
  workUnitId: string,
  status?: WorkMembershipClaimDTO["status"],
) {
  return queryOptions<WorkMembershipClaimListResponse>({
    queryKey: unitWorkMembershipKeys.claimsByWork(workUnitId, status),
    queryFn: () => unitWorkMembershipApi.listClaims(workUnitId, status),
    enabled: Boolean(workUnitId),
  });
}
