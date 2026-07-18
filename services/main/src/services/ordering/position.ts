import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";

/** The first key in an otherwise empty fractionally ordered sequence. */
export const InitialFractionalPosition = generateKeyBetween(null, null);

/**
 * Return whether a value is a fractional-index key accepted by the canonical
 * generator. Fractional positions are case-sensitive and must be compared
 * bytewise rather than with locale-aware comparison.
 */
export function isFractionalPosition(value: string): boolean {
	try {
		generateKeyBetween(value, null);
		return true;
	} catch {
		return false;
	}
}

/** Generate a position strictly between the optional neighboring positions. */
export function fractionalPositionBetween(
	before: string | null | undefined,
	after: string | null | undefined,
): string {
	return generateKeyBetween(before, after);
}

/** Return the deterministic key at a zero-based ordinal in a fresh sequence. */
export function fractionalPositionAt(ordinal: number): string {
	if (!Number.isSafeInteger(ordinal) || ordinal < 0)
		throw new RangeError("Fractional position ordinal must be a non-negative safe integer");
	const position = generateNKeysBetween(null, null, ordinal + 1)[ordinal];
	if (!position) throw new Error("Fractional position generation returned no value");
	return position;
}

/** Compare fractional positions using the generator's bytewise ordering. */
export function compareFractionalPositions(left: string, right: string): number {
	return compareBytewisePositions(left, right);
}

/** Compare opaque position tokens using PostgreSQL `C` collation ordering. */
export function compareBytewisePositions(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}
