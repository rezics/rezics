import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PortableTextContent } from "@rezics/ui";

const linkedText = [
	{
		_key: "block-1",
		_type: "block",
		children: [
			{
				_key: "span-1",
				_type: "span",
				marks: ["link-1"],
				text: "Linked text",
			},
		],
		markDefs: [{ _key: "link-1", _type: "link", href: "https://example.com" }],
		style: "normal",
	},
];

describe("Portable Text content links", () => {
	it("keeps feed previews inert inside their surrounding card link", () => {
		const markup = renderToStaticMarkup(
			<PortableTextContent value={linkedText} variant="preview" />,
		);

		expect(markup).toContain("Linked text");
		expect(markup).not.toContain("<a");
	});

	it("keeps links interactive in full article content", () => {
		const markup = renderToStaticMarkup(
			<PortableTextContent value={linkedText} variant="article" />,
		);

		expect(markup).toContain('<a href="https://example.com">Linked text</a>');
	});
});
