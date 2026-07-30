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
	EntityPicker: ({ index }: { readonly index: string }) => (
		<div data-testid={`picker-${index}`} />
	),
}));

import { UnitTagManagement } from "./unit-tag-management";

const baseProps = {
	addError: null,
	addPending: false,
	addStructureError: null,
	addStructurePending: false,
	canVote: true,
	contextKind: "global",
	onAddStructure: vi.fn(async () => undefined),
	onAddTag: vi.fn(async () => undefined),
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
			<UnitTagManagement {...baseProps} contextKind="realm" hasDevelopmentPreviewAccess />,
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
});
