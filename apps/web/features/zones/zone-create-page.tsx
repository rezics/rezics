"use client";

import { createZoneThemeDocument } from "@rezics/block";
import { createFilterDocument, SearchCategoryValues, type SearchCategory } from "@rezics/filter";
import { usePostApiZones } from "@rezics/openapi-tanstack-query";
import {
	Button,
	ChoiceSelect,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	NativeSelect,
	NativeSelectOption,
	PageHeading,
	Textarea,
	UnitPicker,
} from "@rezics/ui";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { type FormEvent, useState } from "react";

import { RequireSession } from "@/features/auth/require-session";
import { DraftContentLanguageField } from "@/features/content-languages/components/draft-content-language-field";
import { useFormDraftContentLanguage } from "@/features/content-languages/hooks/use-form-draft-content-language";
import { DevelopmentPreviewBoundary } from "@/features/preview-access/components/development-preview-boundary";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { toApiDateTime } from "./model/zone-form";

function ZoneCreateContent() {
	const { t } = useTranslation(["search", "ui", "zones"]);
	const router = useApplicationRouter();
	const create = usePostApiZones();
	const [categories, setCategories] = useState<readonly SearchCategory[]>([]);
	const [accent, setAccent] = useState("#2563eb");
	const [colorScheme, setColorScheme] = useState<"system" | "light" | "dark">("system");
	const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
	const [startsAt, setStartsAt] = useState("");
	const [endsAt, setEndsAt] = useState("");
	const [localRuleRealmId, setLocalRuleRealmId] = useState("");
	const language = useFormDraftContentLanguage(["title", "summary"]);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formElement = event.currentTarget;
		const data = new FormData(formElement);
		const title = String(data.get("title") ?? "").trim();
		const summary = String(data.get("summary") ?? "").trim();
		if (!title) return;
		const contentLanguage = await language.resolveLanguage(formElement);
		create.mutate(
			{
				body: {
					localization: {
						language: contentLanguage,
						title,
						...(summary ? { summary } : {}),
					},
					filterDocument: createFilterDocument(
						categories.length ? { categories: [...categories] } : {},
					),
					themeDocument: createZoneThemeDocument({
						accent,
						colorScheme,
						density,
					}),
					startsAt: toApiDateTime(startsAt),
					endsAt: toApiDateTime(endsAt),
					localRuleRealmId: localRuleRealmId || null,
				},
			},
			{
				onSuccess: ({ id }) => router.push(`/zone/${id}/manage`),
			},
		);
	}

	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<div className="grid gap-2">
					<PageHeading title={t.zones.create.title} />
					<p className="text-muted-foreground">{t.zones.create.description}</p>
				</div>
				<form
					className="grid gap-6"
					onInput={language.onInput}
					onSubmit={(event) => void submit(event)}
				>
					<FieldGroup>
						<Field required>
							<FieldLabel>{t.zones.create.name}</FieldLabel>
							<Input maxLength={500} name="title" required />
						</Field>
						<Field>
							<FieldLabel>{t.zones.create.summary}</FieldLabel>
							<Textarea maxLength={2000} name="summary" />
						</Field>
						<DraftContentLanguageField controller={language.controller} />
						<Field>
							<FieldLabel>{t.zones.create.categories}</FieldLabel>
							<ChoiceSelect
								appearance="field"
								ariaLabel={t.zones.create.categories}
								className="h-10 w-full"
								multiple
								onValueChange={setCategories}
								options={SearchCategoryValues.map((value) => ({
									value,
									label: t.search.categoryOptions[value],
								}))}
								placeholder={t.zones.create.categoriesPlaceholder}
								value={categories}
							/>
						</Field>
						<Field>
							<FieldLabel>{t.zones.ruleRealm.label}</FieldLabel>
							<UnitPicker
								ariaLabel={t.zones.ruleRealm.label}
								index="realms"
								kinds={["realm"]}
								onValueChange={(value) => setLocalRuleRealmId(value ?? "")}
								placeholder={t.ui.pickerPlaceholders.realm}
								value={localRuleRealmId}
							/>
							<p className="text-muted-foreground text-sm">{t.zones.ruleRealm.description}</p>
						</Field>
						<Field>
							<FieldLabel>{t.zones.create.accent}</FieldLabel>
							<Input
								onChange={(event) => setAccent(event.currentTarget.value)}
								type="color"
								value={accent}
							/>
						</Field>
						<Field>
							<FieldLabel>{t.zones.create.colorScheme}</FieldLabel>
							<NativeSelect
								onChange={(event) => {
									const value = event.currentTarget.value;
									if (value === "system" || value === "light" || value === "dark")
										setColorScheme(value);
								}}
								value={colorScheme}
							>
								{(["system", "light", "dark"] as const).map((value) => (
									<NativeSelectOption key={value} value={value}>
										{t.zones.create.colorSchemes[value]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel>{t.zones.create.density}</FieldLabel>
							<NativeSelect
								onChange={(event) => {
									const value = event.currentTarget.value;
									if (value === "comfortable" || value === "compact") setDensity(value);
								}}
								value={density}
							>
								{(["comfortable", "compact"] as const).map((value) => (
									<NativeSelectOption key={value} value={value}>
										{t.zones.create.densities[value]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel>{t.zones.create.startsAt}</FieldLabel>
							<Input
								onChange={(event) => setStartsAt(event.currentTarget.value)}
								type="datetime-local"
								value={startsAt}
							/>
						</Field>
						<Field>
							<FieldLabel>{t.zones.create.endsAt}</FieldLabel>
							<Input
								min={startsAt || undefined}
								onChange={(event) => setEndsAt(event.currentTarget.value)}
								type="datetime-local"
								value={endsAt}
							/>
						</Field>
						<RequestFailure error={create.error} />
						<Button className="w-fit" isLoading={create.isPending} type="submit" variant="solid">
							{t.zones.create.submit}
						</Button>
					</FieldGroup>
				</form>
			</main>
		</RequireSession>
	);
}

export function ZoneCreatePage() {
	return (
		<DevelopmentPreviewBoundary>
			<ZoneCreateContent />
		</DevelopmentPreviewBoundary>
	);
}
