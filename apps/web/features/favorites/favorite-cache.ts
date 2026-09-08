import { getApiFavoritesQueryKey } from "@rezics/openapi-tanstack-query";
import type { QueryClient } from "@tanstack/react-query";

/** Every private mutation advances the account-wide revision, including other entry controls. */
export function invalidateFavorites(client: QueryClient) {
	const root = getApiFavoritesQueryKey()[0].url;
	return client.invalidateQueries({
		predicate: ({ queryKey }) => {
			const key = queryKey[0];
			return (
				typeof key === "object" &&
				key !== null &&
				"url" in key &&
				typeof key.url === "string" &&
				(key.url === root || key.url.startsWith(`${root}/`))
			);
		},
	});
}
