/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RealmPinnedContentSection } from "./realm-pinned-content-section";

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			ui: {
				shelf: {
					item: ({ item, itemCount }: { item: number; itemCount: number }) =>
						`Item ${item} of ${itemCount}`,
					page: ({ page, pageCount }: { page: number; pageCount: number }) =>
						`Page ${page} of ${pageCount}`,
				},
			},
		},
	}),
}));

const resizeObservers: ResizeObserverMock[] = [];

class ResizeObserverMock implements ResizeObserver {
	readonly targets = new Set<Element>();

	constructor(private readonly callback: ResizeObserverCallback) {
		resizeObservers.push(this);
	}

	disconnect() {
		this.targets.clear();
	}

	observe(target: Element) {
		this.targets.add(target);
	}

	unobserve(target: Element) {
		this.targets.delete(target);
	}

	resize(target: Element, width: number) {
		const entry = {
			borderBoxSize: [],
			contentBoxSize: [],
			contentRect: new DOMRect(0, 0, width, 0),
			devicePixelContentBoxSize: [],
			target,
		} satisfies ResizeObserverEntry;
		this.callback([entry], this);
	}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);
vi.stubGlobal(
	"IntersectionObserver",
	class IntersectionObserverMock {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
);
let reduceMotion = false;
const matchMedia = vi.fn((query: string) => ({
	matches: reduceMotion,
	media: query,
	onchange: null,
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
	addListener: vi.fn(),
	removeListener: vi.fn(),
	dispatchEvent: vi.fn(),
}));
vi.stubGlobal("matchMedia", matchMedia);
vi.stubGlobal(
	"PointerEvent",
	class PointerEventMock extends MouseEvent {
		readonly isPrimary: boolean;
		readonly pointerId: number;

		constructor(
			type: string,
			init: MouseEventInit & {
				readonly isPrimary?: boolean;
				readonly pointerId?: number;
			} = {},
		) {
			super(type, init);
			this.isPrimary = init.isPrimary ?? false;
			this.pointerId = init.pointerId ?? 0;
		}
	},
);

const scrollTo = vi.fn();
Object.defineProperty(HTMLElement.prototype, "scrollTo", {
	configurable: true,
	value: scrollTo,
});

afterEach(() => {
	cleanup();
	resizeObservers.length = 0;
	reduceMotion = false;
	matchMedia.mockClear();
	scrollTo.mockClear();
});

const labels = {
	emptyLabel: "No pinned content yet.",
	nextLabel: "Next pinned content",
	previousLabel: "Previous pinned content",
	title: "Pinned content",
	untitledLabel: "Untitled",
} as const;
const contentItems = [
	{
		id: "unit-1",
		href: "/units/book/unit-1",
		title: "The pinned book",
		summary: "A meaningful preview of the pinned content.",
	},
	{
		id: "unit-2",
		href: "/units/book/unit-2",
		title: "The second pinned book",
	},
	{
		id: "unit-3",
		href: "/units/book/unit-3",
		title: "The third pinned book",
	},
	{
		id: "unit-4",
		href: "/units/book/unit-4",
		title: "The fourth pinned book",
	},
] as const;

function resizeShelf(container: HTMLElement, width: number): HTMLElement {
	const shelf = container.querySelector('[data-slot="shelf"]');
	if (!(shelf instanceof HTMLElement)) throw new Error("Expected the shared Shelf root");
	const group = shelf.querySelector('[data-slot="carousel-group"]');
	if (!(group instanceof HTMLElement)) throw new Error("Expected the Shelf item group");
	const items = Array.from(group.querySelectorAll('[data-slot="carousel-item"]'));
	const slidesPerPage = Math.min(items.length, Math.max(1, Math.floor((width + 12) / (208 + 12))));
	const itemWidth = (width - 12 * (slidesPerPage - 1)) / slidesPerPage;
	const scrollWidth = itemWidth * items.length + 12 * Math.max(0, items.length - 1);
	const rect = (left: number, rectWidth: number) => new DOMRect(left, 0, rectWidth, 100);

	Object.defineProperties(group, {
		offsetHeight: { configurable: true, value: 100 },
		offsetWidth: { configurable: true, value: width },
		scrollHeight: { configurable: true, value: 100 },
		scrollWidth: { configurable: true, value: scrollWidth },
	});
	Object.defineProperty(group, "getBoundingClientRect", {
		configurable: true,
		value: () => rect(0, width),
	});
	items.forEach((item, index) => {
		Object.defineProperty(item, "getBoundingClientRect", {
			configurable: true,
			value: () => rect(index * (itemWidth + 12), itemWidth),
		});
	});
	const observer = resizeObservers.find(({ targets }) => targets.has(shelf));
	if (!observer) throw new Error("Expected the shared Shelf to be observed");

	act(() => observer.resize(shelf, width));
	const groupObserver = resizeObservers.find(({ targets }) => targets.has(group));
	if (groupObserver) act(() => groupObserver.resize(group, width));
	return shelf;
}

describe("RealmPinnedContentSection", () => {
	it("uses a transparent disclosure row and remains available when empty", () => {
		const { container } = render(
			<RealmPinnedContentSection {...labels} state={{ status: "ready", items: [] }} />,
		);
		const trigger = screen.getByRole("button", { name: "Pinned content" });

		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		expect(trigger.getAttribute("data-variant")).toBe("ghost");
		expect(trigger.querySelector(".lucide-pin")).not.toBeNull();
		expect(screen.getByText("No pinned content yet.")).toBeTruthy();
		expect(container.querySelector('[data-slot="card"]')).toBeNull();

		fireEvent.click(trigger);

		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByText("No pinned content yet.")).toBeNull();
	});

	it("reserves cards for actual content previews", () => {
		const { container } = render(
			<RealmPinnedContentSection
				{...labels}
				state={{
					status: "ready",
					items: contentItems,
				}}
			/>,
		);

		expect(screen.getByText("The pinned book").closest("a")?.getAttribute("href")).toBe(
			"/units/book/unit-1",
		);
		resizeShelf(container, 460);
		expect(screen.getByText("A meaningful preview of the pinned content.")).toBeTruthy();
		expect(container.querySelector('[data-slot="carousel"]')).not.toBeNull();
		expect(container.querySelectorAll('[data-slot="carousel-item"]')).toHaveLength(4);
		const previous = screen.getByRole("button", { name: "Previous pinned content" });
		const next = screen.getByRole("button", { name: "Next pinned content" });
		expect(previous.getAttribute("data-variant")).toBe("secondary");
		expect(next.getAttribute("data-variant")).toBe("secondary");
		expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(4);
		expect(screen.queryByText("Pinned")).toBeNull();
		expect(screen.queryByText("Position")).toBeNull();
	});

	it("derives its page size from the shelf container and retains the CSS snap base", async () => {
		const { container } = render(
			<RealmPinnedContentSection {...labels} state={{ status: "ready", items: contentItems }} />,
		);
		const shelf = resizeShelf(container, 460);
		const carousel = shelf.querySelector('[data-slot="carousel"]');
		const group = shelf.querySelector('[data-slot="carousel-group"]');
		if (!(carousel instanceof HTMLElement)) throw new Error("Expected the SharkUI carousel root");

		await waitFor(() => expect(carousel.style.getPropertyValue("--slides-per-page")).toBe("2"));
		expect(group?.classList.contains("overflow-x-auto")).toBe(true);
		expect(group?.classList.contains("snap-x")).toBe(true);
		expect(shelf.querySelectorAll('[data-slot="carousel-item"].snap-start')).toHaveLength(4);
		expect(
			Array.from(shelf.querySelectorAll('[data-slot="carousel-item"]'), (item) =>
				item.getAttribute("aria-label"),
			),
		).toEqual(["Item 1 of 4", "Item 2 of 4", "Item 3 of 4", "Item 4 of 4"]);
		expect(shelf.querySelectorAll('[data-slot="carousel-indicator"]')).toHaveLength(2);
		expect(screen.getByRole("button", { name: "Page 1 of 2" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Page 2 of 2" })).toBeTruthy();

		resizeShelf(container, 900);

		await waitFor(() => expect(carousel.style.getPropertyValue("--slides-per-page")).toBe("4"));
		await waitFor(() =>
			expect(shelf.querySelectorAll('[data-slot="carousel-indicator"]')).toHaveLength(0),
		);
		expect(screen.queryByRole("button", { name: "Previous pinned content" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Next pinned content" })).toBeNull();
	});

	it("makes reduced-motion control navigation instant", async () => {
		const { container } = render(
			<RealmPinnedContentSection {...labels} state={{ status: "ready", items: contentItems }} />,
		);
		resizeShelf(container, 460);
		const next = await screen.findByRole("button", { name: "Next pinned content" });

		scrollTo.mockClear();
		reduceMotion = true;
		fireEvent.click(next);

		expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
		await waitFor(() =>
			expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "instant" })),
		);
	});

	it("suppresses card activation after a mouse drag but preserves ordinary clicks", () => {
		render(
			<RealmPinnedContentSection {...labels} state={{ status: "ready", items: contentItems }} />,
		);
		const title = screen.getByText("The pinned book");
		const link = title.closest("a");
		const clickListener = vi.fn((event: Event) => event.preventDefault());
		const carouselContent = title.closest('[data-slot="carousel-group"]');

		expect(link).not.toBeNull();
		expect(carouselContent).not.toBeNull();
		link?.addEventListener("click", clickListener);

		fireEvent.pointerDown(title, {
			clientX: 120,
			clientY: 20,
			isPrimary: true,
			pointerId: 1,
		});
		fireEvent.pointerMove(carouselContent as Element, {
			clientX: 80,
			clientY: 20,
			isPrimary: true,
			pointerId: 1,
		});
		fireEvent.pointerUp(carouselContent as Element, {
			clientX: 80,
			clientY: 20,
			isPrimary: true,
			pointerId: 1,
		});
		fireEvent.click(link as HTMLAnchorElement);

		expect(clickListener).not.toHaveBeenCalled();

		fireEvent.click(link as HTMLAnchorElement);

		expect(clickListener).toHaveBeenCalledOnce();
	});
});
