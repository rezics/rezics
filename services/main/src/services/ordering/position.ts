import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";

import {
	FractionalPositionRebalanceThresholdBytes,
	FractionalPositionStorageMaximumBytes,
} from "./contract";

export {
	FractionalPositionInputMaximumBytes,
	FractionalPositionRebalanceThresholdBytes,
	FractionalPositionStorageMaximumBytes,
} from "./contract";

export class FractionalPositionCapacityExceeded extends RangeError {
	readonly byteLength: number;

	constructor(byteLength: number) {
		super(
			`Fractional position requires ${byteLength} bytes; compact its ordering scope before the ${FractionalPositionStorageMaximumBytes}-byte storage ceiling`,
		);
		this.name = "FractionalPositionCapacityExceeded";
		this.byteLength = byteLength;
	}
}

/** Fractional-indexing keys use only single-byte ASCII code points. */
export function fractionalPositionByteLength(value: string): number {
	return value.length;
}

function proveStorageSafePosition(value: string): string {
	const byteLength = fractionalPositionByteLength(value);
	if (byteLength > FractionalPositionStorageMaximumBytes)
		throw new FractionalPositionCapacityExceeded(byteLength);
	return value;
}

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

/** Return whether a valid position has entered the compaction window. */
export function fractionalPositionNeedsRebalance(value: string): boolean {
	return fractionalPositionByteLength(value) > FractionalPositionRebalanceThresholdBytes;
}

/** Return whether a valid position can be stored without risking the hard ceiling. */
export function isStorageSafeFractionalPosition(value: string): boolean {
	return (
		fractionalPositionByteLength(value) <= FractionalPositionStorageMaximumBytes &&
		isFractionalPosition(value)
	);
}

/** Generate a position strictly between the optional neighboring positions. */
export function fractionalPositionBetween(
	before: string | null | undefined,
	after: string | null | undefined,
): string {
	return proveStorageSafePosition(generateKeyBetween(before, after));
}

/** Generate a stable ordered run strictly between optional neighboring positions. */
export function fractionalPositionsBetween(
	before: string | null | undefined,
	after: string | null | undefined,
	count: number,
): string[] {
	if (!Number.isSafeInteger(count) || count < 0)
		throw new RangeError("Fractional position count must be a non-negative safe integer");
	return generateNKeysBetween(before ?? null, after ?? null, count).map(proveStorageSafePosition);
}

/** Generate compact, evenly distributed keys for a complete ordering scope. */
export function rebalancedFractionalPositions(count: number): string[] {
	if (!Number.isSafeInteger(count) || count < 0)
		throw new RangeError("Fractional position count must be a non-negative safe integer");
	return generateNKeysBetween(null, null, count).map(proveStorageSafePosition);
}

export type FractionalPositionSequenceRebalance = {
	readonly positions: readonly string[];
	readonly changedIndexes: readonly number[];
};

/**
 * Compact only the dense part of an ordered sequence that exhausted its soft
 * key budget. The repair starts with one member and doubles around the first
 * degraded key until the surrounding gap can hold compact keys. It reaches the
 * complete owner scope only when no smaller window has enough address space.
 */
export function rebalanceFractionalPositionSequence(
	positions: readonly string[],
): FractionalPositionSequenceRebalance {
	if (!positions.some(fractionalPositionNeedsRebalance)) return { positions, changedIndexes: [] };

	const compacted = [...positions];
	let cursor = 0;
	while (cursor < compacted.length) {
		let degradedIndex = -1;
		for (let index = cursor; index < compacted.length; index += 1) {
			const position = compacted[index];
			if (position === undefined)
				throw new Error("Fractional-position sequence contains a missing member");
			if (fractionalPositionNeedsRebalance(position)) {
				degradedIndex = index;
				break;
			}
		}
		if (degradedIndex < 0) break;

		let windowSize = 1;
		for (;;) {
			const leftMembers = Math.floor((windowSize - 1) / 2);
			let start = Math.max(0, degradedIndex - leftMembers);
			let end = Math.min(compacted.length, start + windowSize);
			start = Math.max(0, end - windowSize);
			const before = start > 0 ? compacted[start - 1] : null;
			const after = end < compacted.length ? compacted[end] : null;
			let generated: readonly string[] | undefined;
			try {
				generated = fractionalPositionsBetween(before, after, end - start);
			} catch (error) {
				if (!(error instanceof FractionalPositionCapacityExceeded)) throw error;
			}
			if (generated && generated.every((position) => !fractionalPositionNeedsRebalance(position))) {
				compacted.splice(start, end - start, ...generated);
				cursor = end;
				break;
			}
			if (windowSize === compacted.length)
				throw new Error("Complete fractional-position scope could not be compacted");
			windowSize = Math.min(compacted.length, windowSize * 2);
		}
	}

	return {
		positions: compacted,
		changedIndexes: compacted.flatMap((position, index) =>
			position === positions[index] ? [] : [index],
		),
	};
}

/** Return the deterministic key at a zero-based ordinal in a fresh sequence. */
export function fractionalPositionAt(ordinal: number): string {
	if (!Number.isSafeInteger(ordinal) || ordinal < 0)
		throw new RangeError("Fractional position ordinal must be a non-negative safe integer");
	const position = generateNKeysBetween(null, null, ordinal + 1)[ordinal];
	if (!position) throw new Error("Fractional position generation returned no value");
	return proveStorageSafePosition(position);
}

/** Compare fractional positions using the generator's bytewise ordering. */
export function compareFractionalPositions(left: string, right: string): number {
	return compareBytewisePositions(left, right);
}

/** Compare opaque position tokens using PostgreSQL `C` collation ordering. */
export function compareBytewisePositions(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}
