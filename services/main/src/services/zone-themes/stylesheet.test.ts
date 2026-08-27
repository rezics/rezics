import { describe, expect, it } from "vitest";

import {
	MaximumZoneThemeStylesheetBytes,
	ZoneThemeStylesheetRejected,
	reviewZoneThemeStylesheet,
} from "./stylesheet";

const AssetId = "019b0000-0000-7000-8000-000000000001";

function rejectionCodes(css: string, assetIds: readonly string[] = []): readonly string[] {
	try {
		reviewZoneThemeStylesheet({ css, assetIds });
		throw new Error("Expected stylesheet review to reject the source");
	} catch (error) {
		if (!(error instanceof ZoneThemeStylesheetRejected)) throw error;
		return error.issues.map(({ code }) => code);
	}
}

describe("Zone theme stylesheet review", () => {
	it("scopes a semantic stylesheet and produces stable review evidence", () => {
		const css = `
			[data-block-type="unit-list"][data-layout="grid"] [data-part="item"] {
				color: #111111;
				background-color: #ffffff;
				background-image: url("/image-assets/${AssetId}/content");
			}
			@media (prefers-reduced-motion: no-preference) {
				[data-block-type="unit-list"][data-part="item"] {
					transition: opacity 120ms ease;
				}
			}
		`;

		const first = reviewZoneThemeStylesheet({ css, assetIds: [AssetId] });
		const second = reviewZoneThemeStylesheet({ css, assetIds: [AssetId.toUpperCase()] });

		expect(first.transformedCss).toContain('[data-zone-theme-scope] [data-block-type="unit-list"]');
		expect(first.automatedReview).toMatchObject({
			contractVersion: "2.0.0",
			ruleCount: 2,
			selectorCount: 2,
			declarationCount: 4,
		});
		expect(second.sha256).toBe(first.sha256);
	});

	it.each([
		["private class", ".private { color: red }", "private_selector"],
		["element selector", "body { color: red }", "private_selector"],
		["universal selector", "* { color: red }", "universal_selector"],
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
	] as const)("rejects %s selectors and declarations", (_name, css, code) => {
		expect(rejectionCodes(css)).toContain(code);
	});

	it("enforces the source byte budget before transformation", () => {
		const css = " ".repeat(MaximumZoneThemeStylesheetBytes + 1);

		expect(rejectionCodes(css)).toContain("stylesheet_too_large");
	});
});
