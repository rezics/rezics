import { AsyncLocalStorage } from "node:async_hooks";

interface SearchStatementDeadline {
	readonly expiresAt: number;
	readonly maximumMilliseconds: number;
}

const statementTimeoutStorage = new AsyncLocalStorage<SearchStatementDeadline>();

/** Runs Search work with a request-local upper bound for PostgreSQL statements. */
export function withSearchStatementTimeout<T>(
	maximumMilliseconds: number,
	work: () => Promise<T>,
): Promise<T> {
	if (!Number.isSafeInteger(maximumMilliseconds) || maximumMilliseconds < 1)
		throw new RangeError("Search statement timeout must be a positive integer");
	const now = Date.now();
	const parent = statementTimeoutStorage.getStore();
	return statementTimeoutStorage.run(
		{
			expiresAt: Math.min(parent?.expiresAt ?? Number.POSITIVE_INFINITY, now + maximumMilliseconds),
			maximumMilliseconds: Math.min(
				parent?.maximumMilliseconds ?? Number.POSITIVE_INFINITY,
				maximumMilliseconds,
			),
		},
		work,
	);
}

export function boundedSearchStatementTimeout(configuredMilliseconds: number): number {
	const deadline = statementTimeoutStorage.getStore();
	return deadline === undefined
		? configuredMilliseconds
		: Math.max(
				1,
				Math.min(
					configuredMilliseconds,
					deadline.maximumMilliseconds,
					deadline.expiresAt - Date.now(),
				),
			);
}
