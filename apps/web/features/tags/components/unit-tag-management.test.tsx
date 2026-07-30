/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/auth-portal", () => ({
	SignInButton: ({ children }: { readonly children: ReactNode }) => <button>{children}</button>,
}));
vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			tags: {
				structures: {
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
					noResults: ({ query }: { readonly query: string }) =>
						`No Tag matches "${query}".`,
					inStudio: ({ query }: { readonly query: string }) =>
						`Create "${query}" in Studio`,
				},
			},
			ui: { retryLater: "Try again later" },
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
	}: {
		readonly index: string;
		readonly renderNoResultsAction?: (query: string) => ReactNode;
	}) => (
		<div data-testid={`picker-${index}`}>
			{index === "tags" ? renderNoResultsAction?.("science") : null}
		</div>
	),
}));

import { UnitTagManagement } from "./unit-tag-management";

const baseProps = {
	addError: null,
	addPending: false,
	addStructureError: null,
	addStructurePending: false,
	canVote: true,
	onAddStructure: vi.fn(async () => undefined),
	onAddTag: vi.fn(async () => undefined),
	tagCreateTarget: {
		type: "book",
		unitId: "00000000-0000-7000-8000-000000000001",
		context: { kind: "global" },
	},
} satisfies Omit<ComponentProps<typeof UnitTagManagement>, "hasDevelopmentPreviewAccess">;

describe("UnitTagManagement", () => {
	afterEach(cleanup);

	it("omits every Tag-path control outside development preview", () => {
		render(<UnitTagManagement {...baseProps} hasDevelopmentPreviewAccess={false} />);

		expect(screen.queryByText("Create a Tag path")).toBeNull();
		expect(screen.queryByTestId("picker-tag-structures")).toBeNull();
		expect(screen.getByTestId("picker-tags")).toBeTruthy();
	});

	it("shows Tag-path controls with development preview access", () => {
		render(<UnitTagManagement {...baseProps} hasDevelopmentPreviewAccess />);

		expect(screen.getByText("Create a Tag path")).toBeTruthy();
		expect(screen.getByTestId("picker-tag-structures")).toBeTruthy();
	});

	it("keeps Tag-path management out of Realm vote contexts", () => {
		render(
			<UnitTagManagement
				{...baseProps}
				hasDevelopmentPreviewAccess
				tagCreateTarget={{
					...baseProps.tagCreateTarget,
					context: {
						kind: "realm",
						realmId: "00000000-0000-7000-8000-000000000002",
					},
				}}
			/>,
		);

		expect(screen.queryByTestId("picker-tag-structures")).toBeNull();
		expect(screen.getByText("Add a Realm Tag vote")).toBeTruthy();
		expect(screen.getByTestId("picker-tags")).toBeTruthy();
	});

	it("renders no add controls without vote permission", () => {
		render(<UnitTagManagement {...baseProps} canVote={false} hasDevelopmentPreviewAccess />);

		expect(screen.queryByTestId("picker-tags")).toBeNull();
		expect(screen.queryByTestId("picker-tag-structures")).toBeNull();
	});

	it("guides a zero-result global Tag search into the contextual Studio creator", () => {
		render(<UnitTagManagement {...baseProps} hasDevelopmentPreviewAccess={false} />);

		const link = screen.getByRole("link", { name: 'Create "science" in Studio' });
		const url = new URL(link.getAttribute("href") ?? "", "https://rezics.example");
		expect(url.pathname).toBe("/create/tag/new");
		expect(url.searchParams.get("title")).toBe("science");
		expect(url.searchParams.get("intent")).toBe("unit-tag-vote");
		expect(url.searchParams.get("unitType")).toBe("book");
		expect(url.searchParams.get("unitId")).toBe("00000000-0000-7000-8000-000000000001");
		expect(url.searchParams.get("context")).toBe("global");
		expect(url.searchParams.get("realmId")).toBeNull();
		expect(url.searchParams.get("publicEntrySearch")).toBeTruthy();
	});

	it("keeps the active Realm in the Studio creation intent", () => {
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

		const link = screen.getByRole("link", { name: 'Create "science" in Studio' });
		const url = new URL(link.getAttribute("href") ?? "", "https://rezics.example");
		expect(url.searchParams.get("context")).toBe("realm");
		expect(url.searchParams.get("realmId")).toBe("00000000-0000-7000-8000-000000000002");
	});
});
