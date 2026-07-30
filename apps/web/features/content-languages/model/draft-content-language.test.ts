import { describe, expect, it } from "vitest";

import {
	selectedDraftContentLanguage,
	updateAutomaticLanguagePreference,
	type DraftContentLanguageState,
} from "./draft-content-language";

describe("draft content language state", () => {
	it("uses the preference until automatic detection succeeds", () => {
		const state: DraftContentLanguageState = {
			mode: "auto",
			fallbackLanguage: "fr",
			detectionStatus: "insufficient",
		};
		expect(selectedDraftContentLanguage(state)).toBe("fr");
		expect(
			selectedDraftContentLanguage({
				...state,
				detectedLanguage: "de",
				detectionStatus: "detected",
			}),
		).toBe("de");
	});

	it("updates late preferences only while automatic mode owns the value", () => {
		const automatic: DraftContentLanguageState = {
			mode: "auto",
			fallbackLanguage: "en",
			detectionStatus: "idle",
		};
		expect(updateAutomaticLanguagePreference(automatic, "ja")).toMatchObject({
			fallbackLanguage: "ja",
		});
		const manual: DraftContentLanguageState = { mode: "manual", language: "ko" };
		expect(updateAutomaticLanguagePreference(manual, "ja")).toBe(manual);
	});
});
