import {
	getApiRealmsByRealmIdQueryKey,
	getApiRealmsQueryKey,
} from "@rezics/openapi-tanstack-query";
import type { QueryClient } from "@tanstack/react-query";

export async function invalidateRealmDetails(queryClient: QueryClient, realmId: string) {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: ["realm-enrollment", realmId] }),
		queryClient.invalidateQueries({ queryKey: ["realm-membership-capabilities", realmId] }),
		queryClient.invalidateQueries({ queryKey: getApiRealmsQueryKey() }),
		queryClient.invalidateQueries({
			queryKey: getApiRealmsByRealmIdQueryKey({ path: { realmId } }),
		}),
	]);
}
