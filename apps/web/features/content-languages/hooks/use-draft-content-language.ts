"use client";

import { toContentLanguage, type ContentLanguage } from "@rezics/i18n";
import { useCallback, useEffect, useRef, useState } from "react";

import { useLocalizationLanguageState } from "@/i18n/use-localization-languages";
import { useTranslation } from "@/i18n/client";
import type { DraftContentLanguageDetection } from "../model/detect-draft-content-language";
import { prepareDraftContentLanguageSample } from "../model/prepare-draft-content-language-sample";
import {
	selectedDraftContentLanguage,
	updateAutomaticLanguagePreference,
	type DraftContentLanguageState,
} from "../model/draft-content-language";
import { detectDraftContentLanguageInBrowser } from "../model/draft-content-language-detector.client";

const DetectionDebounceMilliseconds = 600;

export type DraftContentLanguageDetector = (
	sample: string,
	signal: AbortSignal,
) => Promise<DraftContentLanguageDetection>;

function automaticStateFor(
	fallbackLanguage: ContentLanguage,
): Extract<DraftContentLanguageState, { readonly mode: "auto" }> {
	return {
		mode: "auto",
		fallbackLanguage,
		detectionStatus: "idle",
	};
}

function stateForDetection(
	state: Extract<DraftContentLanguageState, { readonly mode: "auto" }>,
	result: DraftContentLanguageDetection,
): Extract<DraftContentLanguageState, { readonly mode: "auto" }> {
	return result.status === "detected"
		? {
				...state,
				detectedLanguage: result.language,
				detectionStatus: "detected",
			}
		: {
				mode: "auto",
				fallbackLanguage: state.fallbackLanguage,
				detectionStatus: result.status,
			};
}

export function useDraftContentLanguage(
	sample: string,
	detector: DraftContentLanguageDetector = detectDraftContentLanguageInBrowser,
) {
	const { locale } = useTranslation(["locale"]);
	const localizationState = useLocalizationLanguageState();
	const interfaceLanguage = toContentLanguage(locale.target);
	const preferredLanguage =
		localizationState.status === "ready"
			? (localizationState.languages[0] ?? interfaceLanguage)
			: interfaceLanguage;
	const [state, setState] = useState<DraftContentLanguageState>(() =>
		automaticStateFor(preferredLanguage),
	);
	const [automaticDetectionSession, setAutomaticDetectionSession] = useState(0);
	const stateRef = useRef(state);
	const sampleRef = useRef(sample);
	const activeDetectionRef = useRef<AbortController | undefined>(undefined);
	const requestVersionRef = useRef(0);

	const commit = useCallback((next: DraftContentLanguageState) => {
		stateRef.current = next;
		setState(next);
	}, []);

	useEffect(() => {
		sampleRef.current = sample;
	}, [sample]);

	useEffect(() => {
		const next = updateAutomaticLanguagePreference(stateRef.current, preferredLanguage);
		if (next !== stateRef.current) commit(next);
	}, [commit, preferredLanguage]);

	const applyDetection = useCallback(
		(version: number, result: DraftContentLanguageDetection): ContentLanguage => {
			const current = stateRef.current;
			if (version !== requestVersionRef.current || current.mode === "manual")
				return selectedDraftContentLanguage(current);
			const next = stateForDetection(current, result);
			commit(next);
			return selectedDraftContentLanguage(next);
		},
		[commit],
	);

	useEffect(() => {
		const current = stateRef.current;
		if (current.mode === "manual") return;
		const preparedSample = prepareDraftContentLanguageSample(sample);
		if (!preparedSample) {
			requestVersionRef.current += 1;
			activeDetectionRef.current?.abort();
			commit({
				mode: "auto",
				fallbackLanguage: current.fallbackLanguage,
				detectionStatus: sample.trim() ? "insufficient" : "idle",
			});
			return;
		}

		const version = ++requestVersionRef.current;
		const timeout = window.setTimeout(() => {
			const latest = stateRef.current;
			if (latest.mode === "manual" || version !== requestVersionRef.current) return;
			const controller = new AbortController();
			activeDetectionRef.current?.abort();
			activeDetectionRef.current = controller;
			commit({ ...latest, detectionStatus: "detecting" });
			void detector(preparedSample, controller.signal).then(
				(result) => applyDetection(version, result),
				() => {
					const failed = stateRef.current;
					if (
						controller.signal.aborted ||
						version !== requestVersionRef.current ||
						failed.mode === "manual"
					)
						return;
					commit({
						mode: "auto",
						fallbackLanguage: failed.fallbackLanguage,
						detectionStatus: "failed",
					});
				},
			);
		}, DetectionDebounceMilliseconds);
		return () => window.clearTimeout(timeout);
	}, [applyDetection, automaticDetectionSession, commit, detector, sample]);

	const selectLanguage = useCallback(
		(language: ContentLanguage) => {
			requestVersionRef.current += 1;
			activeDetectionRef.current?.abort();
			commit({ mode: "manual", language });
		},
		[commit],
	);

	const enableAutomaticDetection = useCallback(() => {
		requestVersionRef.current += 1;
		activeDetectionRef.current?.abort();
		commit(automaticStateFor(preferredLanguage));
		setAutomaticDetectionSession((session) => session + 1);
	}, [commit, preferredLanguage]);

	const resolveLanguage = useCallback(
		async (sampleOverride?: string): Promise<ContentLanguage> => {
			const current = stateRef.current;
			if (current.mode === "manual") return current.language;
			const latestSample = sampleOverride ?? sampleRef.current;
			const preparedSample = prepareDraftContentLanguageSample(latestSample);
			if (!preparedSample) {
				const next: DraftContentLanguageState = {
					mode: "auto",
					fallbackLanguage: current.fallbackLanguage,
					detectionStatus: latestSample.trim() ? "insufficient" : "idle",
				};
				commit(next);
				return selectedDraftContentLanguage(next);
			}

			const version = ++requestVersionRef.current;
			activeDetectionRef.current?.abort();
			const controller = new AbortController();
			activeDetectionRef.current = controller;
			commit({ ...current, detectionStatus: "detecting" });
			try {
				const result = await detector(preparedSample, controller.signal);
				return applyDetection(version, result);
			} catch {
				const latest = stateRef.current;
				if (latest.mode === "manual") return latest.language;
				if (version !== requestVersionRef.current) return selectedDraftContentLanguage(latest);
				const failed: DraftContentLanguageState = {
					mode: "auto",
					fallbackLanguage: latest.fallbackLanguage,
					detectionStatus: "failed",
				};
				commit(failed);
				return failed.fallbackLanguage;
			}
		},
		[applyDetection, commit, detector],
	);

	return {
		enableAutomaticDetection,
		language: selectedDraftContentLanguage(state),
		resolveLanguage,
		selectLanguage,
		state,
	};
}

export type DraftContentLanguageController = ReturnType<typeof useDraftContentLanguage>;
