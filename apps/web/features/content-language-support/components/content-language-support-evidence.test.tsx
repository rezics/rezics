/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import type { GetApiUnitsByTypeByUnitIdContentLanguageSupportEvidenceStatus200 } from "@rezics/openapi-tanstack-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { ContentLanguageSupportEvidence } from "./content-language-support-evidence";

const evidenceApi = vi.hoisted(() => ({ loadPage: vi.fn() }));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	getApiUnitsByTypeByUnitIdContentLanguageSupportEvidenceQueryOptions: ({
		path,
		query,
	}: {
		readonly path: { readonly type: string; readonly unitId: string };
		readonly query?: { readonly cursor?: string };
	}) => ({
		queryKey: ["content-language-evidence", path.type, path.unitId, query?.cursor ?? null],
		queryFn: () => evidenceApi.loadPage(query?.cursor),
	}),
}));

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("@/i18n/use-localization-languages", () => ({
	useLocalizationLanguages: () => ["en"],
}));

const translation = await create(resources).getTranslation(["ui", "units"], ["en"]);
type EvidenceItem =
	GetApiUnitsByTypeByUnitIdContentLanguageSupportEvidenceStatus200["items"][number];

const adaptedAudioEvidence = {
	source: "adapted_audio",
	unit: {
		id: "00000000-0000-4000-8000-000000000001",
		kind: "audio",
		language: "en",
		title: "English dub",
	},
	contentLanguageSupport: [{ languageTag: "en", channels: ["audio"] }],
	occurrence: null,
} satisfies EvidenceItem;

const parentEvidence = {
	source: "parent",
	unit: {
		id: "00000000-0000-4000-8000-000000000002",
		kind: "software",
		language: "en",
		title: "Parent software",
	},
	contentLanguageSupport: [{ languageTag: "ja" }],
	occurrence: null,
} satisfies EvidenceItem;

const secondAdaptedAudioEvidence = {
	...adaptedAudioEvidence,
	unit: {
		...adaptedAudioEvidence.unit,
		id: "00000000-0000-4000-8000-000000000004",
		title: "Japanese dub",
	},
	contentLanguageSupport: [{ languageTag: "ja", channels: ["audio"] }],
} satisfies EvidenceItem;

afterEach(() => {
	cleanup();
	evidenceApi.loadPage.mockReset();
});

describe("ContentLanguageSupportEvidence", () => {
	it("loads keyset pages lazily and changes the draft only through Adopt", async () => {
		evidenceApi.loadPage
			.mockResolvedValueOnce({
				currentContentLanguageSupport: [],
				items: [adaptedAudioEvidence],
				nextCursor: "after-audio",
			} satisfies GetApiUnitsByTypeByUnitIdContentLanguageSupportEvidenceStatus200)
			.mockResolvedValueOnce({
				currentContentLanguageSupport: [],
				items: [adaptedAudioEvidence, secondAdaptedAudioEvidence],
				nextCursor: null,
			} satisfies GetApiUnitsByTypeByUnitIdContentLanguageSupportEvidenceStatus200);
		const onAdopt = vi.fn();
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

		render(
			<QueryClientProvider client={queryClient}>
				<TranslationProvider initial={translation.snapshot}>
					<ContentLanguageSupportEvidence
						onAdopt={onAdopt}
						type="video"
						unitId="00000000-0000-4000-8000-000000000003"
					/>
				</TranslationProvider>
			</QueryClientProvider>,
		);

		expect(evidenceApi.loadPage).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "View related entries" }));

		expect(await screen.findByText("Adapted audio")).toBeTruthy();
		expect(screen.getByText("English dub")).toBeTruthy();
		expect(onAdopt).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Adopt" }));
		expect(onAdopt).toHaveBeenCalledWith(adaptedAudioEvidence.contentLanguageSupport);

		fireEvent.click(screen.getByRole("button", { name: "Load more" }));
		expect(await screen.findByText("Japanese dub")).toBeTruthy();
		await waitFor(() => expect(evidenceApi.loadPage).toHaveBeenLastCalledWith("after-audio"));
		expect(screen.getAllByText("English dub")).toHaveLength(1);
	});

	it("shows the parent source when a Release explicitly loads evidence", async () => {
		evidenceApi.loadPage.mockResolvedValueOnce({
			currentContentLanguageSupport: [],
			items: [parentEvidence],
			nextCursor: null,
		} satisfies GetApiUnitsByTypeByUnitIdContentLanguageSupportEvidenceStatus200);
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

		render(
			<QueryClientProvider client={queryClient}>
				<TranslationProvider initial={translation.snapshot}>
					<ContentLanguageSupportEvidence
						onAdopt={vi.fn()}
						type="release"
						unitId="00000000-0000-4000-8000-000000000005"
					/>
				</TranslationProvider>
			</QueryClientProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: "View related entries" }));
		expect(await screen.findByText("Parent Unit")).toBeTruthy();
		expect(screen.getByText("Parent software")).toBeTruthy();
	});
});
