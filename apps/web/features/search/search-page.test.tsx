/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchSurface } from "./search-page";

const mocks = vi.hoisted(() => ({
	useSearchFeedQuery: vi.fn(() => ({
		data: { pages: [{ facets: [] }] },
		isError: false,
		isFetching: false,
	})),
}));

vi.mock("@rezics/filter", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@rezics/filter")>();
	return {
		...actual,
		parseSearchFeatureDefinition: (value: unknown) => value,
		parseSharedSearchQueryDocument: (value: unknown) => value,
		unitFilterSearchQuery: () => "",
		withUnitFilterSearch: () => undefined,
	};
});

vi.mock("@rezics/openapi-tanstack-query", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@rezics/openapi-tanstack-query")>();
	return {
		...actual,
		postApiSearchFilterDefinition: vi.fn(),
		useGetApiSearchSharedQueriesById: vi.fn(),
		useGetApiSearchZonesByZoneIdFilter: () => ({
			data: undefined,
			error: undefined,
			isPending: false,
			refetch: vi.fn(),
		}),
		usePostApiSearchSharedQueries: () => ({ mutateAsync: vi.fn() }),
	};
});

vi.mock("@/features/content-feed/data/search-feed-list", () => ({
	SearchFeedResults: ({ pagination }: { pagination?: string }) => (
		<div data-pagination={pagination} data-testid="search-results" />
	),
	useSearchFeedQuery: mocks.useSearchFeedQuery,
	withoutSearchFeedCursor: ({ cursor: _cursor, ...state }: { cursor?: string; sort?: string }) =>
		state,
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: () => ({
		data: { filterDocument: {}, controls: [] },
		error: undefined,
		isPending: false,
		refetch: vi.fn(),
	}),
}));

vi.mock("@/features/search/search-feature", () => ({
	SearchFeature: ({
		children,
		onExecute,
	}: {
		children: ReactNode;
		onExecute: (request: { injections: []; state: { cursor: string; sort: "best" } }) => void;
	}) => (
		<div>
			<button
				onClick={() =>
					onExecute({
						injections: [],
						state: { cursor: "s1_stale", sort: "best" },
					})
				}
				type="button"
			>
				Execute
			</button>
			{children}
		</div>
	),
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			empty: "Empty",
			emptyBody: "No results",
			results: "Results",
		},
	}),
}));

afterEach(() => {
	cleanup();
	mocks.useSearchFeedQuery.mockClear();
});

describe("SearchSurface", () => {
	it("uses infinite Feed continuation and keeps its stable request cursor-free", () => {
		render(<SearchSurface id="global-search" source={{ kind: "filter", filterDocument: {} }} />);

		fireEvent.click(screen.getByRole("button", { name: "Execute" }));

		expect(screen.getByTestId("search-results").getAttribute("data-pagination")).toBe("infinite");
		expect(mocks.useSearchFeedQuery).toHaveBeenLastCalledWith(
			expect.objectContaining({
				enabled: true,
				request: {
					contexts: [],
					injections: [],
					state: { sort: "best" },
				},
			}),
		);
	});
});
