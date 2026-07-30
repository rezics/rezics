/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FeedList, FeedListItems } from "./feed-list";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

afterEach(cleanup);

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

	it("passes the known result-set size to every Feed item", () => {
		render(
			<FeedList
				aria-label="Test feed"
				emptyBody="Empty"
				emptyTitle="Empty"
				errorLabel="Error"
				getItemKey={(item) => item}
				renderItem={(item, metadata) => (
					<article aria-posinset={metadata.position} aria-setsize={metadata.setSize}>
						{item}
					</article>
				)}
				retryLabel="Retry"
				setSize={4_727}
				state={{ status: "ready", items: ["First card", "Second card"] }}
			/>,
		);

		const articles = screen.getAllByRole("article");
		expect(
			articles.map((article) => ({
				position: article.getAttribute("aria-posinset"),
				setSize: article.getAttribute("aria-setsize"),
			})),
		).toEqual([
			{ position: "1", setSize: "4727" },
			{ position: "2", setSize: "4727" },
		]);
	});
});
