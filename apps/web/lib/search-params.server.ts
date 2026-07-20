import { createSearchParamsCache, createSerializer, parseAsString } from "nuqs/server";

import { authSearchParamsParsers, urlStateOptions } from "./search-params";

export const serializeAuthSearchParams = createSerializer(authSearchParamsParsers);

export const postCreateSearchParams = createSearchParamsCache({
	realmId: parseAsString.withOptions(urlStateOptions),
});

export const postDetailSearchParams = createSearchParamsCache({
	realmId: parseAsString.withOptions(urlStateOptions),
});

export const historyCompareSearchParams = createSearchParamsCache({
	from: parseAsString.withOptions(urlStateOptions),
	to: parseAsString.withOptions(urlStateOptions),
});
