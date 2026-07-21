import {
	getApiUsersMeFollowingByUnitIdQueryKey,
	getApiUsersMeFollowingQueryKey,
} from "@rezics/openapi-tanstack-query";
import type { QueryClient } from "@tanstack/react-query";

export async function invalidateFollowingQueries(queryClient: QueryClient, unitId?: string) {
	const invalidations: Promise<unknown>[] = [
		queryClient.invalidateQueries({ queryKey: getApiUsersMeFollowingQueryKey() }),
	];
	if (unitId)
		invalidations.push(
			queryClient.invalidateQueries({
				queryKey: getApiUsersMeFollowingByUnitIdQueryKey({ path: { unitId } }),
			}),
		);
	await Promise.all(invalidations);
}
