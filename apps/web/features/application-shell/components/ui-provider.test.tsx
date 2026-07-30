/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	useLocalizationLanguages: vi.fn(() => ["ja"]),
}));

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("@/i18n/use-localization-languages", () => ({
	useLocalizationLanguages: mocks.useLocalizationLanguages,
}));

import { TranslationProvider } from "@/i18n/client";
import { RootTranslationNamespaces } from "@/i18n/namespaces";
import { ApplicationUiProvider, TranslatedUiProvider } from "./ui-provider";

const translation = await create(resources).getTranslation(RootTranslationNamespaces, ["en"]);

afterEach(() => {
	cleanup();
	mocks.useLocalizationLanguages.mockClear();
});

describe("application UI providers", () => {
	it("keeps the translated provider independent from session-backed language state", () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<TranslatedUiProvider localizationLanguages={["en"]}>
					<span>content</span>
				</TranslatedUiProvider>
			</TranslationProvider>,
		);

		expect(screen.getByText("content")).toBeTruthy();
		expect(mocks.useLocalizationLanguages).not.toHaveBeenCalled();
	});

	it("derives languages only in the application adapter", () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<ApplicationUiProvider>
					<span>content</span>
				</ApplicationUiProvider>
			</TranslationProvider>,
		);

		expect(screen.getByText("content")).toBeTruthy();
		expect(mocks.useLocalizationLanguages).toHaveBeenCalledOnce();
	});
});
