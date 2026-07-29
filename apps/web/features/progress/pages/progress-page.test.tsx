/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { ProgressPage } from "./progress-page";

const mocks = vi.hoisted(() => ({
	search: vi.fn().mockResolvedValue({
		items: [
			{
				unitId: "019f9000-0000-7000-8000-000000000001",
				status: "active",
				progress: 0.42,
				completedCount: 1,
				totalTimeMs: 0,
				firstSeenAt: "2026-07-29T00:00:00.000Z",
				lastSeenAt: "2026-07-30T00:00:00.000Z",
				lastContentStructureNodeId: null,
				lastReadAnchor: null,
				visibility: "private",
				type: "book",
				language: "zh",
				title: "沙丘",
				summary: "一場橫跨星際的旅程。",
				cover: null,
			},
		],
		total: 1,
	}),
}));

vi.mock("@rezics/filter", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@rezics/filter")>();
	return {
		...actual,
		parseSearchFeatureDefinition: (value: unknown) => value,
		unitFilterSearchQuery: () => "",
	};
});

vi.mock("@rezics/openapi-tanstack-query", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@rezics/openapi-tanstack-query")>();
	return {
		...actual,
		useGetApiSearchFeaturesByTemplate: () => ({
			data: { document: {}, controls: [] },
			error: undefined,
			isError: false,
			isPending: false,
			refetch: vi.fn(),
		}),
		usePostApiProgressSearch: () => ({
			error: undefined,
			isError: false,
			isPending: false,
			mutateAsync: mocks.search,
		}),
	};
});

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: (props: ComponentProps<"a">) => <a {...props} />,
}));

vi.mock("@/features/auth/require-session", () => ({
	RequireSession: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/features/content-language-display/chinese-content-display-context", () => ({
	useChineseContentText: (value: string) => value,
}));

vi.mock("@/features/search/search-feature", () => ({
	SearchFeature: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("@/i18n/use-localization-languages", () => ({
	useLocalizationLanguages: () => ["zh", "en"],
}));

const translation = await create(resources).getTranslation(
	[
		"actions",
		"betterAuthErrorCodes",
		"engagement",
		"errorCodes",
		"errors",
		"search",
		"state",
		"ui",
	],
	["zh-Hant"],
);

afterEach(() => {
	cleanup();
	mocks.search.mockClear();
});

describe("ProgressPage", () => {
	it("renders feed-style work information with progress-first actions", async () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<ProgressPage />
			</TranslationProvider>,
		);

		expect(await screen.findByRole("heading", { name: "沙丘" })).toBeTruthy();
		expect(screen.getByText("一場橫跨星際的旅程。")).toBeTruthy();
		expect(screen.getByText("42%")).toBeTruthy();
		expect(screen.getByRole("button", { name: "更新進度" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "查看足跡" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "刪除進度" })).toBeNull();
		expect(mocks.search).toHaveBeenCalledWith({
			body: {
				injections: [],
				localizationLanguages: ["zh", "en"],
				state: {},
			},
		});
	});
});
