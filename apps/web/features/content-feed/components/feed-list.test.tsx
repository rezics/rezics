/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FeedListItems } from "./feed-list";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

describe("FeedListItems", () => {
	it("lays cards out with responsive spacing and no separator elements", () => {
		render(
			<FeedListItems aria-label="Test feed">
				<article>First card</article>
				<article>Second card</article>
			</FeedListItems>,
		);

		const feed = screen.getByRole("feed", { name: "Test feed" });
		expect(feed.classList.contains("grid")).toBe(true);
		expect(feed.classList.contains("gap-3")).toBe(true);
		expect(feed.classList.contains("sm:gap-4")).toBe(true);
		expect(feed.children).toHaveLength(2);
		expect(feed.querySelector('[data-slot="separator"]')).toBeNull();
	});
});
