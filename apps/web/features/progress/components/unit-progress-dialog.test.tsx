/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { UiProvider } from "@rezics/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import type { UnitProgressRecord } from "../model/progress-record";
import { UnitProgressDialog } from "./unit-progress-dialog";

const progressContext = vi.hoisted(() => ({
	current: {} as Record<string, unknown>,
}));

const actions = vi.hoisted(() => ({
	closeEditor: vi.fn(),
	completeCurrentProgress: vi.fn(() => Promise.resolve(true)),
	openEditor: vi.fn(),
	removeProgress: vi.fn(() => Promise.resolve(true)),
	saveProgress: vi.fn(() => Promise.resolve(true)),
	startAgain: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("./unit-progress-provider", () => ({
	useUnitProgress: () => progressContext.current,
}));

vi.stubGlobal(
	"ResizeObserver",
	class ResizeObserverMock {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
);
vi.stubGlobal(
	"IntersectionObserver",
	class IntersectionObserverMock {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
);

const translation = await create(resources).getTranslation(
	["betterAuthErrorCodes", "engagement", "errorCodes", "errors", "state", "ui"],
	["zh-Hant"],
);

const existingRecord: UnitProgressRecord = {
	completedCount: 0,
	lastContentStructureNodeId: null,
	progress: 0,
	status: "active",
	totalTimeMs: 0,
	visibility: "private",
};

function setProgressState(record: UnitProgressRecord | null) {
	progressContext.current = {
		...actions,
		chapters: [],
		chaptersError: undefined,
		chaptersPending: false,
		completionError: undefined,
		domain: {
			type: "software",
			unitId: "019f0000-0000-7000-8000-000000000001",
		},
		editorOpen: true,
		isCompleting: false,
		isRemoving: false,
		isSaving: false,
		removeError: undefined,
		saveError: undefined,
		state: record ? { kind: record.status, record } : { kind: "untracked" },
	};
}

function renderDialog() {
	return render(
		<TranslationProvider initial={translation.snapshot}>
			<UiProvider searchEntities={() => Promise.resolve([])}>
				<UnitProgressDialog />
			</UiProvider>
		</TranslationProvider>,
	);
}

beforeEach(() => {
	for (const action of Object.values(actions)) action.mockClear();
});

afterEach(cleanup);

describe("UnitProgressDialog", () => {
	it("creates progress as public without showing an item visibility control", async () => {
		setProgressState(null);
		renderDialog();

		expect(screen.queryByRole("combobox", { name: "可見性" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "更新進度" }));

		await vi.waitFor(() =>
			expect(actions.saveProgress).toHaveBeenCalledWith({
				progress: 0,
				status: "active",
				totalTimeMs: 0,
				visibility: "public",
			}),
		);
	});

	it("offers visibility controls when editing existing progress", async () => {
		setProgressState(existingRecord);
		renderDialog();

		const visibility = screen.getByRole("combobox", {
			name: "可見性",
		}) as HTMLSelectElement;
		expect(visibility.value).toBe("private");
		fireEvent.change(visibility, { target: { value: "unlisted" } });
		fireEvent.click(screen.getByRole("button", { name: "更新進度" }));

		await vi.waitFor(() =>
			expect(actions.saveProgress).toHaveBeenCalledWith({
				progress: 0,
				status: "active",
				totalTimeMs: 0,
				visibility: "unlisted",
			}),
		);
	});
});
