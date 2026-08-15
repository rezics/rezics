import { OpenCC } from "opencc";

import type { ContentLanguage } from "@rezics/i18n";

/**
 * Changes to the OpenCC package, configurations, or expansion rules invalidate
 * Search cursors because they can change the candidate set for the same input.
 */
export const SearchQueryExpansionPolicyVersion = "opencc-1.4.1-s2twp-tw2sp-v1" as const;

const MaxSearchQueryVariants = 3 as const;
const MaxSearchQueryVariantLength = 512 as const;
const MaxSearchQueryVariantsTotalLength = 1536 as const;

type NonEmptyStringTuple = readonly [string, ...string[]];

export interface ExpandedSearchQuery {
	/** NFC-normalized, trimmed query used for request identity and display metadata. */
	readonly query: string;
	/** Original query followed by at most one result from each OpenCC direction. */
	readonly variants: NonEmptyStringTuple;
	readonly policyVersion: typeof SearchQueryExpansionPolicyVersion;
}

const simplifiedToTaiwan = new OpenCC("s2twp.json");
const taiwanToSimplified = new OpenCC("tw2sp.json");

function asNonEmptyStringTuple(values: readonly string[]): NonEmptyStringTuple {
	const first = values[0];
	if (first === undefined) throw new Error("Search query expansion produced no variants");
	return [first, ...values.slice(1)];
}

function hasHan(query: string): boolean {
	return /\p{Script=Han}/u.test(query);
}

function hasKanaOrHangul(query: string): boolean {
	return /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(query);
}

function isChineseExpansionEligible(
	query: string,
	languageBoundary: readonly ContentLanguage[],
): boolean {
	if (!hasHan(query) || hasKanaOrHangul(query)) return false;
	// A content-language boundary selects indexed columns; it does not change the
	// language of the user's query. Only an explicit Japanese boundary suppresses
	// Han-only expansion, because those characters are commonly Japanese kanji.
	return !languageBoundary.includes("ja");
}

function addVariant(variants: string[], candidate: string): void {
	if (
		variants.includes(candidate) ||
		variants.length >= MaxSearchQueryVariants ||
		candidate.length > MaxSearchQueryVariantLength ||
		variants.reduce((total, variant) => total + variant.length, 0) + candidate.length >
			MaxSearchQueryVariantsTotalLength
	)
		return;
	variants.push(candidate);
}

/**
 * Expands one user query without changing stored content or the public API shape.
 *
 * The original query is always retained. OpenCC is deliberately applied to the
 * complete query rather than producing a per-token Cartesian product, keeping
 * the request-time work bounded and preserving the existing query semantics for
 * whitespace and punctuation.
 */
export function expandSearchQuery(
	input: string,
	languageBoundary: readonly ContentLanguage[] = [],
): ExpandedSearchQuery {
	const query = input.trim().normalize("NFC");
	const variants: string[] = [query];

	if (query && isChineseExpansionEligible(query, languageBoundary)) {
		addVariant(variants, simplifiedToTaiwan.convertSync(query));
		addVariant(variants, taiwanToSimplified.convertSync(query));
	}

	return {
		query,
		variants: asNonEmptyStringTuple(variants),
		policyVersion: SearchQueryExpansionPolicyVersion,
	};
}
