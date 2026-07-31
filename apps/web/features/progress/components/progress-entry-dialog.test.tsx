/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { UiProvider } from "@rezics/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { ProgressEntryDialog } from "./progress-entry-dialog";

const mutations = vi.hoisted(() => ({
	create: vi.fn().mockResolvedValue({}),
	replace: vi.fn().mockResolvedValue({}),
}));

vi.mock("@rezics/openapi-tanstack-query", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@rezics/openapi-tanstack-query")>();
	return {
		...actual,
		usePostApiProgressByUnitIdEntries: () => ({
			error: undefined,
			isPending: false,
			mutateAsync: mutations.create,
		}),
		usePutApiProgressByUnitIdEntriesByEntryId: () => ({
			error: undefined,
			isPending: false,
			mutateAsync: mutations.replace,
		}),
	};
});

vi.mock("./unit-progress-provider", () => ({
	useUnitProgress: () => ({
		contentStructureNodes: [],
		contentStructureNodesError: undefined,
		contentStructureNodesPending: false,
		domain: {
			type: "book",
			unitId: "019fa3ab-72a9-7792-b2e3-43aa8a9c755d",
		},
	}),
}));

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

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

function renderDialog() {
	const queryClient = new QueryClient({
		defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<TranslationProvider initial={translation.snapshot}>
				<UiProvider searchEntities={() => Promise.resolve([])}>
					<ProgressEntryDialog onOpenChange={vi.fn()} open />
				</UiProvider>
			</TranslationProvider>
		</QueryClientProvider>,
	);
}

afterEach(() => {
	cleanup();
	mutations.create.mockClear();
	mutations.replace.mockClear();
});

describe("ProgressEntryDialog", () => {
	it("creates a historical event without exposing current-progress selection", async () => {
		renderDialog();

		expect(screen.queryByText("將這筆事件設為目前進度")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "儲存事件" }));

		await vi.waitFor(() => expect(mutations.create).toHaveBeenCalledOnce());
		const request = mutations.create.mock.calls[0]?.[0];
		expect(request).toMatchObject({
			path: { unitId: "019fa3ab-72a9-7792-b2e3-43aa8a9c755d" },
			body: {
				datePrecision: "day",
				entryKind: "update",
				progress: 0,
				status: "active",
			},
		});
		expect(request.body).not.toHaveProperty("affectsCurrent");
	});
});
