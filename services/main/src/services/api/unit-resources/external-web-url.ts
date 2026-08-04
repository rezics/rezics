/**
 * Canonical display and deduplication forms of one external Web URL.
 *
 * @internal
 */
export type NormalizedExternalWebUrl = {
	readonly url: string;
	readonly normalizedUrl: string;
};

/**
 * Parses an HTTP(S) URL into its canonical display and identity forms.
 *
 * @internal
 */
export function normalizeExternalWebUrl(value: string): NormalizedExternalWebUrl {
	const parsed = new URL(value);
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
		throw new TypeError("External web URL must use HTTP or HTTPS");

	const url = parsed.toString();
	parsed.hash = "";
	parsed.searchParams.sort();
	return { url, normalizedUrl: parsed.toString() };
}
