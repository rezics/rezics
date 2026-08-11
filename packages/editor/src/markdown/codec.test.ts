import MarkdownIt from "markdown-it";
import { describe, expect, it } from "vitest";
import { markdownToRezicsPortableText, rezicsPortableTextToMarkdown } from "./codec";
import { rezicsMarkdownDialect, rezicsMarkdownFeatureIds } from "./dialect";

function deterministicKeys(): () => string {
	let sequence = 0;
	return () => `key-${(sequence += 1)}`;
}

const semanticRenderer = new MarkdownIt({ html: true, linkify: true, typographer: false });

describe("REZICS Markdown codec", () => {
	it("exposes a runtime-immutable v1 dialect descriptor", () => {
		expect(Object.isFrozen(rezicsMarkdownDialect)).toBe(true);
		expect(Object.isFrozen(rezicsMarkdownDialect.mediaTypes)).toBe(true);
		expect(Object.isFrozen(rezicsMarkdownDialect.extensions)).toBe(true);
		expect(Object.isFrozen(rezicsMarkdownFeatureIds)).toBe(true);
	});

	it("converts the frozen CommonMark and GFM profile", () => {
		const markdown = [
			"# Document",
			"",
			"A **strong**, _soft_, ~~removed~~, and `coded` [link](https://example.com).",
			"",
			"- [x] checked",
			"- [ ] open",
			"",
			"```ts",
			"const answer = 42",
			"```",
			"",
			"| Name | Value |",
			"| :--- | ---: |",
			"| one | two |",
			"",
			'![Diagram](diagram.png "Diagram title")',
		].join("\n");

		const result = markdownToRezicsPortableText(markdown, {
			keyGenerator: deterministicKeys(),
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.diagnostics).toEqual([]);
		expect(result.value.some((block) => block._type === "table")).toBe(true);
		expect(result.value.some((block) => block._type === "code")).toBe(true);
		expect(JSON.stringify(result.value)).toContain('"listItem":"task"');
		expect(JSON.stringify(result.value)).toContain('"checked":true');

		const serialized = rezicsPortableTextToMarkdown(result.value);
		expect(serialized.ok).toBe(true);
		if (!serialized.ok) return;
		expect(serialized.value).toContain("# Document");
		expect(serialized.value).toContain("| Name | Value |");
		expect(serialized.value).toContain("- [x] checked");
	});

	it("preserves block HTML as inert Portable Text data", () => {
		const result = markdownToRezicsPortableText('<section data-kind="note">raw</section>', {
			keyGenerator: deterministicKeys(),
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toHaveLength(1);
		expect(result.value[0]).toMatchObject({
			_type: "html",
			html: '<section data-kind="note">raw</section>',
		});
		const serialized = rezicsPortableTextToMarkdown(result.value);
		expect(serialized).toMatchObject({ ok: true });
		if (serialized.ok)
			expect(serialized.value).toContain('<section data-kind="note">raw</section>');
	});

	it("blocks inline HTML instead of silently flattening it", () => {
		const result = markdownToRezicsPortableText("Use <kbd>Enter</kbd> to continue.");

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.diagnostics[0]).toMatchObject({
			code: "markdown.inline-html-unsupported",
			location: { kind: "markdown", line: 1 },
		});
	});

	it("distinguishes source breaks and separated container boundaries", () => {
		expect(markdownToRezicsPortableText("soft line\ncontinuation")).toMatchObject({
			ok: false,
			diagnostics: [{ code: "markdown.soft-break-rich-mode-unsupported" }],
		});
		expect(markdownToRezicsPortableText("hard line  \ncontinuation").ok).toBe(true);
		expect(markdownToRezicsPortableText("> first\n\n> second")).toMatchObject({
			ok: false,
			diagnostics: [
				{
					code: "markdown.structure-unsupported",
					details: { construct: "separate-adjacent-container" },
				},
			],
		});
	});

	it("keeps UTF-8 byte-order-mark documents in byte-preserving source mode", () => {
		const result = markdownToRezicsPortableText("\uFEFF# Heading");

		expect(result).toMatchObject({
			ok: false,
			diagnostics: [
				{
					code: "markdown.byte-order-mark-rich-mode-unsupported",
					location: { kind: "markdown", line: 1, column: 1 },
				},
			],
		});
	});

	it("rejects unknown Portable Text rather than invoking an upstream fallback", () => {
		const result = rezicsPortableTextToMarkdown([
			{ _type: "future-rezics-widget", _key: "future-1", payload: "keep me" },
		]);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.diagnostics[0]).toMatchObject({
			code: "portable-text.unknown-block-type",
			location: { kind: "portable-text", path: [0, "_type"] },
		});
	});

	it("rejects table shapes that GFM cannot round-trip", () => {
		const result = rezicsPortableTextToMarkdown([
			{
				_type: "table",
				_key: "table-1",
				headerRows: 2,
				rows: [],
			},
		]);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.diagnostics[0].code).toBe("portable-text.invalid-table");
	});

	it("escapes literal Markdown punctuation when rich text becomes source", () => {
		const source = [
			String.raw`\*literal\*`,
			"",
			String.raw`\# not heading`,
			"",
			String.raw`1\. not list`,
		].join("\n");
		const converted = markdownToRezicsPortableText(source, {
			keyGenerator: deterministicKeys(),
		});
		expect(converted.ok).toBe(true);
		if (!converted.ok) return;

		const serialized = rezicsPortableTextToMarkdown(converted.value);
		expect(serialized.ok).toBe(true);
		if (!serialized.ok) return;
		expect(serialized.value).toContain(String.raw`\*literal\*`);
		expect(serialized.value).toContain(String.raw`\# not heading`);
		expect(serialized.value).toContain(String.raw`1\. not list`);

		const reparsed = markdownToRezicsPortableText(serialized.value, {
			keyGenerator: deterministicKeys(),
		});
		expect(reparsed.ok).toBe(true);
		if (!reparsed.ok) return;
		expect(reparsed.value.map((block) => block._type)).toEqual(["block", "block", "block"]);
		expect(JSON.stringify(reparsed.value)).not.toContain('"listItem"');
		expect(JSON.stringify(reparsed.value)).not.toContain('"style":"h1"');
	});

	it("chooses safe delimiters for code containing backticks", () => {
		const source = ["````md", "```", "````", "", "Use ``a ` tick``."].join("\n");
		const converted = markdownToRezicsPortableText(source, {
			keyGenerator: deterministicKeys(),
		});
		expect(converted.ok).toBe(true);
		if (!converted.ok) return;

		const serialized = rezicsPortableTextToMarkdown(converted.value);
		expect(serialized.ok).toBe(true);
		if (!serialized.ok) return;
		const reparsed = markdownToRezicsPortableText(serialized.value, {
			keyGenerator: deterministicKeys(),
		});
		expect(reparsed.ok).toBe(true);
		if (!reparsed.ok) return;
		expect(reparsed.value[0]).toMatchObject({ _type: "code", code: "```" });
		expect(JSON.stringify(reparsed.value)).toContain('"text":"a ` tick"');
		expect(JSON.stringify(reparsed.value)).toContain('"marks":["code"]');
	});

	it("preserves valid custom link schemes instead of dropping annotations", () => {
		const converted = markdownToRezicsPortableText("[resource](rezics:unit/one)", {
			keyGenerator: deterministicKeys(),
		});
		expect(converted.ok).toBe(true);
		if (!converted.ok) return;
		const serialized = rezicsPortableTextToMarkdown(converted.value);
		expect(serialized).toMatchObject({
			ok: true,
			value: "[resource](rezics:unit/one)\n",
		});
	});

	it("serializes adjacent and nested decorators with parseable mark boundaries", () => {
		const source = "~~strike **bold**~~";
		const converted = markdownToRezicsPortableText(source, {
			keyGenerator: deterministicKeys(),
		});
		expect(converted.ok).toBe(true);
		if (!converted.ok) return;
		const serialized = rezicsPortableTextToMarkdown(converted.value);
		expect(serialized.ok).toBe(true);
		if (!serialized.ok) return;
		expect(semanticRenderer.render(serialized.value)).toBe(semanticRenderer.render(source));
	});

	it("normalizes formatted image labels to CommonMark alternative text", () => {
		const source = "![alt *literal*, **strong**, and `code` &amp; \\*](diagram.png)";
		const converted = markdownToRezicsPortableText(source, {
			keyGenerator: deterministicKeys(),
		});
		expect(converted.ok).toBe(true);
		if (!converted.ok) return;
		expect(converted.value[0]).toMatchObject({
			_type: "image",
			alt: "alt literal, strong, and code & *",
		});
		const serialized = rezicsPortableTextToMarkdown(converted.value);
		expect(serialized.ok).toBe(true);
		if (!serialized.ok) return;
		expect(semanticRenderer.render(serialized.value)).toBe(semanticRenderer.render(source));
	});

	it("blocks standard structures that the editable Portable Text profile cannot represent", () => {
		const ordered = markdownToRezicsPortableText("3. third");
		expect(ordered).toMatchObject({
			ok: false,
			diagnostics: [{ code: "markdown.ordered-list-start-unsupported" }],
		});

		const multiBlockItem = markdownToRezicsPortableText("- first paragraph\n\n  second paragraph");
		expect(multiBlockItem.ok).toBe(false);
		if (!multiBlockItem.ok)
			expect(
				multiBlockItem.diagnostics.some(
					(diagnostic) => diagnostic.code === "markdown.structure-unsupported",
				),
			).toBe(true);

		const complexQuote = markdownToRezicsPortableText("> # heading");
		expect(complexQuote).toMatchObject({
			ok: false,
			diagnostics: [{ code: "markdown.structure-unsupported" }],
		});

		const alert = markdownToRezicsPortableText("> [!NOTE]\n> Important");
		expect(alert.ok).toBe(false);
		if (!alert.ok)
			expect(alert.diagnostics[0]).toMatchObject({
				code: "markdown.structure-unsupported",
				details: { construct: "gfm-alert" },
			});

		const looseList = markdownToRezicsPortableText("- first\n\n- second");
		expect(looseList).toMatchObject({
			ok: false,
			diagnostics: [
				{ code: "markdown.structure-unsupported", details: { construct: "loose-list" } },
			],
		});

		const mixedTaskList = markdownToRezicsPortableText("- [ ] task\n- ordinary");
		expect(mixedTaskList).toMatchObject({
			ok: false,
			diagnostics: [
				{
					code: "markdown.structure-unsupported",
					details: { construct: "mixed-task-list" },
				},
			],
		});
	});

	it("round-trips simple blockquotes and nested lists", () => {
		const source = ["> first", ">", "> second", "", "- parent", "  - child"].join("\n");
		const converted = markdownToRezicsPortableText(source, {
			keyGenerator: deterministicKeys(),
		});
		expect(converted.ok).toBe(true);
		if (!converted.ok) return;
		const serialized = rezicsPortableTextToMarkdown(converted.value);
		expect(serialized.ok).toBe(true);
		if (!serialized.ok) return;
		expect(serialized.value).toContain("> first\n>\n> second");
		expect(serialized.value).toContain("- parent\n  - child");
		expect(markdownToRezicsPortableText(serialized.value).ok).toBe(true);
	});

	it("preserves rendered semantics across the accepted standard profile", () => {
		const examples = [
			"Heading\n=======\n\nA \\*literal\\* and **strong** value.",
			"> first\n>\n> second",
			"1. first\n2. second\n   - nested",
			"- [x] done\n- [ ] open",
			"````ts\nconst fence = '```'\n````",
			"Use ``a ` tick`` and [resource](rezics:unit/one).",
			'[reference][id]\n\n[id]: https://example.com/path "Title"',
			"| Left | Right |\n| :--- | ---: |\n| a \\| b | `x|y` |",
			'![Diagram](diagram.png "Diagram title")',
			'<section data-kind="note">raw</section>',
			"line one  \nline two\n\n---",
		];
		for (const source of examples) {
			const converted = markdownToRezicsPortableText(source, {
				keyGenerator: deterministicKeys(),
			});
			expect(converted.ok, source).toBe(true);
			if (!converted.ok) continue;
			const serialized = rezicsPortableTextToMarkdown(converted.value);
			expect(serialized.ok, source).toBe(true);
			if (!serialized.ok) continue;
			expect(semanticRenderer.render(serialized.value).trim(), source).toBe(
				semanticRenderer.render(source).trim(),
			);
		}
	});
});
