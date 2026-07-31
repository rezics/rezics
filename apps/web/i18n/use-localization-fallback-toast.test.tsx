/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createToast: vi.fn(),
	replaceCurrentLanguage: vi.fn(),
	requestedLanguage: undefined as "ja" | undefined,
}));

vi.mock("@rezics/ui", () => ({
	toast: { create: mocks.createToast },
}));

vi.mock("./use-localization-languages", () => ({
	useLocalizationLanguageState: () => ({
		status: "ready",
		languages: ["zh"],
		source: "anonymous",
	}),
}));

vi.mock("@/features/content-languages/hooks/use-content-language-navigation", () => ({
	useContentLanguageNavigation: () => ({
		replaceCurrentLanguage: mocks.replaceCurrentLanguage,
	}),
	useRequestedContentLanguage: () => mocks.requestedLanguage,
}));

vi.mock("./client", () => ({
	useTranslation: () => ({
		t: {
			ui: {
				preferredLanguageUnavailable: "Preferred language unavailable",
				requestedLanguageUnavailable: "Requested language unavailable",
			},
		},
	}),
}));

import { useLocalizationFallbackToast } from "./use-localization-fallback-toast";

function StrictModeWrapper({ children }: { readonly children: ReactNode }) {
	return <StrictMode>{children}</StrictMode>;
}

const Input = {
	actualLanguage: "en",
	localizationLanguages: ["zh"],
	unitId: "00000000-0000-4000-8000-000000000001",
} as const;

beforeEach(() => {
	mocks.createToast.mockReset();
	mocks.replaceCurrentLanguage.mockReset();
	mocks.requestedLanguage = undefined;
});

describe("localization fallback toast", () => {
	it("defers the toast beyond the React lifecycle and deduplicates Strict Mode effects", async () => {
		renderHook(() => useLocalizationFallbackToast(Input), { wrapper: StrictModeWrapper });

		expect(mocks.createToast).not.toHaveBeenCalled();
		await act(async () => {});

		expect(mocks.createToast).toHaveBeenCalledOnce();
		expect(mocks.createToast).toHaveBeenCalledWith({
			title: "Preferred language unavailable",
			type: "info",
		});
	});

	it("cancels a queued toast when its owner unmounts", async () => {
		const { unmount } = renderHook(() => useLocalizationFallbackToast(Input));
		unmount();

		await act(async () => {});

		expect(mocks.createToast).not.toHaveBeenCalled();
	});

	it("reports and clears an unavailable explicit language override", async () => {
		mocks.requestedLanguage = "ja";
		renderHook(() =>
			useLocalizationFallbackToast({
				...Input,
				localizationLanguages: ["ja", "zh"],
			}),
		);

		await act(async () => {});

		expect(mocks.createToast).toHaveBeenCalledWith({
			title: "Requested language unavailable",
			type: "info",
		});
		expect(mocks.replaceCurrentLanguage).toHaveBeenCalledWith(undefined);
	});
});
