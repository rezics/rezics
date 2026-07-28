import type { ChineseContentDisplay } from "@rezics/i18n";
import {
	isPortableTextValueBlock,
	type PortableTextValue,
	type PortableTextImageBlock,
	type PortableTextValueSpan,
} from "@rezics/portable-text";

type ChineseConverter = (value: string) => string;

const converterPromises = new Map<
	Exclude<ChineseContentDisplay, "original">,
	Promise<ChineseConverter>
>();
const convertedTextCache = new Map<string, string>();
const technicalTokenPattern =
	/(?:https?:\/\/|mailto:)[^\s]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:^|\s)[@#][^\s]+/g;

function converterFor(
	target: Exclude<ChineseContentDisplay, "original">,
): Promise<ChineseConverter> {
	const existing = converterPromises.get(target);
	if (existing) return existing;

	const created =
		target === "hant"
			? import("opencc-js/cn2t").then(({ Converter }) => Converter({ from: "cn", to: "tw" }))
			: import("opencc-js/t2cn").then(({ Converter }) => Converter({ from: "t", to: "cn" }));
	const retryable = created.catch((error: unknown) => {
		converterPromises.delete(target);
		throw error;
	});
	converterPromises.set(target, retryable);
	return retryable;
}

function convertProsePreservingTechnicalTokens(value: string, converter: ChineseConverter): string {
	let result = "";
	let previousEnd = 0;
	for (const match of value.matchAll(technicalTokenPattern)) {
		const index = match.index ?? 0;
		result += converter(value.slice(previousEnd, index));
		result += match[0];
		previousEnd = index + match[0].length;
	}
	return result + converter(value.slice(previousEnd));
}

export async function convertChineseContentText(
	value: string,
	display: ChineseContentDisplay,
): Promise<string> {
	if (display === "original" || value.length === 0) return value;
	const cacheKey = `${display}\u0000${value}`;
	const cached = convertedTextCache.get(cacheKey);
	if (cached !== undefined) return cached;

	const converter = await converterFor(display);
	const converted = convertProsePreservingTechnicalTokens(value, converter);
	convertedTextCache.set(cacheKey, converted);
	return converted;
}

async function convertSpan(
	span: PortableTextValueSpan,
	display: Exclude<ChineseContentDisplay, "original">,
): Promise<PortableTextValueSpan> {
	if (span.marks.includes("code")) return span;
	const text = await convertChineseContentText(span.text, display);
	return text === span.text ? span : { ...span, text };
}

function isPortableTextImageBlock(
	block: PortableTextValue[number],
): block is PortableTextImageBlock {
	return (
		block._type === "image" &&
		typeof block.assetId === "string" &&
		(block.alt === undefined || typeof block.alt === "string") &&
		(block.caption === undefined || typeof block.caption === "string")
	);
}

/**
 * Produces an immutable display projection. Mark definitions, links, mentions,
 * custom blocks, IDs and editor source data remain byte-for-byte unchanged.
 */
export async function convertChinesePortableText(
	value: PortableTextValue,
	display: ChineseContentDisplay,
): Promise<PortableTextValue> {
	if (display === "original") return value;

	return Promise.all(
		value.map(async (block) => {
			if (isPortableTextValueBlock(block)) {
				const children = await Promise.all(
					block.children.map((child) =>
						child._type === "span" ? convertSpan(child, display) : child,
					),
				);
				return children.every((child, index) => child === block.children[index])
					? block
					: { ...block, children };
			}
			if (!isPortableTextImageBlock(block)) return block;

			const [alt, caption] = await Promise.all([
				block.alt
					? convertChineseContentText(block.alt, display)
					: Promise.resolve(block.alt),
				block.caption
					? convertChineseContentText(block.caption, display)
					: Promise.resolve(block.caption),
			]);
			return alt === block.alt && caption === block.caption
				? block
				: { ...block, alt, caption };
		}),
	);
}
