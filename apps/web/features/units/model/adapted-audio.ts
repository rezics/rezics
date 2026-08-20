/** Public API upper bound for direct adapted-Audio relations on one Video. */
export const MaximumAudioTracksPerVideo = 64;

export const AdaptedAudioUnitKinds = ["audio"] as const;

function compareCodePoints(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

/** Compares the API's bounded adapted-Audio relation as an unordered set. */
export function adaptedAudioUnitIdsChanged(
	current: readonly string[],
	next: readonly string[],
): boolean {
	if (current.length !== next.length) return true;
	const currentIds = [...current].sort(compareCodePoints);
	const nextIds = [...next].sort(compareCodePoints);
	return currentIds.some((unitId, index) => unitId !== nextIds[index]);
}
