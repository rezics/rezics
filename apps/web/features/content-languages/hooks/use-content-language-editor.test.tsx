/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	localeTarget: "en",
	readStoredDraft: vi.fn(),
	removeStoredDraft: vi.fn(),
	replace: vi.fn(),
	scheduleStoredDraft: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	usePathname: () => "/manage",
	useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/features/application-shell/hooks/use-application-router", () => ({
	useApplicationRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/features/auth/session-provider", () => ({
	useAuthSession: () => ({
		status: "authenticated",
		data: { user: { id: "019f995d-7595-7c99-9183-250790bbfe2f" } },
		error: null,
		isPending: false,
		isRefetching: false,
		refetch: vi.fn(),
	}),
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({ locale: { target: mocks.localeTarget }, t: {} }),
}));

vi.mock("../model/localized-draft-storage", () => ({
	readStoredLocalizedDraft: mocks.readStoredDraft,
	removeStoredLocalizedDraft: mocks.removeStoredDraft,
	scheduleStoredLocalizedDraft: mocks.scheduleStoredDraft,
}));

import {
	ContentLanguageEditorProvider,
	useContentLanguageEditor,
	useLocalizedDraft,
	type LocalizedDraftCodec,
} from "./use-content-language-editor";

type TextDraft = { readonly text: string };

const TextDraftCodec: LocalizedDraftCodec<TextDraft> = {
	version: 1,
	decode(value) {
		if (typeof value !== "object" || value === null || !("text" in value)) return;
		return typeof value.text === "string" ? { text: value.text } : undefined;
	},
};

function LanguageDraftEditor({
	baseVersion = "revision-1",
	serverText,
}: {
	readonly baseVersion?: string;
	readonly serverText?: string;
}) {
	const { selectedLanguage } = useContentLanguageEditor();
	const draft = useLocalizedDraft<TextDraft>({
		scope: "language-fields",
		baseVersion,
		codec: TextDraftCodec,
		createInitialValue: () => ({ text: serverText ?? `server ${selectedLanguage}` }),
	});
	return (
		<>
			<input
				aria-label="draft"
				data-hydrated={String(draft.hydrated)}
				data-server-changed={String(draft.serverChanged)}
				onChange={(event) => draft.setValue({ text: event.currentTarget.value })}
				value={draft.value.text}
			/>
			<button onClick={draft.discard} type="button">
				Discard
			</button>
		</>
	);
}

function SharedDraftEditor() {
	const draft = useLocalizedDraft<TextDraft>({
		scope: "shared-fields",
		partition: "shared",
		baseVersion: "revision-1",
		codec: TextDraftCodec,
		createInitialValue: () => ({ text: "server shared" }),
	});
	return (
		<input
			aria-label="shared draft"
			onChange={(event) => draft.setValue({ text: event.currentTarget.value })}
			value={draft.value.text}
		/>
	);
}

function DraftHarness({ shared = false }: { readonly shared?: boolean }) {
	const { requestLanguage, selectedLanguage } = useContentLanguageEditor();
	return (
		<>
			<button onClick={() => requestLanguage("en")} type="button">
				English
			</button>
			<button onClick={() => requestLanguage("ja")} type="button">
				Japanese
			</button>
			<div data-testid="selected-language">{selectedLanguage}</div>
			{shared ? (
				<SharedDraftEditor key={selectedLanguage} />
			) : (
				<LanguageDraftEditor key={selectedLanguage} />
			)}
		</>
	);
}

function renderHarness(unitId: string, shared = false) {
	return render(
		<ContentLanguageEditorProvider
			localizations={[{ language: "en" }, { language: "ja" }]}
			onLanguagesChanged={vi.fn()}
			unitId={unitId}
		>
			<DraftHarness shared={shared} />
		</ContentLanguageEditorProvider>,
	);
}

beforeEach(() => {
	mocks.localeTarget = "en";
	mocks.readStoredDraft.mockReset();
	mocks.readStoredDraft.mockResolvedValue(undefined);
	mocks.removeStoredDraft.mockReset();
	mocks.replace.mockReset();
	mocks.scheduleStoredDraft.mockReset();
});

afterEach(cleanup);

