/**
 * Allocate an immutable value without rewriting a concurrent winner.
 * @remarks Both callbacks must use the same bounded owner transaction. The
 * separate final lookup gets a new read-committed statement snapshot; stronger
 * isolation propagates serialization failure for a whole-command retry.
 * @internal
 */
export async function allocateImmutableReference(
	find: () => Promise<string | undefined>,
	insert: () => Promise<string | undefined>,
): Promise<string> {
	const existing = await find();
	if (existing !== undefined) return existing;
	const created = await insert();
	if (created !== undefined) return created;
	const winner = await find();
	if (winner === undefined)
		throw new Error("Reference allocation requires a fresh transaction snapshot");
	return winner;
}
