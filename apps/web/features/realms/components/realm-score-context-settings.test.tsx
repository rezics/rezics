/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { create } from "native-i18n";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { RealmScoreContextSettings } from "./realm-score-context-settings";

const selectedContextPostId = "selected-context-post";
const state = vi.hoisted(() => ({
	contextPostId: null as string | null,
	deleteContext: vi.fn(() => Promise.resolve()),
	invalidateQueries: vi.fn(() => Promise.resolve()),
	putContext: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("@rezics/openapi-tanstack-query", () => ({
	getApiRealmsByRealmIdScoreContextQueryKey: (input: unknown) => ["realm-score-context", input],
	useDeleteApiRealmsByRealmIdScoreContext: () => ({
		error: null,
		isPending: false,
		mutateAsync: state.deleteContext,
		reset: vi.fn(),
	}),
	useGetApiRealmsByRealmIdScoreContext: () => ({
		data: { contextPostId: state.contextPostId },
		error: null,
		isError: false,
		isPending: false,
		refetch: vi.fn(),
	}),
	usePutApiRealmsByRealmIdScoreContext: () => ({
		error: null,
		isPending: false,
		mutateAsync: state.putContext,
		reset: vi.fn(),
	}),
}));

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({ invalidateQueries: state.invalidateQueries }),
}));

vi.mock("@rezics/ui", async () => {
	const actual = await vi.importActual<typeof import("@rezics/ui")>("@rezics/ui");
	return {
		...actual,
		Dialog: ({ children, open }: { readonly children: ReactNode; readonly open: boolean }) =>
			open ? <div role="dialog">{children}</div> : null,
		DialogClose: ({ children }: { readonly children: ReactNode }) => children,
		DialogContent: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
		DialogFooter: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
		DialogHeader: ({
			description,
			title,
		}: {
			readonly description: ReactNode;
			readonly title: ReactNode;
		}) => (
			<>
				<h3>{title}</h3>
				<p>{description}</p>
			</>
		),
		UnitPicker: ({
			ariaLabel,
			onValueChange,
		}: {
			readonly ariaLabel?: string;
			readonly onValueChange: (value: string | undefined) => void;
		}) => (
			<button
				aria-label={ariaLabel}
				onClick={() => onValueChange(selectedContextPostId)}
				type="button"
			/>
		),
	};
});

vi.mock("./realm-score-context-link", () => ({
	RealmScoreContextPostLink: () => <a href="/guidelines">guidelines</a>,
}));

const translation = await create(resources).getTranslation(
	["betterAuthErrorCodes", "errorCodes", "errors", "realms", "state", "ui"],
	["zh-Hant"],
);

function renderSettings() {
	return render(
		<TranslationProvider initial={translation.snapshot}>
			<RealmScoreContextSettings realmId="realm-id" />
		</TranslationProvider>,
	);
}

beforeEach(() => {
	state.contextPostId = null;
	state.deleteContext.mockClear();
	state.invalidateQueries.mockClear();
	state.putContext.mockClear();
});

afterEach(cleanup);

describe("RealmScoreContextSettings", () => {
	it("saves a Realm-scoped scoring-guidelines Post and refreshes the query", async () => {
		renderSettings();

		fireEvent.click(screen.getByRole("button", { name: "準則文章" }));
		fireEvent.click(screen.getByRole("button", { name: "儲存" }));

		expect(state.putContext).toHaveBeenCalledWith({
			path: { realmId: "realm-id" },
			body: { contextPostId: selectedContextPostId },
		});
		await waitFor(() => expect(state.invalidateQueries).toHaveBeenCalledOnce());
	});

	it("confirms removal and refreshes the query", async () => {
		state.contextPostId = "existing-context-post";
		renderSettings();

		fireEvent.click(screen.getByRole("button", { name: "取消設定" }));
		const dialog = screen.getByRole("dialog");
		fireEvent.click(within(dialog).getByRole("button", { name: "取消設定" }));

		expect(state.deleteContext).toHaveBeenCalledWith({ path: { realmId: "realm-id" } });
		await waitFor(() => expect(state.invalidateQueries).toHaveBeenCalledOnce());
	});
});
