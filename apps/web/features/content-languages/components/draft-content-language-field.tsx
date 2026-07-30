"use client";

import { ContentLanguageValues, isContentLanguage } from "@rezics/i18n";
import {
	Button,
	Field,
	FieldDescription,
	FieldLabel,
	NativeSelect,
	NativeSelectOption,
} from "@rezics/ui";

import { useTranslation } from "@/i18n/client";
import type { DraftContentLanguageController } from "../hooks/use-draft-content-language";

export function DraftContentLanguageField({
	controller,
}: {
	readonly controller: DraftContentLanguageController;
}) {
	const { t } = useTranslation(["locale"]);
	const { state } = controller;
	const statusText =
		state.mode === "manual"
			? t.locale.draftContentLanguage.manual
			: state.detectionStatus === "detected"
				? t.locale.draftContentLanguage.detected({
						language: t.locale.contentLanguages[controller.language],
					})
				: t.locale.draftContentLanguage[state.detectionStatus];

	return (
		<Field>
			<FieldLabel>{t.locale.draftContentLanguage.label}</FieldLabel>
			<div className="flex flex-wrap items-center gap-2">
				<NativeSelect
					aria-label={t.locale.draftContentLanguage.label}
					onChange={(event) => {
						const language = event.currentTarget.value;
						if (language === "automatic") {
							controller.enableAutomaticDetection();
							return;
						}
						if (isContentLanguage(language)) controller.selectLanguage(language);
					}}
					value={state.mode === "auto" ? "automatic" : controller.language}
				>
					<NativeSelectOption value="automatic">
						{t.locale.draftContentLanguage.automaticOption({
							language: t.locale.contentLanguages[controller.language],
						})}
					</NativeSelectOption>
					{ContentLanguageValues.map((language) => (
						<NativeSelectOption key={language} value={language}>
							{t.locale.contentLanguages[language]}
						</NativeSelectOption>
					))}
				</NativeSelect>
				{state.mode === "manual" ? (
					<Button
						onClick={controller.enableAutomaticDetection}
						size="sm"
						type="button"
						variant="outline"
					>
						{t.locale.draftContentLanguage.useAutomatic}
					</Button>
				) : null}
			</div>
			<FieldDescription>{statusText}</FieldDescription>
		</Field>
	);
}
