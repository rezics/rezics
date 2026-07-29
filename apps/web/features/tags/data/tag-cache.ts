import { getApiUsersMeTagRealmSubscriptionsQueryKey } from "@rezics/openapi-tanstack-query";
import type { QueryClient } from "@tanstack/react-query";

const UnitTagsUrl = "/api/units/:type/:unitId/tags";

export async function invalidatePersonalizedTagQueries(queryClient: QueryClient) {
	await Promise.all([
		queryClient.invalidateQueries({
			queryKey: getApiUsersMeTagRealmSubscriptionsQueryKey(),
		}),
		queryClient.invalidateQueries({
			predicate: ({ queryKey }) => {
				const [request] = queryKey;
				return (
					typeof request === "object" &&
					request !== null &&
					"url" in request &&
					request.url === UnitTagsUrl
				);
			},
		}),
	]);
}
