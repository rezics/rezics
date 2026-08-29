export interface MarkdownOutlineItem {
	readonly level: number;
	readonly title: string;
	readonly ordinal: number;
	/** 1-based source line of the heading text. */
	readonly line: number;
	/** Inclusive UTF-16 offset of the heading text line. */
	readonly from: number;
}

export interface MarkdownDocumentAnalysis {
	readonly characters: number;
	readonly words: number;
	readonly lines: number;
	readonly headings: number;
	readonly readingMinutes: number;
	readonly outline: readonly MarkdownOutlineItem[];
}

interface SourceLine {
	readonly text: string;
	readonly from: number;
	readonly line: number;
}

const wordsPerReadingMinute = 200;

function sourceLines(source: string): readonly SourceLine[] {
	const lines: SourceLine[] = [];
	let offset = 0;
	let line = 1;
	while (true) {
		const lineFeed = source.indexOf("\n", offset);
		const breakAt = lineFeed === -1 ? source.length : lineFeed;
		const hasCarriageReturn = breakAt > offset && source.charCodeAt(breakAt - 1) === 13;
		const contentEnd = hasCarriageReturn ? breakAt - 1 : breakAt;
		lines.push({
			text: source.slice(offset, contentEnd),
			from: offset,
			line,
		});
		if (lineFeed === -1) return lines;
		offset = lineFeed + 1;
		line += 1;
	}
}

function sourceOutline(lines: readonly SourceLine[]): readonly MarkdownOutlineItem[] {
	const outline: MarkdownOutlineItem[] = [];
	let fence: { readonly marker: "`" | "~"; readonly length: number } | undefined;
	for (let index = 0; index < lines.length; index += 1) {
		const current = lines[index];
		if (!current) continue;
		if (fence) {
			const closing = /^ {0,3}(`+|~+)[ \t]*$/u.exec(current.text)?.[1];
			if (closing?.startsWith(fence.marker) && closing.length >= fence.length) fence = undefined;
			continue;
		}
		const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(current.text);
		if (opening?.[1] && !(opening[1].startsWith("`") && opening[2]?.includes("`"))) {
			fence = {
				marker: opening[1].startsWith("`") ? "`" : "~",
				length: opening[1].length,
			};
			continue;
		}
		if (/^(?: {4}|\t)/u.test(current.text)) continue;

		const atx = /^ {0,3}(#{1,6})(?:[ \t]+(.*)|[ \t]*)$/u.exec(current.text);
		const rawAtxTitle = atx?.[2]?.replace(/[ \t]+#+[ \t]*$/u, "").trim();
		if (atx?.[1] && rawAtxTitle) {
			outline.push({
				level: atx[1].length,
				title: rawAtxTitle,
				ordinal: outline.length,
				line: current.line,
				from: current.from,
			});
			continue;
		}
		const underline = lines[index + 1];
		const setext = underline ? /^ {0,3}(=+|-+)[ \t]*$/u.exec(underline.text) : null;
		if (current.text.trim() && setext?.[1]) {
			outline.push({
				level: setext[1].startsWith("=") ? 1 : 2,
				title: current.text.trim(),
				ordinal: outline.length,
				line: current.line,
				from: current.from,
			});
			index += 1;
		}
	}
	return outline;
}

export function analyzeMarkdownDocument(source: string, locale: string): MarkdownDocumentAnalysis {
	const lines = sourceLines(source);
	let words = 0;
	if (typeof Intl.Segmenter === "function") {
		const segments = new Intl.Segmenter(locale, { granularity: "word" }).segment(source);
		for (const segment of segments) if (segment.isWordLike) words += 1;
	} else {
		words = source.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
	}
	const outline = sourceOutline(lines);
	return {
		characters: [...source].length,
		words,
		lines: lines.length,
		headings: outline.length,
		readingMinutes: words === 0 ? 0 : Math.max(1, Math.round(words / wordsPerReadingMinute)),
		outline,
	};
}

/** Last heading at or above the cursor line, if the document has any headings. */
export function activeOutlineOrdinal(
	outline: readonly MarkdownOutlineItem[],
	line: number,
): number | undefined {
	let current: number | undefined;
	for (const item of outline) {
		if (item.line <= line) current = item.ordinal;
		else break;
	}
	return current;
}
