import { StatusCodes } from "http-status-codes";
import type { DefaultOptions } from "@tanstack/react-query";
import { getErrorStatus } from "@/i18n/errors";

const TransientQueryStatuses: ReadonlySet<number> = new Set([
	StatusCodes.BAD_GATEWAY,
	StatusCodes.SERVICE_UNAVAILABLE,
	StatusCodes.GATEWAY_TIMEOUT,
]);

/** Retries one transport or explicitly transient gateway failure for safe reads. */
export function shouldRetryQuery(attempt: number, error: unknown) {
	if (attempt >= 1) return false;
	const status = getErrorStatus(error);
	return status === undefined || TransientQueryStatuses.has(status);
}

/** Application-wide TanStack Query defaults for automatic server communication. */
export const QueryClientDefaultOptions = {
	queries: {
		staleTime: 30_000,
		retry: shouldRetryQuery,
	},
	mutations: {
		retry: false,
	},
} satisfies DefaultOptions;
