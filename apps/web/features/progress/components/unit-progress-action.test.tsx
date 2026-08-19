/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import type { ProgressStatus, UnitProgressRecord } from "../model/progress-record";
import { UnitProgressAction } from "./unit-progress-action";

const progressContext = vi.hoisted(() => ({
	current: {} as Record<string, unknown>,
}));
const push = vi.fn();

vi.mock("@/features/application-shell/hooks/use-application-router", () => ({
	useApplicationRouter: () => ({ push }),
}));

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("./unit-progress-provider", () => ({
	useUnitProgress: () => progressContext.current,
}));

const translation = await create(resources).getTranslation(
	["actions", "betterAuthErrorCodes", "engagement", "errorCodes", "errors", "state", "ui"],
	["zh-Hant"],
);

const actions = {
	addToBacklog: vi.fn(() => Promise.resolve(true)),
	openEditor: vi.fn(),
	resumeProgress: vi.fn(() => Promise.resolve(true)),
	retryProgress: vi.fn(),
	startAgain: vi.fn(() => Promise.resolve(true)),
};

const activeRecord: UnitProgressRecord = {
	completedCount: 1,
	continuation: {
		kind: "book-node",
		bookId: "019f0000-0000-7000-8000-000000000001",
		nodeId: "019f0000-0000-7000-8000-000000000002",
	},
	lastContentStructureNodeId: null,
	progress: 0.4,
	status: "active",
	totalTimeMs: 0,
	visibility: "private",
};

function setProgressState(
	state:
		| { readonly kind: "untracked" }
		| {
				readonly kind: ProgressStatus;
				readonly record: UnitProgressRecord;
		  },
	type: "book" | "media" | "software" = "book",
) {
	progressContext.current = {
		...actions,
		completionFeedbackCount: undefined,
		domain: {
			type,
			unitId: "019f0000-0000-7000-8000-000000000001",
		},
		isCompleting: false,
		isSaving: false,
		saveError: undefined,
		state,
	};
}

function renderAction(metadataOnly = false) {
	return render(
		<TranslationProvider initial={translation.snapshot}>
			<UnitProgressAction metadataOnly={metadataOnly} />
		</TranslationProvider>,
	);
}

beforeEach(() => {
	for (const action of Object.values(actions)) action.mockClear();
	push.mockClear();
});

afterEach(cleanup);

describe("UnitProgressAction", () => {
	it("offers Want to Read for an untracked unit and creates a backlog record", () => {
		setProgressState({ kind: "untracked" });
		renderAction();

		fireEvent.click(screen.getByRole("button", { name: "想讀" }));

		expect(actions.addToBacklog).toHaveBeenCalledOnce();
		expect(actions.openEditor).not.toHaveBeenCalled();
	});

	it.each([
		["backlog", "開始閱讀", "resumeProgress"],
		["paused", "繼續閱讀", "resumeProgress"],
		["completed", "再讀一次", "startAgain"],
		["dropped", "重新開始", "startAgain"],
	] as const)("renders the %s-specific primary action", (status, label, actionName) => {
		setProgressState({
			kind: status,
			record: { ...activeRecord, status },
		});
		renderAction();

		fireEvent.click(screen.getByRole("button", { name: label }));

		expect(actions[actionName]).toHaveBeenCalledOnce();
	});

	it("continues an active Book from the server-resolved destination", () => {
		setProgressState({ kind: "active", record: { ...activeRecord, status: "active" } });
		renderAction();

		fireEvent.click(screen.getByRole("button", { name: "繼續" }));

		expect(push).toHaveBeenCalledWith(
			"/units/book/019f0000-0000-7000-8000-000000000001/read/019f0000-0000-7000-8000-000000000002",
		);
		expect(actions.openEditor).not.toHaveBeenCalled();
	});

	it("continues an active Media work from the server-resolved destination", () => {
		setProgressState(
			{
				kind: "active",
				record: {
					...activeRecord,
					continuation: {
						kind: "unit",
						unitId: "019f0000-0000-7000-8000-000000000003",
						unitType: "video",
					},
					status: "active",
				},
			},
			"media",
		);
		renderAction();

		fireEvent.click(screen.getByRole("button", { name: "繼續" }));

		expect(push).toHaveBeenCalledWith("/units/video/019f0000-0000-7000-8000-000000000003");
		expect(actions.openEditor).not.toHaveBeenCalled();
	});

	it.each(["book", "media"] as const)("keeps active metadata-only %s progress manual", (type) => {
		setProgressState({ kind: "active", record: { ...activeRecord, status: "active" } }, type);
		renderAction(true);

		fireEvent.click(screen.getByRole("button", { name: "更新進度" }));

		expect(actions.openEditor).toHaveBeenCalledOnce();
		expect(push).not.toHaveBeenCalled();
	});

	it("keeps Software progress manual even when full content is provided", () => {
		setProgressState(
			{ kind: "active", record: { ...activeRecord, continuation: { kind: "none" } } },
			"software",
		);
		renderAction(false);

		fireEvent.click(screen.getByRole("button", { name: "更新紀錄" }));

		expect(actions.openEditor).toHaveBeenCalledOnce();
		expect(push).not.toHaveBeenCalled();
	});
});
