/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentLanguage } from "@rezics/i18n";
import type { LocalizationLanguageState } from "@/i18n/use-localization-languages";
import type { DraftContentLanguageDetection } from "../model/detect-draft-content-language";

let localizationState: LocalizationLanguageState;

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({ locale: { target: "zh-Hant" } }),
}));

vi.mock("@/i18n/use-localization-languages", () => ({
	useLocalizationLanguageState: () => localizationState,
}));

import {
	useDraftContentLanguage,
	type DraftContentLanguageDetector,
} from "./use-draft-content-language";

const EnglishSample =
	"This article explains how communities organize knowledge across several subjects and languages.";

function deferredDetection() {
	let resolve: ((value: DraftContentLanguageDetection) => void) | undefined;
	const promise = new Promise<DraftContentLanguageDetection>((fulfil) => {
		resolve = fulfil;
	});
	return {
		promise,
		resolve(value: DraftContentLanguageDetection) {
			if (!resolve) throw new Error("Detection promise was not initialized");
			resolve(value);
		},
	};
}

beforeEach(() => {
	localizationState = { status: "restoring" };
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("useDraftContentLanguage", () => {
	it("adopts a late first-language preference only in automatic mode", () => {
		const detector = vi.fn<DraftContentLanguageDetector>();
		const { result, rerender } = renderHook(() => useDraftContentLanguage("", detector));
		expect(result.current.language).toBe("zh");

		localizationState = {
			status: "ready",
			languages: ["fr", "en"],
			source: "profile",
		};
		rerender();
		expect(result.current.language).toBe("fr");

		act(() => result.current.selectLanguage("ko"));
		localizationState = {
			status: "ready",
			languages: ["de", "en"],
			source: "profile",
		};
		rerender();
		expect(result.current.language).toBe("ko");
	});

	it("ignores a pending automatic result after a manual selection", async () => {
		const pending = deferredDetection();
		const detector = vi.fn<DraftContentLanguageDetector>(() => pending.promise);
		const { result } = renderHook(() => useDraftContentLanguage(EnglishSample, detector));

		await act(async () => vi.advanceTimersByTime(600));
		expect(detector).toHaveBeenCalledOnce();
		act(() => result.current.selectLanguage("ja"));
		await act(async () => pending.resolve({ status: "detected", language: "en" }));
		expect(result.current.language).toBe("ja");
		expect(result.current.state.mode).toBe("manual");
	});

	it("flushes the latest sample before submit", async () => {
		const detector = vi.fn<DraftContentLanguageDetector>(async () => ({
			status: "detected",
			language: "de",
		}));
		const { result } = renderHook(() => useDraftContentLanguage(EnglishSample, detector));

		let language: ContentLanguage | undefined;
		await act(async () => {
			language = await result.current.resolveLanguage();
		});
		expect(language).toBe("de");
		expect(result.current.language).toBe("de");
	});

	it("returns to preference-backed automatic detection on request", () => {
		localizationState = {
			status: "ready",
			languages: ["es"],
			source: "profile",
		};
		const detector = vi.fn<DraftContentLanguageDetector>();
		const { result } = renderHook(() => useDraftContentLanguage("", detector));
		act(() => result.current.selectLanguage("ja"));
		act(() => result.current.enableAutomaticDetection());
		expect(result.current.state.mode).toBe("auto");
		expect(result.current.language).toBe("es");
	});

	it("restarts detection for the current sample after returning to automatic mode", async () => {
		const detector = vi.fn<DraftContentLanguageDetector>(async () => ({
			status: "detected",
			language: "en",
		}));
		const { result } = renderHook(() => useDraftContentLanguage(EnglishSample, detector));
		act(() => result.current.selectLanguage("ja"));
		act(() => result.current.enableAutomaticDetection());
		await act(async () => vi.advanceTimersByTime(600));
		expect(detector).toHaveBeenCalledOnce();
		expect(result.current.language).toBe("en");
	});
});
