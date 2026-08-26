export type ContentSpoilerLevel = 0 | 1 | 2;

/**
 * Narrows the database projection to the public content-spoiler contract.
 *
 * Persisted values are guarded by the content-label registry. This check keeps
 * an unexpected database value from escaping through a typed API response.
 */
export function requireContentSpoilerLevel(value: number): ContentSpoilerLevel {
	if (value === 0 || value === 1 || value === 2) return value;
	throw new Error("Content spoiler level is invalid");
}
