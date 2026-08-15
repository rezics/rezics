import { isDeepStrictEqual } from "node:util";

export function bootstrapValuesEqual(actual: unknown, expected: unknown): boolean {
	if (actual instanceof Date && expected instanceof Date)
		return actual.getTime() === expected.getTime();
	return isDeepStrictEqual(actual, expected);
}
