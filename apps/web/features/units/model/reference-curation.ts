import { generateKeyBetween } from "fractional-indexing";

/** @internal Minimal candidate shape used by reference ordering controls. */
export interface PinnedReferenceCandidate {
	readonly id: string;
	readonly pinned: boolean;
	readonly position: string | null;
}

/** @internal Returns the position for appending one candidate to the curated group. */
export function nextPinnedReferencePosition(
	candidates: readonly PinnedReferenceCandidate[],
): string {
	const last = candidates.filter((candidate) => candidate.pinned).at(-1);
	return generateKeyBetween(last?.position ?? null, null);
}

/** @internal Returns a collision-free position after moving a pinned candidate within the curated group. */
export function positionForPinnedReferenceMove(
	candidates: readonly PinnedReferenceCandidate[],
	candidateId: string,
	targetIndex: number,
): string | null {
	const pinned = candidates.filter(
		(candidate): candidate is PinnedReferenceCandidate & { readonly position: string } =>
			candidate.pinned && candidate.position !== null,
	);
	const sourceIndex = pinned.findIndex((candidate) => candidate.id === candidateId);
	if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= pinned.length) return null;
	const reordered = [...pinned];
	const [moved] = reordered.splice(sourceIndex, 1);
	if (!moved) return null;
	reordered.splice(targetIndex, 0, moved);
	const index = reordered.findIndex((candidate) => candidate.id === candidateId);
	return generateKeyBetween(
		reordered[index - 1]?.position ?? null,
		reordered[index + 1]?.position ?? null,
	);
}
