import {
	getApiProgressByUnitIdQueryKey,
	getApiProgressByUnitIdNodesQueryKey,
	getApiProgressQueryKey,
} from "@rezics/openapi-tanstack-query";
import type { QueryClient } from "@tanstack/react-query";

export async function invalidateProgressQueries(
	queryClient: QueryClient,
	unitId?: string,
): Promise<void> {
	const invalidations: Promise<unknown>[] = [
		queryClient.invalidateQueries({ queryKey: getApiProgressQueryKey() }),
	];
	if (unitId)
		invalidations.push(
			queryClient.invalidateQueries({
				queryKey: getApiProgressByUnitIdQueryKey({ path: { unitId } }),
			}),
			queryClient.invalidateQueries({
				queryKey: getApiProgressByUnitIdNodesQueryKey({ path: { unitId } }),
			}),
		);
	await Promise.all(invalidations);
}
