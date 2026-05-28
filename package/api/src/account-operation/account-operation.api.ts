import type {
  AdminAuthUserAccountSummaryRequest,
  AdminAuthUserAccountSummaryResponse,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const accountOperationsApi = {
  summarizeAuthUsers: async (
    input: AdminAuthUserAccountSummaryRequest,
  ): Promise<AdminAuthUserAccountSummaryResponse> => {
    return apiFetch<AdminAuthUserAccountSummaryResponse>(
      "/admin/account-operation/auth-users/summary",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },
};
