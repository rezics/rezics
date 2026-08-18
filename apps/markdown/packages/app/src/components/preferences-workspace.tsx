import { ChoiceSelect } from "@rezics/ui/custom/choice-select";
import { Button } from "@rezics/ui/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@rezics/ui/ui/field";
import ArrowLeftIcon from "lucide-react/dist/esm/icons/arrow-left.mjs";
import FilesIcon from "lucide-react/dist/esm/icons/files.mjs";
import Settings2Icon from "lucide-react/dist/esm/icons/settings-2.mjs";
import type { ReactElement } from "react";
import {
	isMarkdownThemePreference,
	markdownThemePreferences,
	type MarkdownThemePreference,
} from "../domain/appearance";
import { isMarkdownPreferenceSection, type MarkdownPreferenceSection } from "../domain/preferences";
import {
	isMarkdownEditorLocale,
	markdownEditorLocales,
	type MarkdownEditorLocale,
	type MarkdownEditorMessages,
} from "../i18n/messages";

export function PreferencesWorkspace({
	messages,
	section,
	onSectionChange,
	locale,
	onLocaleChange,
	themePreference,
	onThemePreferenceChange,
	onBack,
}: {
	readonly messages: MarkdownEditorMessages;
	readonly section: MarkdownPreferenceSection;
	readonly onSectionChange: (section: MarkdownPreferenceSection) => void;
	readonly locale: MarkdownEditorLocale;
	readonly onLocaleChange: (locale: MarkdownEditorLocale) => void;
	readonly themePreference: MarkdownThemePreference;
	readonly onThemePreferenceChange: (preference: MarkdownThemePreference) => void;
	readonly onBack: () => void;
}): ReactElement {
	const sections = [
		{
			id: "general" as const,
			label: messages.preferences.general,
			description: messages.preferences.generalDescription,
			icon: Settings2Icon,
		},
		{
			id: "files" as const,
			label: messages.preferences.files,
			description: messages.preferences.filesDescription,
			icon: FilesIcon,
		},
	];

	return (
		<main
			aria-label={messages.preferences.title}
			className="flex h-dvh min-h-[32rem] min-w-0 flex-col overflow-auto bg-background text-foreground"
		>
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 py-3 sm:px-4 sm:py-4">
				<header className="border-border border-b pb-3">
					<Button className="-ms-2 mb-2 w-fit" onClick={onBack} size="sm" variant="ghost">
						<ArrowLeftIcon />
						{messages.preferences.backToEditor}
					</Button>
					<h1 className="font-heading font-semibold text-lg leading-tight tracking-tight">
						{messages.preferences.title}
					</h1>
					<p className="mt-1 max-w-2xl text-muted-foreground text-sm leading-5">
						{messages.preferences.description}
					</p>
				</header>

				<div className="md:hidden">
					<ChoiceSelect
						appearance="field"
						ariaLabel={messages.preferences.navigation}
						className="h-8 w-full"
						onValueChange={(value) => {
							const next = value[0];
							if (isMarkdownPreferenceSection(next)) onSectionChange(next);
						}}
						options={sections.map((item) => ({
							value: item.id,
							label: item.label,
						}))}
						placeholder={messages.preferences.navigation}
						size="sm"
						value={[section]}
					/>
				</div>

				<div className="grid min-w-0 items-start gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
					<nav
						aria-label={messages.preferences.navigation}
						className="sticky top-3 hidden content-start gap-0.5 self-start md:grid"
					>
						{sections.map((item) => {
							const Icon = item.icon;
							const active = item.id === section;
							return (
								<button
									aria-current={active ? "page" : undefined}
									className={
										active
											? "flex h-8 min-w-0 items-center gap-2 rounded-md bg-accent px-2 py-1.5 font-medium text-accent-foreground text-sm"
											: "flex h-8 min-w-0 items-center gap-2 rounded-md px-2 py-1.5 font-medium text-muted-foreground text-sm hover:bg-accent/70 hover:text-foreground"
									}
									key={item.id}
									onClick={() => onSectionChange(item.id)}
									type="button"
								>
									<Icon aria-hidden className="size-4 shrink-0" />
									<span className="min-w-0 flex-1 truncate text-start">{item.label}</span>
								</button>
							);
						})}
					</nav>

					<div className="min-w-0">
						{section === "general" ? (
							<section aria-labelledby="markdown-preferences-general">
								<header className="mb-4">
									<h2
										className="font-heading font-semibold text-base leading-tight tracking-tight"
										id="markdown-preferences-general"
									>
										{messages.preferences.general}
									</h2>
									<p className="mt-1 max-w-2xl text-muted-foreground text-sm leading-5">
										{messages.preferences.generalDescription}
									</p>
								</header>
								<FieldGroup className="max-w-md gap-4">
									<Field>
										<FieldLabel>{messages.labels.language}</FieldLabel>
										<ChoiceSelect
											appearance="field"
											ariaLabel={messages.labels.language}
											className="h-8 w-full"
											onValueChange={(value) => {
												const next = value[0];
												if (isMarkdownEditorLocale(next)) onLocaleChange(next);
											}}
											options={markdownEditorLocales.map((availableLocale) => ({
												value: availableLocale,
												label: messages.languages[availableLocale],
											}))}
											placeholder={messages.labels.language}
											size="sm"
											value={[locale]}
										/>
									</Field>
									<Field>
										<FieldLabel>{messages.preferences.theme}</FieldLabel>
										<FieldDescription>{messages.preferences.themeDescription}</FieldDescription>
										<ChoiceSelect
											appearance="field"
											ariaLabel={messages.preferences.theme}
											className="h-8 w-full"
											onValueChange={(value) => {
												const next = value[0];
												if (isMarkdownThemePreference(next)) onThemePreferenceChange(next);
											}}
											options={markdownThemePreferences.map((preference) => ({
												value: preference,
												label: messages.preferences.themes[preference],
											}))}
											placeholder={messages.preferences.theme}
											size="sm"
											value={[themePreference]}
										/>
									</Field>
								</FieldGroup>
							</section>
						) : (
							<section aria-labelledby="markdown-preferences-files">
								<header className="mb-4">
									<h2
										className="font-heading font-semibold text-base leading-tight tracking-tight"
										id="markdown-preferences-files"
									>
										{messages.preferences.files}
									</h2>
									<p className="mt-1 max-w-2xl text-muted-foreground text-sm leading-5">
										{messages.preferences.filesDescription}
									</p>
								</header>
								<p className="max-w-2xl text-muted-foreground text-sm leading-5">
									{messages.preferences.filesPlaceholder}
								</p>
							</section>
						)}
					</div>
				</div>
			</div>
		</main>
	);
}
