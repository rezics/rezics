const SegmentPattern = /^[a-z0-9][a-z0-9-]*$/;

export type UnitScope = readonly string[];

export function unitScope(...segments: string[]): UnitScope {
	if (segments.length > 8 || segments.some((segment) => !SegmentPattern.test(segment)))
		throw new TypeError("Invalid Unit authorization scope");
	return segments;
}

/** A root or ancestor grant covers a requested descendant scope. */
export function scopeCovers(granted: readonly string[], requested: readonly string[]): boolean {
	return (
		granted.length <= requested.length &&
		granted.every((segment, index) => requested[index] === segment)
	);
}

export function scopeKey(scope: readonly string[]): string {
	return scope.join("/");
}
