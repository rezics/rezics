import { QueryClient } from "@tanstack/react-query";

import { QueryClientDefaultOptions } from "./query-policy";

export function createQueryClient() {
	return new QueryClient({
		defaultOptions: QueryClientDefaultOptions,
	});
}
