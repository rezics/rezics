/** @vitest-environment jsdom */

import { cleanup, render } from "@testing-library/react";
import { Shelf, type ShelfItemSize } from "@rezics/ui/custom/shelf";
import { afterEach, describe, expect, it, vi } from "vitest";

class ResizeObserverMock implements ResizeObserver {
	disconnect() {}
	observe() {}
	unobserve() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);
vi.stubGlobal(
	"IntersectionObserver",
	class IntersectionObserverMock {
		disconnect() {}
		observe() {}
		unobserve() {}
	},
);

afterEach(cleanup);

const labels = {
	label: "Content shelf",
	previous: "Previous page",
	next: "Next page",
	page: ({ page, pageCount }: { readonly page: number; readonly pageCount: number }) =>
		`Page ${page} of ${pageCount}`,
	item: ({ item, itemCount }: { readonly item: number; readonly itemCount: number }) =>
		`Item ${item} of ${itemCount}`,
};

const sizeCases = [
	{ label: "the default", itemSize: undefined, maxInlineSizePixels: 208 },
	{ label: "small", itemSize: "sm", maxInlineSizePixels: 144 },
	{ label: "medium", itemSize: "md", maxInlineSizePixels: 208 },
	{ label: "large", itemSize: "lg", maxInlineSizePixels: 272 },
] satisfies readonly {
	readonly label: string;
	readonly itemSize: ShelfItemSize | undefined;
	readonly maxInlineSizePixels: number;
}[];

function renderShelf(itemSize?: ShelfItemSize, className?: string) {
	const { container } = render(
		<Shelf
			{...(className ? { className } : {})}
			{...(itemSize ? { itemSize } : {})}
			labels={labels}
		>
			<div>Only item</div>
		</Shelf>,
	);
	const shelf = container.querySelector('[data-slot="shelf"]');
	const carousel = container.querySelector('[data-slot="carousel"]');
	if (!(shelf instanceof HTMLElement)) throw new Error("Expected the shared Shelf root");
	if (!(carousel instanceof HTMLElement)) throw new Error("Expected the SharkUI carousel root");
	return { carousel, shelf };
}

describe("Zone unit-list shelf sizing", () => {
	it.each(sizeCases)(
		"caps a single item at $label density before container enhancement",
		({ itemSize, maxInlineSizePixels }) => {
			const { carousel } = renderShelf(itemSize);

			expect(carousel.style.getPropertyValue("--slides-per-page")).toBe("1");
			expect(carousel.style.getPropertyValue("--slide-item-size")).toBe(
				`min(100%, var(--shelf-item-max-inline-size, ${maxInlineSizePixels}px))`,
			);
			expect(carousel.querySelectorAll('[data-slot="carousel-item"]')).toHaveLength(1);
		},
	);

	it("retains the root custom-property override hook", () => {
		const { carousel, shelf } = renderShelf(undefined, "[--shelf-item-max-inline-size:18rem]");

		expect(shelf.classList.contains("[--shelf-item-max-inline-size:18rem]")).toBe(true);
		expect(carousel.style.getPropertyValue("--slide-item-size")).toContain(
			"var(--shelf-item-max-inline-size, 208px)",
		);
	});
});
