/** Maximum number of logical commands accepted by one atomic batch. */
export const RevisionedBatchCommandLimit = 10_000;

/**
 * Splits physical database work without changing logical command accounting or
 * transaction atomicity. This keeps large one-command effects below driver and
 * PostgreSQL parameter limits.
 */
export function revisionedBatchChunks<Value>(
	values: readonly Value[],
	size = 1_000,
): readonly (readonly Value[])[] {
	if (!Number.isSafeInteger(size) || size < 1)
		throw new RangeError("Revisioned batch chunk size must be a positive safe integer");
	const chunks: Value[][] = [];
	for (let offset = 0; offset < values.length; offset += size)
		chunks.push(values.slice(offset, offset + size));
	return chunks;
}

export type RevisionedBatchMutation<Result extends object, Change> = {
	readonly result: Result;
	readonly change?: Change;
};

/**
 * Runs the shared lock, optimistic-concurrency, plan, and commit lifecycle for
 * one revisioned aggregate mutation.
 *
 * TODO(revisioned-document-batches): Adapt future large stable-identity member
 * arrays to this lifecycle and domain-specific command planners. Small
 * value-object arrays do not need a batch protocol.
 *
 * @internal
 */
export async function runRevisionedAggregateMutation<
	Result extends object,
	Change,
	Commit extends object,
>(input: {
	readonly expectedRevisionId: string;
	readonly lock: () => Promise<void>;
	readonly loadHeadRevisionId: () => Promise<string | null>;
	readonly revisionConflict: (latestRevisionId: string | null) => Error;
	readonly mutate: () => Promise<RevisionedBatchMutation<Result, Change>>;
	readonly commit: (change: Change) => Promise<Commit>;
	readonly unchanged: (revisionId: string) => Commit;
}): Promise<Result & Commit> {
	await input.lock();
	const latestRevisionId = await input.loadHeadRevisionId();
	if (latestRevisionId !== input.expectedRevisionId)
		throw input.revisionConflict(latestRevisionId);
	const mutation = await input.mutate();
	if (mutation.change === undefined)
		return { ...mutation.result, ...input.unchanged(input.expectedRevisionId) };
	return { ...mutation.result, ...(await input.commit(mutation.change)) };
}
