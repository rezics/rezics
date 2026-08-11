"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";

import {
	joinDraftContentLanguageSample,
	readDraftContentLanguageFormSample,
} from "../model/draft-content-language-sample";
import { useDraftContentLanguage } from "./use-draft-content-language";

export function useFormDraftContentLanguage(
	fieldNames: readonly string[],
	additionalText?: string,
) {
	const fieldNamesKey = fieldNames.join("\u0000");
	const stableFieldNames = useMemo(
		() => (fieldNamesKey ? fieldNamesKey.split("\u0000") : []),
		[fieldNamesKey],
	);
	const [formSample, setFormSample] = useState("");
	const controller = useDraftContentLanguage(
		joinDraftContentLanguageSample([formSample, additionalText]),
	);
	const onInput = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			setFormSample(readDraftContentLanguageFormSample(event.currentTarget, stableFieldNames));
		},
		[stableFieldNames],
	);
	const resolveLanguage = useCallback(
		(form: HTMLFormElement) =>
			controller.resolveLanguage(
				readDraftContentLanguageFormSample(form, stableFieldNames, additionalText),
			),
		[additionalText, controller, stableFieldNames],
	);
	const reset = useCallback(() => {
		setFormSample("");
		controller.enableAutomaticDetection();
	}, [controller]);

	return { controller, onInput, reset, resolveLanguage };
}
