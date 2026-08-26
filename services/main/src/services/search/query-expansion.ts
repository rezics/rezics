import OpenCC from "opencc-wasm";

import type { ContentLanguage } from "@rezics/i18n";

/**
 * Changes to the OpenCC package, configurations, or expansion rules invalidate
 * Search cursors because they can change the candidate set for the same input.
 */
export const SearchQueryExpansionPolicyVersion = "opencc-wasm-0.13.0-s2twp-tw2sp-v1" as const;

const MaxSearchQueryVariants = 3 as const;
const MaxSearchQueryVariantLength = 512 as const;
const MaxSearchQueryVariantsTotalLength = 1536 as const;
const MaxTagCompoundLength = 16 as const;
const MaxTagCompoundParts = 4 as const;
const MaxTagCompoundDecompositions = 32 as const;

type NonEmptyStringTuple = readonly [string, ...string[]];

export interface ExpandedSearchQuery {
	/** NFC-normalized, trimmed query used for request identity and display metadata. */
	readonly query: string;
	/** Original query followed by at most one result from each OpenCC direction. */
	readonly variants: NonEmptyStringTuple;
	readonly policyVersion: typeof SearchQueryExpansionPolicyVersion;
}

export interface TagCompoundDecomposition {
	readonly parts: readonly [string, string, ...string[]];
}

const SearchQueryExpansionConfigs = {
	simplifiedToTaiwan: "s2twp",
	taiwanToSimplified: "tw2sp",
} as const;

const simplifiedToTaiwan = OpenCC.Converter({
	config: SearchQueryExpansionConfigs.simplifiedToTaiwan,
});
const taiwanToSimplified = OpenCC.Converter({
	config: SearchQueryExpansionConfigs.taiwanToSimplified,
});

async function convertQueryVariant(
	convert: (text: string) => Promise<string>,
	query: string,
): Promise<string> {
	const converted = await convert(query);
	if (typeof converted !== "string") throw new Error("OpenCC conversion must return a string");
	return converted;
}

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

function addTagCompoundDecomposition(
	result: TagCompoundDecomposition[],
	parts: readonly string[],
): void {
	if (
		result.length >= MaxTagCompoundDecompositions ||
		parts.length < 2 ||
		parts.length > MaxTagCompoundParts ||
		parts.some((part) => !part)
	)
		return;
	const key = parts.join("\u0000");
	if (result.some((item) => item.parts.join("\u0000") === key)) return;
	result.push({
		parts: [parts[0]!, parts[1]!, ...parts.slice(2)],
	});
}

/**
 * Produces a bounded set of Tag-sized interpretations for a compound query.
 *
 * Explicit separators win. Unseparated Han input is split only into 2–4 parts
 * of at least two code points, avoiding one-character posting explosions.
 */
export function decomposeTagCompoundQuery(input: string): readonly TagCompoundDecomposition[] {
	const query = input.trim().normalize("NFC");
	if (!query || [...query].length > MaxTagCompoundLength) return [];
	const explicit = query
		.split(/[\s:：→>›/／]+/u)
		.map((part) => part.trim())
		.filter(Boolean);
	if (explicit.length > 1) {
		const result: TagCompoundDecomposition[] = [];
		addTagCompoundDecomposition(result, explicit);
		return result;
	}
	if (!/^\p{Script=Han}+$/u.test(query) || hasKanaOrHangul(query)) return [];
	const codePoints = [...query];
	const result: TagCompoundDecomposition[] = [];
	const visit = (start: number, parts: string[]) => {
		if (result.length >= MaxTagCompoundDecompositions) return;
		if (start === codePoints.length) {
			addTagCompoundDecomposition(result, parts);
			return;
		}
		if (parts.length >= MaxTagCompoundParts) return;
		const remainingSlots = MaxTagCompoundParts - parts.length;
		for (
			let end = start + 2;
			end <= codePoints.length && codePoints.length - end >= 2 * Math.max(0, 1 - parts.length);
			end += 1
		) {
			const remaining = codePoints.length - end;
			if (remaining > 0 && remaining < 2) continue;
			if (remaining > remainingSlots * MaxTagCompoundLength) continue;
			visit(end, [...parts, codePoints.slice(start, end).join("")]);
		}
	};
	visit(0, []);
	return result.toSorted(
		(left, right) =>
			left.parts.length - right.parts.length ||
			Math.max(...left.parts.map((part) => [...part].length)) -
				Math.max(...right.parts.map((part) => [...part].length)) ||
			left.parts.join("\u0000").localeCompare(right.parts.join("\u0000")),
	);
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
export async function expandSearchQuery(
	input: string,
	languageBoundary: readonly ContentLanguage[] = [],
): Promise<ExpandedSearchQuery> {
	const query = input.trim().normalize("NFC");
	const variants: string[] = [query];

	if (query && isChineseExpansionEligible(query, languageBoundary)) {
		addVariant(variants, await convertQueryVariant(simplifiedToTaiwan, query));
		addVariant(variants, await convertQueryVariant(taiwanToSimplified, query));
	}

	return {
		query,
		variants: asNonEmptyStringTuple(variants),
		policyVersion: SearchQueryExpansionPolicyVersion,
	};
}
