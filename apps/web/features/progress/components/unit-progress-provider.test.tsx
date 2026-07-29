/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { UnitProgressProvider, useUnitProgress } from "./unit-progress-provider";

const actions = vi.hoisted(() => ({
	completeProgress: vi.fn(),
	refetchProgress: vi.fn(),
	removeProgress: vi.fn(),
	resetCompletion: vi.fn(),
	resetRemoveProgress: vi.fn(),
	resetSaveProgress: vi.fn(),
	saveProgress: vi.fn(),
}));

const queryResults = vi.hoisted(() => ({
	chapters: {
		data: { items: [] },
		error: undefined,
		isPending: false,
	},
	progress: {
		data: {
			state: "tracked",
			record: {
				completedCount: 1,
				currentEntryId: null,
				lastContentStructureNodeId: null,
				progress: 0.42,
				status: "active",
				totalTimeMs: 0,
				visibility: "private",
			},
		},
		error: undefined,
		isError: false,
		isPending: false,
		refetch: actions.refetchProgress,
	},
}));

vi.mock("@rezics/openapi-tanstack-query", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@rezics/openapi-tanstack-query")>();
	return {
		...actual,
		useDeleteApiProgressByUnitId: () => ({
			error: undefined,
			isPending: false,
			mutateAsync: actions.removeProgress,
			reset: actions.resetRemoveProgress,
		}),
		useGetApiProgressByUnitId: () => queryResults.progress,
		useGetApiUnitsBookByUnitIdContentStructureNodes: () => queryResults.chapters,
		usePostApiProgressByUnitIdComplete: () => ({
			error: undefined,
			mutateAsync: actions.completeProgress,
			reset: actions.resetCompletion,
		}),
		usePutApiProgressByUnitId: () => ({
			error: undefined,
			isPending: false,
			mutateAsync: actions.saveProgress,
			reset: actions.resetSaveProgress,
		}),
	};
});

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("@/i18n/use-localization-languages", () => ({
	useLocalizationLanguages: () => ["zh", "en"],
}));

vi.mock("@/lib/use-hydrated-session", () => ({
	useHydratedSession: () => ({
		data: { user: { id: "viewer" } },
		isPending: false,
	}),
}));

const translation = await create(resources).getTranslation(["engagement"], ["zh-Hant"]);
const domain = {
	type: "book",
	unitId: "019f9000-0000-7000-8000-000000000001",
} as const;

type UnitProgressValue = ReturnType<typeof useUnitProgress>;

const observedEditorActions = {
	completeCurrentProgress: new Set<UnitProgressValue["completeCurrentProgress"]>(),
	openEditor: new Set<UnitProgressValue["openEditor"]>(),
	removeProgress: new Set<UnitProgressValue["removeProgress"]>(),
	saveProgress: new Set<UnitProgressValue["saveProgress"]>(),
};

function ProgressEditorProbe() {
	const progress = useUnitProgress();
	observedEditorActions.completeCurrentProgress.add(progress.completeCurrentProgress);
	observedEditorActions.openEditor.add(progress.openEditor);
	observedEditorActions.removeProgress.add(progress.removeProgress);
	observedEditorActions.saveProgress.add(progress.saveProgress);
	return (
		<button onClick={progress.openEditor} type="button">
			{progress.editorOpen ? "open" : "closed"}
		</button>
	);
}

function renderProvider(
	props: Pick<ComponentProps<typeof UnitProgressProvider>, "initialEditorOpen"> = {},
) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<TranslationProvider initial={translation.snapshot}>
				<UnitProgressProvider domain={domain} {...props}>
					<ProgressEditorProbe />
				</UnitProgressProvider>
			</TranslationProvider>
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	for (const observed of Object.values(observedEditorActions)) observed.clear();
	for (const action of Object.values(actions)) action.mockClear();
});

afterEach(cleanup);

describe("UnitProgressProvider editor lifecycle", () => {
	it("opens from its explicit initial state without resetting fresh mutations", () => {
		renderProvider({ initialEditorOpen: true });

		expect(screen.getByRole("button", { name: "open" })).toBeTruthy();
		expect(actions.resetSaveProgress).not.toHaveBeenCalled();
		expect(actions.resetCompletion).not.toHaveBeenCalled();
		expect(actions.resetRemoveProgress).not.toHaveBeenCalled();
	});

	it("keeps the editor action stable while resetting mutations for later opens", () => {
		renderProvider();

		fireEvent.click(screen.getByRole("button", { name: "closed" }));

		expect(screen.getByRole("button", { name: "open" })).toBeTruthy();
		expect(actions.resetSaveProgress).toHaveBeenCalledOnce();
		expect(actions.resetCompletion).toHaveBeenCalledOnce();
		expect(actions.resetRemoveProgress).toHaveBeenCalledOnce();
		for (const observed of Object.values(observedEditorActions)) {
			expect(observed.size).toBe(1);
		}
	});
});
