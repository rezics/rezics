"use client";

import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { Settings2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";

import { Button } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { useContentLanguageEditor } from "../hooks/use-content-language-editor";

const ContentLanguageSettingsDialog = dynamic(
	() =>
		import("./content-language-settings-dialog").then(
			(module) => module.ContentLanguageSettingsDialog,
		),
	{ ssr: false },
);

export function ContentLanguageControl() {
	const { t } = useTranslation(["locale", "units"]);
	const { languages, selectedLanguage, selectedLanguageIsPending, requestLanguage } =
		useContentLanguageEditor();
	const [settingsOpen, setSettingsOpen] = useState(false);
	const settingsButton = useRef<HTMLButtonElement>(null);
	const selectorLanguages = selectedLanguageIsPending
		? [...languages, selectedLanguage]
		: languages;
	return (
		<div className="flex flex-wrap items-center justify-end gap-2">
			<NativeSelect
				aria-label={t.units.contentLanguages.controlLabel}
				onChange={(event) => {
					const language = event.currentTarget.value;
					if (language === "zh" || language === "en") requestLanguage(language);
				}}
				value={selectedLanguage}
			>
				{selectorLanguages.map((language) => (
					<NativeSelectOption key={language} value={language}>
						{t.locale[language]}
						{language === selectedLanguage && selectedLanguageIsPending
							? ` · ${t.units.contentLanguages.pending}`
							: ""}
					</NativeSelectOption>
				))}
			</NativeSelect>
			<Button
				ref={settingsButton}
				onClick={() => setSettingsOpen(true)}
				size="sm"
				type="button"
				variant="outline"
			>
				<Settings2 aria-hidden />
				{t.units.contentLanguages.settings}
			</Button>
			{settingsOpen ? (
				<ContentLanguageSettingsDialog
					onOpenChange={(open) => {
						setSettingsOpen(open);
						if (!open) requestAnimationFrame(() => settingsButton.current?.focus());
					}}
					open
				/>
			) : null}
		</div>
	);
}
