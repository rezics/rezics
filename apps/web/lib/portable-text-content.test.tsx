/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

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

const spoilerText = [
	{
		_key: "block-1",
		_type: "block",
		children: [
			{
				_key: "span-1",
				_type: "span",
				marks: ["spoiler-1"],
				text: "The ending is searchable",
			},
		],
		markDefs: [
			{
				_key: "spoiler-1",
				_type: "spoiler",
				scopeUnitId: "019f73cb-926e-7e50-9a7f-da67701accb3",
			},
		],
		style: "normal",
	},
];

afterEach(cleanup);

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

describe("Portable Text content spoilers", () => {
	it("uses an inert mask in previews without rendering the concealed text", () => {
		const markup = renderToStaticMarkup(
			<PortableTextContent value={spoilerText} variant="preview" />,
		);

		expect(markup).toContain('data-spoiler-state="preview"');
		expect(markup).toContain("Spoiler content");
		expect(markup).not.toContain("The ending is searchable");
		expect(markup).not.toContain("<button");
	});

	it("reveals once and leaves the revealed text natively selectable", () => {
		const presentations = new Map([
			[
				"019f73cb-926e-7e50-9a7f-da67701accb3",
				{
					id: "019f73cb-926e-7e50-9a7f-da67701accb3",
					kind: "entity",
					label: "Example Story",
				},
			],
		]);
		const { container } = render(
			<PortableTextContent
				unitMentionPresentations={presentations}
				value={spoilerText}
				variant="article"
			/>,
		);

		const reveal = screen.getByRole("button", {
			name: "Show Example Story spoiler",
		});
		const concealedContent = screen.getByText("The ending is searchable");
		expect(concealedContent.hasAttribute("hidden")).toBe(true);
		expect(reveal.getAttribute("aria-controls")).toBe(concealedContent.id);
		expect(container.querySelector('[data-spoiler-state="concealed"]')).not.toBeNull();

		fireEvent.click(reveal);

		expect(screen.queryByRole("button", { name: "Show Example Story spoiler" })).toBeNull();
		expect(screen.getByText("The ending is searchable").hasAttribute("hidden")).toBe(false);
		expect(document.activeElement).toBe(screen.getByText("The ending is searchable"));
		expect(container.querySelector('[data-spoiler-state="revealed"]')).not.toBeNull();
	});
});
