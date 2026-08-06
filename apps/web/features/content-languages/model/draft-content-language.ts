import type { ContentLanguage } from "@rezics/i18n";

export type DraftContentLanguageDetectionStatus =
	| "idle"
	| "detecting"
	| "insufficient"
	| "detected"
	| "ambiguous"
	| "unsupported"
	| "failed";

export type DraftContentLanguageState =
	| {
			readonly mode: "auto";
			readonly fallbackLanguage: ContentLanguage;
			readonly detectedLanguage?: ContentLanguage;
			readonly detectionStatus: DraftContentLanguageDetectionStatus;
	  }
	| {
			readonly mode: "manual";
			readonly language: ContentLanguage;
	  };

export function selectedDraftContentLanguage(state: DraftContentLanguageState): ContentLanguage {
	return state.mode === "manual"
		? state.language
		: (state.detectedLanguage ?? state.fallbackLanguage);
}

export function updateAutomaticLanguagePreference(
	state: DraftContentLanguageState,
	fallbackLanguage: ContentLanguage,
): DraftContentLanguageState {
	return state.mode === "manual" || state.fallbackLanguage === fallbackLanguage
		? state
		: { ...state, fallbackLanguage };
}
