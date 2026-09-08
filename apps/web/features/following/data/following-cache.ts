import {
	getApiAccountMeFollowingByUnitIdQueryKey,
	getApiAccountMeFollowingQueryKey,
} from "@rezics/openapi-tanstack-query";
import type { QueryClient } from "@tanstack/react-query";

export async function invalidateFollowingQueries(queryClient: QueryClient, unitId?: string) {
	const invalidations: Promise<unknown>[] = [
		queryClient.invalidateQueries({ queryKey: getApiAccountMeFollowingQueryKey() }),
	];
	if (unitId)
		invalidations.push(
			queryClient.invalidateQueries({
				queryKey: getApiAccountMeFollowingByUnitIdQueryKey({ path: { unitId } }),
			}),
		);
	await Promise.all(invalidations);
}
