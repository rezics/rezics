import { queryOptions } from "@tanstack/react-query";
import { accountOperationsApi } from "./account-operation.api";
import { accountOperationsKeys } from "./account-operation.keys";

export const authUserAccountSummaryQuery = (authUserIds: string[]) =>
  queryOptions({
    queryKey: accountOperationsKeys.authUserSummary(authUserIds),
    queryFn: () => accountOperationsApi.summarizeAuthUsers({ authUserIds }),
    enabled: authUserIds.length > 0,
    staleTime: 1000 * 30,
  });

export const accountOperationsQueries = {
  authUserSummary: authUserAccountSummaryQuery,
};
