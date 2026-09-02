/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const uiMocks = vi.hoisted(() => ({
	contextRealmId: undefined as string | undefined,
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			tags: {
				paths: { create: "Create a Tag path" },
				global: {
					addTitle: "Add a Tag",
					addDescription: "Choose Tags.",
					add: "Add Tag",
				},
				realms: {
					addTitle: "Add Realm Tag votes",
					addDescription: "Choose Tags.",
					add: "Add votes",
				},
				create: { title: "Create a Tag" },
			},
			ui: { pickerPlaceholders: { tag: "Enter a Tag name" } },
		},
	}),
}));

vi.mock("@rezics/ui", () => ({
	Button: ({ asChild, children }: { readonly asChild?: boolean; readonly children: ReactNode }) =>
		asChild ? children : <button>{children}</button>,
}));

vi.mock("./tag-selection-multi-picker", () => ({
	TagSelectionMultiPicker: ({ contextRealmId }: { readonly contextRealmId?: string }) => {
		uiMocks.contextRealmId = contextRealmId;
		return <div data-testid="tag-multi-picker" />;
	},
}));

import { UnitTagManagement } from "./unit-tag-management";

const baseProps = {
	canVote: true,
	onAddSelections: vi.fn(async () => []),
	tagCreateTarget: {
		type: "book",
		unitId: "00000000-0000-7000-8000-000000000001",
		context: { kind: "global" },
	},
} satisfies ComponentProps<typeof UnitTagManagement>;

describe("UnitTagManagement", () => {
	afterEach(() => {
		cleanup();
		uiMocks.contextRealmId = undefined;
	});

	it("uses one multi-picker for direct Tags and eligible Tag Paths", () => {
		render(<UnitTagManagement {...baseProps} />);

		expect(screen.getByText("Create a Tag path")).toBeTruthy();
		expect(screen.getByTestId("tag-multi-picker")).toBeTruthy();
		expect(uiMocks.contextRealmId).toBeUndefined();
	});

	it("scopes suggestions to the selected Realm", () => {
		const realmId = "00000000-0000-7000-8000-000000000002";
		render(
			<UnitTagManagement
				{...baseProps}
				tagCreateTarget={{
					...baseProps.tagCreateTarget,
					context: { kind: "realm", realmId },
				}}
			/>,
		);

		expect(screen.getByText("Add Realm Tag votes")).toBeTruthy();
		expect(uiMocks.contextRealmId).toBe(realmId);
		expect(screen.queryByRole("link", { name: "Create a Tag" })).toBeNull();
	});

	it("renders no add controls without vote permission", () => {
		render(<UnitTagManagement {...baseProps} canVote={false} />);

		expect(screen.queryByTestId("tag-multi-picker")).toBeNull();
	});

	it("shows the contextual Tag creator without waiting for a search", () => {
		render(<UnitTagManagement {...baseProps} />);

		const link = screen.getByRole("link", { name: "Create a Tag" });
		const url = new URL(link.getAttribute("href") ?? "", "https://rezics.example");
		expect(url.pathname).toBe("/create/tag/new");
		expect(url.searchParams.get("title")).toBeNull();
		expect(url.searchParams.get("intent")).toBe("unit-tag-vote");
		expect(url.searchParams.get("unitType")).toBe("book");
		expect(url.searchParams.get("unitId")).toBe("00000000-0000-7000-8000-000000000001");
		expect(url.searchParams.get("context")).toBe("global");
		expect(url.searchParams.get("realmId")).toBeNull();
	});

	it("does not offer global Tag creation in a Realm vote context", () => {
		render(
			<UnitTagManagement
				{...baseProps}
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
