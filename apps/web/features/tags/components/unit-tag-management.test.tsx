/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import type { EntitySearch } from "@rezics/ui";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const uiMocks = vi.hoisted(() => ({
	searchEntities: vi.fn<EntitySearch>(async () => []),
	tagSearch: undefined as EntitySearch | undefined,
}));

vi.mock("@/features/auth/auth-portal", () => ({
	SignInButton: ({ children }: { readonly children: ReactNode }) => <button>{children}</button>,
}));
vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			tags: {
				paths: {
					addTitle: "Add a Tag path",
					addDescription: "Choose a path.",
					create: "Create a Tag path",
					add: "Add path",
				},
				global: {
					addTitle: "Add a Tag",
					addDescription: "Choose a Tag.",
					add: "Add Tag",
				},
				realms: {
					addTitle: "Add a Realm Tag vote",
					addDescription: "Choose a Tag.",
					add: "Add vote",
				},
				create: {
					title: "Create a Tag",
				},
			},
			ui: {
				pickerPlaceholders: {
					tag: "Enter a tag name",
					tagPath: "Enter a Tag path name",
				},
				retryLater: "Try again later",
			},
		},
	}),
}));
vi.mock("@/i18n/request-failure", () => ({
	RequestFailure: () => null,
}));
vi.mock("@rezics/ui", () => ({
	Button: ({ children }: { readonly children: ReactNode }) => <button>{children}</button>,
	Card: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	CardContent: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	EntityPicker: ({
		index,
		renderNoResultsAction,
		search,
		searchOnOpen,
	}: {
		readonly index: string;
		readonly renderNoResultsAction?: (query: string) => ReactNode;
		readonly search?: EntitySearch;
		readonly searchOnOpen?: boolean;
	}) => {
		if (index === "tags") uiMocks.tagSearch = search;
		return (
			<div
				data-has-no-results-action={Boolean(renderNoResultsAction)}
				data-has-scoped-search={Boolean(search)}
				data-search-on-open={Boolean(searchOnOpen)}
				data-testid={`picker-${index}`}
			/>
		);
	},
	useEntitySearch: () => uiMocks.searchEntities,
}));

import { UnitTagManagement } from "./unit-tag-management";

const baseProps = {
	addError: null,
	addPending: false,
	addPathError: null,
	addPathPending: false,
	canVote: true,
	onAddPath: vi.fn(async () => undefined),
	onAddTag: vi.fn(async () => undefined),
	tagCreateTarget: {
		type: "book",
		unitId: "00000000-0000-7000-8000-000000000001",
		context: { kind: "global" },
	},
} satisfies Omit<ComponentProps<typeof UnitTagManagement>, "hasDevelopmentPreviewAccess">;

describe("UnitTagManagement", () => {
	afterEach(() => {
		cleanup();
		uiMocks.searchEntities.mockClear();
		uiMocks.tagSearch = undefined;
	});

	it("omits every Tag-path control outside development preview", () => {
		render(<UnitTagManagement {...baseProps} hasDevelopmentPreviewAccess={false} />);

		expect(screen.queryByText("Create a Tag path")).toBeNull();
		expect(screen.queryByTestId("picker-tag-paths")).toBeNull();
		expect(screen.getByTestId("picker-tags")).toBeTruthy();
		expect(screen.getByTestId("picker-tags").dataset.searchOnOpen).toBe("false");
	});

	it("shows Tag-path controls with development preview access", () => {
		render(<UnitTagManagement {...baseProps} hasDevelopmentPreviewAccess />);

		expect(screen.getByText("Create a Tag path")).toBeTruthy();
		expect(screen.getByTestId("picker-tag-paths")).toBeTruthy();
	});

	it("preloads only the selected Realm's available Tags", async () => {
		const realmId = "00000000-0000-7000-8000-000000000002";
		render(
			<UnitTagManagement
				{...baseProps}
				hasDevelopmentPreviewAccess
				tagCreateTarget={{
					...baseProps.tagCreateTarget,
					context: {
						kind: "realm",
						realmId,
					},
				}}
			/>,
		);

		expect(screen.queryByTestId("picker-tag-paths")).toBeNull();
		expect(screen.getByText("Add a Realm Tag vote")).toBeTruthy();
		expect(screen.getByTestId("picker-tags").dataset.hasScopedSearch).toBe("true");
		expect(screen.getByTestId("picker-tags").dataset.searchOnOpen).toBe("true");
		expect(screen.queryByRole("link", { name: "Create a Tag" })).toBeNull();
		if (!uiMocks.tagSearch) throw new Error("Expected a Realm-scoped Tag search.");
		const signal = new AbortController().signal;
		await uiMocks.tagSearch("tags", "", signal, { kinds: ["tag"] });
		expect(uiMocks.searchEntities).toHaveBeenCalledWith("tags", "", signal, {
			kinds: ["tag"],
			realmTagContextRealmId: realmId,
		});
	});

	it("renders no add controls without vote permission", () => {
		render(<UnitTagManagement {...baseProps} canVote={false} hasDevelopmentPreviewAccess />);

		expect(screen.queryByTestId("picker-tags")).toBeNull();
		expect(screen.queryByTestId("picker-tag-paths")).toBeNull();
	});

	it("shows the contextual Tag creator without waiting for a search", () => {
		render(<UnitTagManagement {...baseProps} hasDevelopmentPreviewAccess={false} />);

		const link = screen.getByRole("link", { name: "Create a Tag" });
		const url = new URL(link.getAttribute("href") ?? "", "https://rezics.example");
		expect(screen.getByTestId("picker-tags").dataset.hasNoResultsAction).toBe("false");
		expect(url.pathname).toBe("/create/tag/new");
		expect(url.searchParams.get("title")).toBeNull();
		expect(url.searchParams.get("intent")).toBe("unit-tag-vote");
		expect(url.searchParams.get("unitType")).toBe("book");
		expect(url.searchParams.get("unitId")).toBe("00000000-0000-7000-8000-000000000001");
		expect(url.searchParams.get("context")).toBe("global");
		expect(url.searchParams.get("realmId")).toBeNull();
		expect(url.searchParams.get("communityUnitSearch")).toBeNull();
	});

	it("does not offer global Tag creation in a Realm vote context", () => {
		render(
			<UnitTagManagement
				{...baseProps}
				hasDevelopmentPreviewAccess={false}
				tagCreateTarget={{
					...baseProps.tagCreateTarget,
					context: {
						kind: "realm",
						realmId: "00000000-0000-7000-8000-000000000002",
					},
				}}
			/>,
		);

		expect(screen.queryByRole("link", { name: "Create a Tag" })).toBeNull();
	});
});