describe("useLocalizedDraft", () => {
	it("keeps independent unsaved values when switching between content languages", async () => {
		renderHarness("019f995d-7595-7c99-9183-250790bbfe30");
		await waitFor(() => expect(screen.getByLabelText("draft").dataset.hydrated).toBe("true"));

		fireEvent.change(screen.getByLabelText("draft"), { target: { value: "draft en" } });
		fireEvent.click(screen.getByRole("button", { name: "Japanese" }));
		await waitFor(() => expect(screen.getByDisplayValue("server ja")).toBeTruthy());
		fireEvent.change(screen.getByLabelText("draft"), { target: { value: "draft ja" } });

		fireEvent.click(screen.getByRole("button", { name: "English" }));
		expect(screen.getByDisplayValue("draft en")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Japanese" }));
		expect(screen.getByDisplayValue("draft ja")).toBeTruthy();
		expect(mocks.scheduleStoredDraft).toHaveBeenCalledTimes(2);
	});

	it("keeps shared unsaved fields stable while the selected language changes", async () => {
		renderHarness("019f995d-7595-7c99-9183-250790bbfe31", true);
		await waitFor(() => expect(mocks.readStoredDraft).toHaveBeenCalled());
		fireEvent.change(screen.getByLabelText("shared draft"), {
			target: { value: "shared edit" },
		});

		fireEvent.click(screen.getByRole("button", { name: "Japanese" }));
		expect(screen.getByDisplayValue("shared edit")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "English" }));
		expect(screen.getByDisplayValue("shared edit")).toBeTruthy();
	});

	it("does not change the selected content language when the interface locale changes", () => {
		const view = renderHarness("019f995d-7595-7c99-9183-250790bbfe32");
		fireEvent.click(screen.getByRole("button", { name: "Japanese" }));
		expect(screen.getByTestId("selected-language").textContent).toBe("ja");

		mocks.localeTarget = "de";
		view.rerender(
			<ContentLanguageEditorProvider
				localizations={[{ language: "en" }, { language: "ja" }]}
				onLanguagesChanged={vi.fn()}
				unitId="019f995d-7595-7c99-9183-250790bbfe32"
			>
				<DraftHarness />
			</ContentLanguageEditorProvider>,
		);
		expect(screen.getByTestId("selected-language").textContent).toBe("ja");
	});

	it("restores a validated stored draft and reports a changed server baseline", async () => {
		mocks.readStoredDraft.mockResolvedValue({
			key: "stored-key",
			schemaVersion: 1,
			baseVersion: "revision-0",
			value: { text: "restored draft" },
			updatedAt: Date.now(),
			expiresAt: Date.now() + 60_000,
		});
		renderHarness("019f995d-7595-7c99-9183-250790bbfe33");

		await waitFor(() => expect(screen.getByDisplayValue("restored draft")).toBeTruthy());
		expect(screen.getByLabelText("draft").dataset.serverChanged).toBe("true");
	});

	it("keeps a dirty draft tied to its original baseline when newer server data arrives", async () => {
		const renderEditor = (baseVersion: string, serverText: string) => (
			<ContentLanguageEditorProvider
				localizations={[{ language: "en" }]}
				onLanguagesChanged={vi.fn()}
				unitId="019f995d-7595-7c99-9183-250790bbfe34"
			>
				<LanguageDraftEditor baseVersion={baseVersion} serverText={serverText} />
			</ContentLanguageEditorProvider>
		);
		const view = render(renderEditor("revision-1", "server one"));
		await waitFor(() => expect(screen.getByLabelText("draft").dataset.hydrated).toBe("true"));
		fireEvent.change(screen.getByLabelText("draft"), { target: { value: "local edit" } });

		view.rerender(renderEditor("revision-2", "server two"));
		expect(screen.getByDisplayValue("local edit")).toBeTruthy();
		expect(screen.getByLabelText("draft").dataset.serverChanged).toBe("true");
		fireEvent.change(screen.getByLabelText("draft"), { target: { value: "local edit two" } });
		expect(mocks.scheduleStoredDraft).toHaveBeenLastCalledWith(
			expect.objectContaining({ baseVersion: "revision-1" }),
		);

		fireEvent.click(screen.getByRole("button", { name: "Discard" }));
		expect(screen.getByDisplayValue("server two")).toBeTruthy();
	});
});
