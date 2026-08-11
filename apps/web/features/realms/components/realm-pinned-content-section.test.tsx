/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RealmPinnedContentSection } from "./realm-pinned-content-section";

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
vi.stubGlobal("matchMedia", (query: string) => ({
	matches: false,
	media: query,
	onchange: null,
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
	addListener: vi.fn(),
	removeListener: vi.fn(),
	dispatchEvent: vi.fn(),
}));
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

afterEach(cleanup);

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
