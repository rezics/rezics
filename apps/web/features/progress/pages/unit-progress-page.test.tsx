/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { UiProvider } from "@rezics/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { UnitProgressPage } from "./unit-progress-page";

const UnitId = "019fa3ab-72a9-7792-b2e3-43aa8a9c755d";
const EntryId = "019fa3ab-72a9-7792-b2e3-43aa8a9c755e";

const progressContext = vi.hoisted(() => ({
	current: {} as Record<string, unknown>,
}));

const mutations = vi.hoisted(() => ({
	remove: vi.fn().mockResolvedValue({}),
	setCurrent: vi.fn().mockResolvedValue({}),
	setCurrentReset: vi.fn(),
}));

const entry = {
	id: EntryId,
	profileId: "019fa3ab-72a9-7792-b2e3-43aa8a9c755c",
	unitId: UnitId,
	entryKind: "update" as const,
	status: "active" as const,
	progress: 0.4,
	completionDelta: 0,
	totalTimeMs: 0,
	lastContentStructureNodeId: null,
	contentStructureRevisionId: null,
	occurredAt: "2026-07-20T12:00:00.000Z",
	datePrecision: "instant" as const,
	reviewId: null,
	createdAt: "2026-07-31T12:00:00.000Z",
	updatedAt: "2026-07-31T12:00:00.000Z",
};

vi.mock("@rezics/openapi-tanstack-query", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@rezics/openapi-tanstack-query")>();
	return {
		...actual,
		useDeleteApiProgressByUnitIdEntriesByEntryId: () => ({
			error: undefined,
			isPending: false,
			mutateAsync: mutations.remove,
		}),
		useGetApiUnitsByTypeByUnitId: () => ({
			data: {
				details: { type: "book" },
				language: "zh",
				localizations: [],
				type: "book",
			},
			error: undefined,
			isError: false,
			isPending: false,
			refetch: vi.fn(),
		}),
		usePutApiProgressByUnitIdEntriesByEntryIdCurrent: () => ({
			error: undefined,
			isPending: false,
			mutateAsync: mutations.setCurrent,
			reset: mutations.setCurrentReset,
			variables: undefined,
		}),
	};
});

vi.mock("nuqs", () => ({
	useQueryState: () => ["all", vi.fn()],
}));

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: (props: ComponentProps<"a">) => <a {...props} />,
}));

vi.mock("@/features/auth/require-session", () => ({
	RequireSession: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/features/units/model/unit-detail-unit", () => ({
	isUnitDetailUnitFor: () => true,
}));

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("@/i18n/use-localization-fallback-toast", () => ({
	useLocalizationFallbackToast: vi.fn(),
}));

vi.mock("@/i18n/use-localization-languages", () => ({
	useLocalizationLanguages: () => ["zh"],
}));

vi.mock("@/lib/localization", () => ({
	selectLocalization: () => ({ title: "測試作品" }),
}));

vi.mock("../components/progress-entry-dialog", () => ({ ProgressEntryDialog: () => null }));
vi.mock("../components/progress-import-dialog", () => ({ ProgressImportDialog: () => null }));
vi.mock("../components/unit-progress-dialog", () => ({ UnitProgressDialog: () => null }));
vi.mock("../components/unit-progress-provider", () => ({
	UnitProgressProvider: ({ children }: { children: ReactNode }) => children,
	useUnitProgress: () => progressContext.current,
}));
vi.mock("../data/progress-entries", () => ({
	useProgressEntries: () => ({
		data: { pages: [{ items: [entry], nextCursor: null }] },
		error: undefined,
		fetchNextPage: vi.fn(),
		hasNextPage: false,
		isError: false,
		isFetchingNextPage: false,
		isPending: false,
		refetch: vi.fn(),
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
	["betterAuthErrorCodes", "engagement", "errorCodes", "errors", "state", "ui"],
	["zh-Hant"],
);

function setProgressContext(currentEntryId: string | null) {
	progressContext.current = {
		contentStructureNodes: [],
		contentStructureNodesError: undefined,
		contentStructureNodesPending: false,
		currentEntryId,
		domain: { type: "book", unitId: UnitId },
		openEditor: vi.fn(),
		retryProgress: vi.fn(),
		state: {
			kind: "active",
			record: {
				completedCount: 0,
				lastContentStructureNodeId: null,
				progress: 0.4,
				status: "active",
				totalTimeMs: 0,
				visibility: "private",
			},
		},
	};
}

function renderPage() {
	const queryClient = new QueryClient({
		defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<TranslationProvider initial={translation.snapshot}>
				<UiProvider searchEntities={() => Promise.resolve([])}>
					<UnitProgressPage type="book" unitId={UnitId} />
				</UiProvider>
			</TranslationProvider>
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	setProgressContext(null);
	mutations.setCurrent.mockClear();
	mutations.setCurrentReset.mockClear();
});

afterEach(cleanup);

describe("UnitProgressPage", () => {
	it("offers an explicit command for a historical event", async () => {
		renderPage();

		const [action] = screen.getAllByRole("button", { name: "將這筆事件設為目前進度" });
		if (!action) throw new Error("Expected a set-current action");
		fireEvent.click(action);

		await vi.waitFor(() =>
			expect(mutations.setCurrent).toHaveBeenCalledWith({
				path: { unitId: UnitId, entryId: EntryId },
			}),
		);
	});

	it("labels only the actual current event and omits the command", () => {
		setProgressContext(EntryId);
		renderPage();

		expect(screen.getByText("目前進度")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "將這筆事件設為目前進度" })).toBeNull();
	});
});
