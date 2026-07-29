/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PostList } from "./post-list";

vi.mock("@/features/content-feed/components/search-feature-feed", () => ({
	SearchFeatureFeed: ({
		initialRequest,
	}: {
		initialRequest: {
			contexts: unknown[];
			injections: unknown[];
			state: unknown;
		};
	}) => <div data-request={JSON.stringify(initialRequest)} data-testid="search-feature-feed" />,
}));

vi.mock("@/features/content-feed/data/search-feed-list", () => ({
	SearchFeedList: ({ request }: { request: unknown }) => (
		<div data-request={JSON.stringify(request)} data-testid="search-feed-list" />
	),
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({ locale: "en", t: {} }),
}));

vi.mock("@/lib/use-hydrated-session", () => ({
	useHydratedSession: () => ({ data: null }),
}));

afterEach(cleanup);

describe("PostList", () => {
	it("uses the interactive Search Feature Feed when controls are requested", () => {
		render(
			<PostList
				realmId="019f9000-0000-7000-8000-000000000001"
				showFeedControls
				subjectId="019f9000-0000-7000-8000-000000000002"
			/>,
		);

		const feed = screen.getByTestId("search-feature-feed");
		const request = JSON.parse(feed.getAttribute("data-request") ?? "");

		expect(screen.queryByTestId("search-feed-list")).toBeNull();
		expect(request).toMatchObject({
			contexts: [
				{
					kind: "realm",
					realmId: "019f9000-0000-7000-8000-000000000001",
				},
			],
			injections: [
				{
					removable: false,
					value: {
						filter: { field: "category", operator: "equals", value: "posts" },
					},
				},
				{
					removable: false,
					value: {
						filter: { field: "kind", operator: "equals", value: "post" },
					},
				},
				{
					removable: false,
					value: {
						filter: {
							field: "subject",
							operator: "equals",
							value: "019f9000-0000-7000-8000-000000000002",
						},
					},
				},
			],
			state: { pageSize: 20, sort: "createdAt:desc" },
		});
	});

	it("keeps the compact feed without a header by default", () => {
		render(<PostList subjectId="019f9000-0000-7000-8000-000000000002" />);

		expect(screen.getByTestId("search-feed-list")).toBeDefined();
		expect(screen.queryByTestId("search-feature-feed")).toBeNull();
	});
});
