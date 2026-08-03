/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiFeedListProps } from "@/features/content-feed/data/api-feed-list";
import { Home } from "./home";

vi.mock("nuqs", () => ({
	useQueryState: (key: string) => [key === "sort" ? "best" : [], vi.fn()],
}));

vi.mock("@/features/content-feed/data/api-feed-list", () => ({
	ApiFeedList: (props: ApiFeedListProps) => (
		<div data-pagination={props.pagination} data-testid="home-feed" />
	),
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({ t: { feed: { title: "Feed" } } }),
}));

afterEach(cleanup);

describe("Home", () => {
	it("keeps the infinite feed in the document scroll flow", () => {
		const view = render(<Home />);

		expect(screen.getByTestId("home-feed").getAttribute("data-pagination")).toBe("infinite");
		expect(view.container.querySelector("main")?.className).toBe(
			"w-full px-4 py-6 sm:px-7 sm:py-8 lg:px-12",
		);
		expect(view.container.querySelector('[data-slot="feed-scroll-viewport"]')).toBeNull();
	});
});
