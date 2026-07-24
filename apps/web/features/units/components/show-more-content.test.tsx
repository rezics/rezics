/** @vitest-environment jsdom */

import { ShowMoreContent } from "@rezics/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal(
	"ResizeObserver",
	class ResizeObserverMock implements ResizeObserver {
		constructor(private readonly callback: ResizeObserverCallback) {}

		observe(_target: Element, _options?: ResizeObserverOptions) {
			this.callback([], this);
		}

		disconnect() {}
		unobserve(_target: Element) {}
	},
);

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("ShowMoreContent", () => {
	it("shows localized controls for overflowing content and exposes its expanded state", async () => {
		vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(220);
		vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(128);

		render(
			<ShowMoreContent showLessLabel="顯示較少" showMoreLabel="顯示更多">
				<p>Long description</p>
			</ShowMoreContent>,
		);

		const expand = await screen.findByRole("button", { name: "顯示更多" });
		expect(expand.getAttribute("aria-expanded")).toBe("false");
		expect(document.getElementById(expand.getAttribute("aria-controls") ?? "")).toBeTruthy();

		fireEvent.click(expand);

		const collapse = screen.getByRole("button", { name: "顯示較少" });
		expect(collapse.getAttribute("aria-expanded")).toBe("true");
	});

	it("does not render a disclosure control when the content fits", () => {
		vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(96);
		vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(96);

		render(
			<ShowMoreContent showLessLabel="Show less" showMoreLabel="Show more">
				<p>Short description</p>
			</ShowMoreContent>,
		);

		expect(screen.queryByRole("button")).toBeNull();
	});
});
