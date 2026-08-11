/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
	normalizePortableTextEditorValue,
	PortableTextEditor,
	type PortableTextEditorCapabilities,
} from "@rezics/ui/custom/portable-text-editor";
import { UiProvider } from "@rezics/ui/custom/ui-provider";
import { afterEach, describe, expect, it, vi } from "vitest";

const spoilerCapabilities = {
	spoilers: true,
} satisfies PortableTextEditorCapabilities;

const annotatedText = [
	{
		_key: "block-1",
		_type: "block",
		children: [
			{
				_key: "span-1",
				_type: "span",
				marks: ["strong", "link-1", "spoiler-1"],
				text: "Keep every character",
			},
		],
		markDefs: [
			{ _key: "link-1", _type: "link", href: "/safe" },
			{ _key: "spoiler-1", _type: "spoiler" },
		],
		style: "normal",
	},
];

vi.stubGlobal(
	"ResizeObserver",
	class ResizeObserverMock {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
);
vi.stubGlobal(
	"IntersectionObserver",
	class IntersectionObserverMock {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
);

afterEach(cleanup);

describe("Portable Text editor spoiler capabilities", () => {
	it("renders existing list blocks with list metadata and a content wrapper", async () => {
		const rendered = render(
			<UiProvider>
				<PortableTextEditor
					onChange={vi.fn()}
					value={[
						{
							_key: "list-1",
							_type: "block",
							children: [{ _key: "span-1", _type: "span", text: "First item", marks: [] }],
							markDefs: [],
							style: "normal",
							listItem: "bullet",
							level: 1,
						},
					]}
				/>
			</UiProvider>,
		);

		await waitFor(() => expect(rendered.container.textContent).toContain("First item"));
		const listItem = rendered.container.querySelector('[data-list-item="bullet"]');
		expect(listItem).not.toBeNull();
		expect(listItem?.getAttribute("data-level")).toBe("1");
		expect(listItem?.getAttribute("data-list-index")).toBe("1");
		expect(listItem?.querySelector(".pt-list-item-content")).not.toBeNull();
		rendered.unmount();
	});

	it("preserves spoiler annotations in an enabled editor", () => {
		const normalized = normalizePortableTextEditorValue(annotatedText, spoilerCapabilities);

		expect(normalized).toEqual([
			{
				_key: "block-1",
				_type: "block",
				children: [
					{
						_key: "span-1",
						_type: "span",
						marks: ["strong", "spoiler-1"],
						text: "Keep every character",
					},
				],
				markDefs: [
					{ _key: "link-1", _type: "link", href: "/safe" },
					{ _key: "spoiler-1", _type: "spoiler" },
				],
				style: "normal",
			},
		]);
	});

	it("downgrades pasted spoilers to ordinary text without losing other marks", () => {
		const normalized = normalizePortableTextEditorValue(annotatedText, undefined);

		expect(normalized).toEqual([
			{
				_key: "block-1",
				_type: "block",
				children: [
					{
						_key: "span-1",
						_type: "span",
						marks: ["strong", "link-1"],
						text: "Keep every character",
					},
				],
				markDefs: [{ _key: "link-1", _type: "link", href: "/safe" }],
				style: "normal",
			},
		]);
	});

	it("shows spoiler authoring only when the owner enables the capability", async () => {
		const onChange = vi.fn();
		const enabled = render(
			<UiProvider>
				<PortableTextEditor capabilities={spoilerCapabilities} onChange={onChange} value={[]} />
			</UiProvider>,
		);

		const spoilerTrigger = screen.getByRole("button", { name: "Mark as spoiler" });
		const linkTrigger = screen.getByRole("button", { name: "Add link" });
		expect(spoilerTrigger.getAttribute("data-scope")).toBe("popover");
		expect(spoilerTrigger.parentElement?.getAttribute("data-scope")).toBe("tooltip");
		expect(linkTrigger.getAttribute("data-scope")).toBe("popover");
		expect(linkTrigger.parentElement?.getAttribute("data-scope")).toBe("tooltip");
		fireEvent.click(spoilerTrigger);
		expect(await screen.findByText("Apply to")).not.toBeNull();
		enabled.unmount();

		render(
			<UiProvider>
				<PortableTextEditor onChange={onChange} value={[]} />
			</UiProvider>,
		);

		expect(screen.queryByRole("button", { name: "Mark as spoiler" })).toBeNull();
	});
});
