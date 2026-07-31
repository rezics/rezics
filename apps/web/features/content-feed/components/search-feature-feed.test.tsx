/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchFeatureFeed } from "./search-feature-feed";

const mocks = vi.hoisted(() => ({
	useSearchFeedQuery: vi.fn(() => ({
		data: { pages: [{ facets: [] }] },
		isError: false,
		isFetching: false,
	})),
}));

vi.mock("@rezics/filter", () => ({
	parseSearchFeatureDefinition: (value: unknown) => value,
}));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	useGetApiSearchFeaturesByTemplate: () => ({
		data: { document: {}, controls: [] },
		error: undefined,
		isError: false,
		isPending: false,
		refetch: vi.fn(),
	}),
}));

vi.mock("@/features/content-feed/data/search-feed-list", () => ({
	SearchFeedResults: () => <div data-testid="feed-results" />,
	useSearchFeedQuery: mocks.useSearchFeedQuery,
	withoutSearchFeedCursor: ({ cursor: _cursor, ...state }: { cursor?: string; sort?: string }) =>
		state,
}));

vi.mock("@/features/search/search-feature", () => ({
	SearchFeature: ({
		appearance,
		children,
		onExecute,
		surface,
	}: {
		appearance: string;
		children: ReactNode;
		onExecute: (request: {
			injections: [];
			state: { cursor: "s2_stale"; sort: "best" };
		}) => void;
		surface: string;
	}) => (
		<div data-appearance={appearance} data-surface={surface} data-testid="search-feature">
			<button
				onClick={() =>
					onExecute({
						injections: [],
						state: { cursor: "s2_stale", sort: "best" },
					})
				}
				type="button"
			>
				execute
			</button>
			{children}
		</div>
	),
}));

afterEach(() => {
	cleanup();
	mocks.useSearchFeedQuery.mockClear();
});

describe("SearchFeatureFeed", () => {
	it("renders Search Feature controls in feed mode and preserves fixed contexts", () => {
		render(
			<SearchFeatureFeed
				initialRequest={{
					contexts: [
						{
							kind: "realm",
							realmId: "019f9000-0000-7000-8000-000000000001",
						},
					],
					injections: [
						{
							source: "link",
							removable: false,
							value: {
								controlKey: "subject",
								filter: {
									field: "subject",
									operator: "equals",
									value: "019f9000-0000-7000-8000-000000000002",
								},
							},
						},
					],
					state: { sort: "createdAt:desc" },
				}}
				template="global"
			/>,
		);

		const feature = screen.getByTestId("search-feature");
		expect(feature.getAttribute("data-appearance")).toBe("feed");
		expect(feature.getAttribute("data-surface")).toBe("feed");
		expect(screen.getByTestId("feed-results")).toBeDefined();
		expect(mocks.useSearchFeedQuery).toHaveBeenLastCalledWith(
			expect.objectContaining({
				request: expect.objectContaining({
					state: { sort: "createdAt:desc" },
				}),
				source: { kind: "template", template: "global" },
				surface: "feed",
			}),
		);

		fireEvent.click(screen.getByRole("button", { name: "execute" }));

		expect(mocks.useSearchFeedQuery).toHaveBeenLastCalledWith(
			expect.objectContaining({
				request: {
					contexts: [
						{
							kind: "realm",
							realmId: "019f9000-0000-7000-8000-000000000001",
						},
					],
					injections: [],
					state: { sort: "best" },
				},
			}),
		);
	});
});
