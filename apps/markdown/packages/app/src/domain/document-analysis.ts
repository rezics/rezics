export interface MarkdownOutlineItem {
	readonly level: number;
	readonly title: string;
	readonly ordinal: number;
}

function sourceOutline(source: string): readonly MarkdownOutlineItem[] {
	const lines = source.split(/\r?\n/u);
	const outline: MarkdownOutlineItem[] = [];
	let fence: { readonly marker: "`" | "~"; readonly length: number } | undefined;
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
		if (fence) {
			const closing = /^ {0,3}(`+|~+)[ \t]*$/u.exec(line)?.[1];
			if (closing?.startsWith(fence.marker) && closing.length >= fence.length) fence = undefined;
			continue;
		}
		const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(line);
		if (opening?.[1] && !(opening[1].startsWith("`") && opening[2]?.includes("`"))) {
			fence = {
				marker: opening[1].startsWith("`") ? "`" : "~",
				length: opening[1].length,
			};
			continue;
		}
		if (/^(?: {4}|\t)/u.test(line)) continue;

		const atx = /^ {0,3}(#{1,6})(?:[ \t]+(.*)|[ \t]*)$/u.exec(line);
		const rawAtxTitle = atx?.[2]?.replace(/[ \t]+#+[ \t]*$/u, "").trim();
		if (atx?.[1] && rawAtxTitle) {
			outline.push({
				level: atx[1].length,
				title: rawAtxTitle,
				ordinal: outline.length,
			});
			continue;
		}
		const underline = /^ {0,3}(=+|-+)[ \t]*$/u.exec(lines[index + 1] ?? "");
		if (line.trim() && underline?.[1]) {
			outline.push({
				level: underline[1].startsWith("=") ? 1 : 2,
				title: line.trim(),
				ordinal: outline.length,
			});
			index += 1;
		}
	}
	return outline;
}

export function analyzeMarkdownDocument(
	source: string,
	locale: string,
): {
	readonly characters: number;
	readonly words: number;
	readonly outline: readonly MarkdownOutlineItem[];
} {
	let words = 0;
	if (typeof Intl.Segmenter === "function") {
		const segments = new Intl.Segmenter(locale, { granularity: "word" }).segment(source);
		for (const segment of segments) if (segment.isWordLike) words += 1;
	} else {
		words = source.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
	}
	return {
		characters: [...source].length,
		words,
		outline: sourceOutline(source),
	};
}
