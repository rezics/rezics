/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { UiProvider } from "@rezics/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { resolveScoreContextSearchCategory } from "./score-context-picker";
import { UnitScoreControl } from "./unit-score-control";

const state = vi.hoisted(() => ({
	viewerItems: [] as {
		scoreId: string;
		contextUnitId: string;
		value: string | number;
		contextUnitTitle: string | null;
		updatedAt: string;
		visibility: "public" | "unlisted" | "private";
	}[],
	mutateAsync: vi.fn(() =>
		Promise.resolve({ scoreId: "score-id", score: 8, visibility: "private" }),
	),
	resetMutation: vi.fn(),
	invalidateQueries: vi.fn(() => Promise.resolve()),
	invalidateReviews: vi.fn(() => Promise.resolve()),
	openAuthPortal: vi.fn(),
}));

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("@/i18n/use-localization-languages", () => ({
	useLocalizationLanguages: () => ["zh", "en"],
}));

vi.mock("@rezics/ui", async () => {
	const actual = await vi.importActual<typeof import("@rezics/ui")>("@rezics/ui");
	return {
		...actual,
		Rating: ({
			"aria-hidden": ariaHidden,
			"aria-label": ariaLabel,
			disabled,
			onValueChange,
			readOnly,
		}: {
			readonly "aria-hidden"?: boolean;
			readonly "aria-label"?: string;
			readonly disabled?: boolean;
			readonly onValueChange?: (details: { value: number }) => void;
			readonly readOnly?: boolean;
		}) => (
			<button
				aria-hidden={ariaHidden}
				aria-label={ariaLabel}
				data-testid={readOnly ? "readonly-rating" : "interactive-rating"}
				disabled={disabled}
				onClick={() => onValueChange?.({ value: 4 })}
				type="button"
			/>
		),
	};
});

vi.mock("@rezics/openapi-tanstack-query", () => ({
	getApiScoresByTargetIdQueryKey: (input: unknown) => ["score", input],
	getApiScoresByTargetIdViewerQueryKey: (input: unknown) => ["viewer-scores", input],
	useGetApiScoresByTargetIdViewer: () => ({
		data: { items: state.viewerItems },
		error: null,
		isPending: false,
	}),
	usePutApiScoresByTargetId: () => ({
		error: null,
		isPending: false,
		mutateAsync: state.mutateAsync,
		reset: state.resetMutation,
	}),
}));

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({ invalidateQueries: state.invalidateQueries }),
}));

vi.mock("../data/review-cache", () => ({
	invalidateReviews: state.invalidateReviews,
}));

vi.mock("@/features/auth/auth-portal-context", () => ({
	useAuthPortal: () => ({ openAuthPortal: state.openAuthPortal }),
}));

vi.mock("@/lib/use-hydrated-session", () => ({
	useHydratedSession: () => ({ data: { user: { id: "viewer" } }, isPending: false }),
}));

vi.mock("../data/default-score-context", () => ({
	useDefaultScoreContext: () => ({
		context: {
			id: "019b76da-a800-7300-8000-000000000002",
			label: "REZICS 評分",
		},
		error: null,
		isPending: false,
		visibility: "private",
	}),
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
	["betterAuthErrorCodes", "engagement", "errorCodes", "errors", "search", "state", "ui"],
	["zh-Hant"],
);

function renderControl() {
	return render(
		<TranslationProvider initial={translation.snapshot}>
			<UiProvider searchEntities={() => Promise.resolve([])}>
				<UnitScoreControl targetId="019f92b9-cb0d-7cb6-a55a-1d5ecedc0949" type="book" />
			</UiProvider>
		</TranslationProvider>,
	);
}

beforeEach(() => {
	state.viewerItems = [];
	state.mutateAsync.mockClear();
	state.resetMutation.mockClear();
	state.invalidateQueries.mockClear();
	state.invalidateReviews.mockClear();
	state.openAuthPortal.mockClear();
});

afterEach(cleanup);

describe("UnitScoreControl", () => {
	it("submits the first Hero rating and invalidates dependent review projections", async () => {
		renderControl();

		fireEvent.click(screen.getByTestId("interactive-rating"));

		expect(state.mutateAsync).toHaveBeenCalledOnce();
		expect(state.mutateAsync).toHaveBeenCalledWith({
			body: {
				contextUnitId: "019b76da-a800-7300-8000-000000000002",
				score: 8,
				visibility: "private",
			},
			path: { targetId: "019f92b9-cb0d-7cb6-a55a-1d5ecedc0949" },
		});
		expect(screen.queryByRole("dialog")).toBeNull();
		await vi.waitFor(() => expect(state.invalidateReviews).toHaveBeenCalledOnce());
		expect(state.invalidateReviews).toHaveBeenCalledWith(
			expect.anything(),
			undefined,
			"019f92b9-cb0d-7cb6-a55a-1d5ecedc0949",
			"019b76da-a800-7300-8000-000000000002",
		);
	});

	it("opens the context-aware editor when the viewer already has a Score", async () => {
		state.viewerItems = [
			{
				scoreId: "019f9300-0000-7000-8000-000000000001",
				contextUnitId: "019b76da-a800-7300-8000-000000000002",
				value: 8,
				contextUnitTitle: "REZICS 評分",
				updatedAt: "2026-07-24T14:00:00.000Z",
				visibility: "public",
			},
		];
		renderControl();

		fireEvent.click(screen.getByRole("button", { name: "管理評分" }));

		expect(await screen.findByRole("dialog")).toBeTruthy();
		expect((screen.getByRole("combobox", { name: "評分語境" }) as HTMLInputElement).value).toBe(
			"REZICS 評分",
		);
		expect(state.mutateAsync).not.toHaveBeenCalled();
	});

	it("defaults context discovery to Realms unless a category is explicit", () => {
		expect(resolveScoreContextSearchCategory()).toBe("realms");
		expect(resolveScoreContextSearchCategory("units")).toBe("units");
	});
});
