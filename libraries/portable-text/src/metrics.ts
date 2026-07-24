import type { PortableText } from "./index";

export const PortableTextMetricAlgorithmVersion = 1 as const;

export type PortableTextMetrics = {
	/** Locale-aware word-like segments; whitespace and punctuation are excluded. */
	readonly wordCount: number;
	/** User-perceived Unicode characters; whitespace is excluded and punctuation is included. */
	readonly characterCount: number;
};

function visibleBlockText(block: PortableText[number]): string {
	if (block._type === "block" && "children" in block && Array.isArray(block.children))
		return block.children
			.filter(
				(child): child is Extract<typeof child, { readonly text: string }> =>
					child._type === "span" && "text" in child && typeof child.text === "string",
			)
			.map((span) => span.text)
			.join("");
	if (block._type === "image" && "caption" in block && typeof block.caption === "string")
		return block.caption;
	return "";
}

/**
 * Projects Portable Text into the visible prose used by content metrics.
 *
 * Span boundaries do not insert whitespace because marks may split one lexical
 * word across adjacent spans. Block boundaries do insert a line break. Image
 * captions are visible prose; accessibility alt text and unknown custom blocks
 * are deliberately excluded.
 */
export function portableTextMetricText(content: PortableText): string {
	return content.map(visibleBlockText).join("\n");
}

export function measurePortableText(content: PortableText, locale: string): PortableTextMetrics {
	const text = portableTextMetricText(content);
	const wordCount = [...new Intl.Segmenter(locale, { granularity: "word" }).segment(text)].filter(
		(segment) => segment.isWordLike,
	).length;
	const characterCount = [
		...new Intl.Segmenter(locale, { granularity: "grapheme" }).segment(text),
	].filter((segment) => !/^\s+$/u.test(segment.segment)).length;
	return { wordCount, characterCount };
}
