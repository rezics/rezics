/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FeedList, FeedListItems } from "./feed-list";

vi.mock("@/i18n/client", () => {
	return {
		useTranslation: () => ({
			t: {
				actions: { loadMore: "Load more", retry: "Retry" },
				state: { error: "Error" },
			},
		}),
	};
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

	it("marks the Feed busy while another page is appended", () => {
		render(
			<FeedList
				aria-label="Test feed"
				continuation={{
					mode: "infinite",
					state: { status: "loading" },
				}}
				emptyBody="Empty"
				emptyTitle="Empty"
				errorLabel="Error"
				getItemKey={(item) => item}
				renderItem={(item) => <article>{item}</article>}
				retryLabel="Retry"
				state={{ status: "ready", items: ["First card"] }}
			/>,
		);

		expect(screen.getByRole("feed", { name: "Test feed" }).getAttribute("aria-busy")).toBe(
			"true",
		);
	});

	it("does not impose a scroll container on an infinite feed", () => {
		const view = render(
			<FeedList
				aria-label="Test feed"
				continuation={{
					mode: "infinite",
					state: { status: "loading" },
				}}
				emptyBody="Empty"
				emptyTitle="Empty"
				errorLabel="Error"
				getItemKey={(item) => item}
				renderItem={(item) => <article>{item}</article>}
				retryLabel="Retry"
				state={{ status: "ready", items: ["First card"] }}
			/>,
		);

		expect(view.container.querySelector('[data-slot="feed-scroll-viewport"]')).toBeNull();
		expect(screen.queryByRole("region", { name: "Test feed" })).toBeNull();
	});

	it("keeps continuation available when every currently loaded item is hidden", () => {
		const loadNext = vi.fn();
		render(
			<FeedList
				aria-label="Test feed"
				continuation={{ mode: "load-more", state: { status: "ready", loadNext } }}
				emptyBody="Empty"
				emptyTitle="Empty"
				errorLabel="Error"
				getItemKey={(item) => item}
				renderItem={(item) => <article>{item}</article>}
				retryLabel="Retry"
				state={{ status: "ready", items: [] }}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Load more" }));
		expect(loadNext).toHaveBeenCalledOnce();
	});

	it("preserves loaded items when fetching the next page fails", () => {
		const retry = vi.fn();
		render(
			<FeedList
				aria-label="Test feed"
				continuation={{
					mode: "infinite",
					state: { status: "error", retry },
				}}
				emptyBody="Empty"
				emptyTitle="Empty"
				errorLabel="Error"
				getItemKey={(item) => item}
				renderItem={(item) => <article>{item}</article>}
				retryLabel="Retry"
				state={{ status: "ready", items: ["Loaded card"] }}
			/>,
		);

		expect(screen.getByRole("article").textContent).toBe("Loaded card");
		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		expect(retry).toHaveBeenCalledOnce();
	});
});
