import type {
  WorkLinkClaimDTO,
  WorkLinkClaimListResponse,
} from "@rezics/contract";
import { queryOptions } from "@tanstack/react-query";
import { workLinkApi } from "./work-link.api";
import { workLinkKeys } from "./work-link.keys";

export function workLinkClaimsByWorkQuery(
  workUnitId: string,
  status?: WorkLinkClaimDTO["status"],
) {
  return queryOptions<WorkLinkClaimListResponse>({
    queryKey: workLinkKeys.claimsByWork(workUnitId, status),
    queryFn: () => workLinkApi.listClaims(workUnitId, status),
    enabled: Boolean(workUnitId),
  });
}
