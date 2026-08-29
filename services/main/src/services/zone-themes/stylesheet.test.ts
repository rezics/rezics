import { generate, parse } from "css-tree";
import { describe, expect, it } from "vitest";

import {
	MaximumZoneThemeStylesheetBytes,
	ZoneThemeStylesheetRejected,
	reviewZoneThemeStylesheet,
} from "./stylesheet";

const AssetId = "019b0000-0000-7000-8000-000000000001";
const FirstRevisionId = "019b0000-0000-7000-8000-000000000002";
const SecondRevisionId = "019b0000-0000-7000-8000-000000000003";

function review(css: string, assetIds: readonly string[] = [], revisionId = FirstRevisionId) {
	return reviewZoneThemeStylesheet({ css, assetIds, revisionId });
}

function rejectionCodes(css: string, assetIds: readonly string[] = []): readonly string[] {
	try {
		review(css, assetIds);
		throw new Error("Expected stylesheet review to reject the source");
	} catch (error) {
		if (!(error instanceof ZoneThemeStylesheetRejected)) throw error;
		return error.issues.map(({ code }) => code);
	}
}

describe("Zone theme stylesheet review", () => {
	it("binds a semantic stylesheet to one revision and records reproducible evidence", () => {
		const css = `
			[data-block-type="unit-list"][data-layout="grid"] [data-part="item"] {
				color: #111111;
				background-color: #ffffff;
				background-image: url("/image-assets/${AssetId}/content");
			}
			@media (prefers-reduced-motion: no-preference) {
				.rezics-theme-featured > [data-part="item"] {
					transition: opacity 120ms ease;
				}
			}
		`;

		const first = review(css, [AssetId]);
		const second = review(css, [AssetId.toUpperCase()]);
		const otherRevision = review(css, [AssetId], SecondRevisionId);

		expect(first.transformedCss).toContain(
			`[data-zone-theme-scope="${FirstRevisionId}"] [data-block-type="unit-list"]`,
		);
		expect(first.automatedReview).toMatchObject({
			contractVersion: "3.0.0",
			rendererVersion: "1.10.0",
			ruleCount: 2,
			declarationCount: 4,
			sourceSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
			transformedSha256: first.sha256,
		});
		expect(second.sha256).toBe(first.sha256);
		expect(otherRevision.automatedReview.sourceSha256).toBe(first.automatedReview.sourceSha256);
		expect(otherRevision.sha256).not.toBe(first.sha256);
		expect(otherRevision.transformedCss).not.toContain(FirstRevisionId);
		expect(otherRevision.transformedCss).toContain(SecondRevisionId);
	});

	it.each([
		["reserved class", ".rezics-theme-featured { color: red }"],
		["class-anchored part", '.rezics-theme-featured > [data-part="content"] { color: red }'],
		["rich-text heading", "[data-portable-text] h2 { color: red }"],
		["functional rich-text list", "[data-portable-text] :is(h2, h3):first-of-type { color: red }"],
		[
			"relational rich-text selector",
			"[data-portable-text]:has(> p) > p:last-of-type { color: red }",
		],
		["rich-text marker", "[data-portable-text] li:nth-of-type(2)::marker { color: red }"],
		[
			"published pseudo-elements",
			"[data-portable-text] p::first-line, [data-portable-text] a::selection { color: red }",
		],
		[
			"surface and hook",
			'[data-zone-surface="dock"] .rezics-theme-navigation:any-link { color: red }',
		],
	] as const)("accepts %s", (_name, css) => {
		expect(() => review(css)).not.toThrow();
	});

	it.each([
		["unpublished class", ".private { color: red }", "unpublished_class"],
		["ID selector", "#private { color: red }", "id_selector"],
		["unpublished element", "body { color: red }", "unsupported_type_selector"],
		["universal selector", "* { color: red }", "universal_selector"],
		["unanchored rich-text element", "h2 { color: red }", "unanchored_type_selector"],
		[
			"private rich-text variant",
			'[data-portable-text="article"] h2 { color: red }',
			"private_rich_text_variant",
		],
		["class hidden in is", ".rezics-theme-safe:is(.private) { color: red }", "unpublished_class"],
		["ID hidden in not", ".rezics-theme-safe:not(#private) { color: red }", "id_selector"],
		[
			"type hidden in has",
			".rezics-theme-safe:has(body) { color: red }",
			"unsupported_type_selector",
		],
		["unanchored part", '[data-part="item"] { color: red }', "unanchored_block_part"],
		[
			"mismatched part",
			'[data-block-type="divider"][data-part="title"] { color: red }',
			"part_block_mismatch",
		],
		[
			"unknown state",
			'[data-block-type="unit-list"][data-layout="masonry"] { color: red }',
			"unsupported_state",
		],
		["unknown attribute", "[data-private=value] { color: red }", "unsupported_attribute"],
		["at-rule", '@import url("https://example.com/theme.css");', "unsupported_at_rule"],
		[
			"unapproved external URL",
			'[data-block-type="url-image"] { background: url("https://example.com/a.png") }',
			"unapproved_url",
		],
		[
			"undeclared platform asset",
			`[data-block-type="image"] { background: url("/image-assets/${AssetId}/content") }`,
			"unapproved_url",
		],
		[
			"generated copy",
			'[data-block-type="unit-ref"]::before { content: "spoofed" }',
			"unsafe_content",
		],
		[
			"removed focus indicator",
			'[data-block-type="unit-ref"]:focus { outline: none }',
			"focus_outline_removed",
		],
		[
			"low contrast",
			'[data-block-type="unit-ref"] { color: #777777; background: #888888 }',
			"insufficient_contrast",
		],
		[
			"unguarded motion",
			'[data-block-type="unit-ref"] { transition: opacity 1s }',
			"unguarded_motion",
		],
	] as const)("rejects %s", (_name, css, code) => {
		expect(rejectionCodes(css)).toContain(code);
	});

	it("rejects malformed CSS instead of accepting a recovered fragment", () => {
		const css = `[data-block-type="unit-ref" { color: red }
			.rezics-theme-valid { color: blue }`;

		const codes = rejectionCodes(css);
		expect(codes.some((code) => code === "parse_error" || code === "unparsed_css")).toBe(true);
	});

	it("scope-transforms selector lists, nested conditions, and functional selectors", () => {
		const selectors = [
			'.rezics-theme-card[data-block-type="unit-ref"]',
			'.rezics-theme-grid > [data-part="item"]',
			"[data-portable-text] :is(h2, h3)",
			"[data-portable-text]:has(> figure) > figure",
		] as const;
		const conditions = [
			(css: string) => css,
			(css: string) => `@media (min-width: 20rem) { ${css} }`,
			(css: string) => `@supports (display: grid) { ${css} }`,
			(css: string) => `@container (min-width: 20rem) { ${css} }`,
		] as const;

		for (let index = 0; index < 64; index += 1) {
			const left = selectors[index % selectors.length]!;
			const right = selectors[(index * 3 + 1) % selectors.length]!;
			const css = conditions[index % conditions.length]!(`${left}, ${right} { color: red }`);
			const transformed = review(css).transformedCss;
			const root = parse(transformed);
			expect(root.type).toBe("StyleSheet");
			expect(generate(root)).toContain(`[data-zone-theme-scope="${FirstRevisionId}"]`);
		}
	});

	it("enforces the source byte budget before transformation", () => {
		const css = " ".repeat(MaximumZoneThemeStylesheetBytes + 1);

		expect(rejectionCodes(css)).toContain("stylesheet_too_large");
	});
});
