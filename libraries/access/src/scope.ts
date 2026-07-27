const SegmentPattern = /^[a-z0-9][a-z0-9-]*$/;

/**
 * A Unit root or nested authorization path.
 *
 * @alpha
 */
export type UnitScope = readonly string[];

/**
 * Constructs a validated Unit authorization scope.
 *
 * @alpha
 */
export function unitScope(...segments: string[]): UnitScope {
	if (segments.length > 8 || segments.some((segment) => !SegmentPattern.test(segment)))
		throw new TypeError("Invalid Unit authorization scope");
	return segments;
}

/**
 * Returns whether an ancestor grant covers a requested descendant scope.
 *
 * @alpha
 */
export function scopeCovers(granted: readonly string[], requested: readonly string[]): boolean {
	return (
		granted.length <= requested.length &&
		granted.every((segment, index) => requested[index] === segment)
	);
}

/**
 * Produces the stable cache-key representation of a Unit scope.
 *
 * @alpha
 */
export function scopeKey(scope: readonly string[]): string {
	return scope.join("/");
}
