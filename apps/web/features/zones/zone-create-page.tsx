"use client";

import { createZoneBoundaryDocument, createZoneThemeDocument } from "@rezics/block";
import { SearchCategoryValues, type SearchCategory } from "@rezics/filter";
import { toContentLanguage } from "@rezics/i18n";
import { usePostApiZones } from "@rezics/openapi-tanstack-query";
import {
	Alert,
	AlertDescription,
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
} from "@rezics/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { RequireSession } from "@/features/auth/require-session";
import { DevelopmentPreviewBoundary } from "@/features/preview-access/components/development-preview-boundary";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { toApiDateTime } from "./model/zone-form";

function ZoneCreateContent() {
	const { locale, t } = useTranslation(["search", "zones"]);
	const router = useRouter();
	const create = usePostApiZones();
	const [categories, setCategories] = useState<readonly SearchCategory[]>(["units"]);
	const [categoriesInvalid, setCategoriesInvalid] = useState(false);
	const [accent, setAccent] = useState("#2563eb");
	const [colorScheme, setColorScheme] = useState<"system" | "light" | "dark">("system");
	const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
	const [startsAt, setStartsAt] = useState("");
	const [endsAt, setEndsAt] = useState("");

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const title = String(data.get("title") ?? "").trim();
		const summary = String(data.get("summary") ?? "").trim();
		if (!title) return;
		if (categories.length === 0) {
			setCategoriesInvalid(true);
			return;
		}
		create.mutate(
			{
				body: {
					localization: {
						language: toContentLanguage(locale.target),
						title,
						...(summary ? { summary } : {}),
					},
					boundaryDocument: createZoneBoundaryDocument([...categories]),
					themeDocument: createZoneThemeDocument({
						accent,
						colorScheme,
						density,
					}),
					startsAt: toApiDateTime(startsAt),
					endsAt: toApiDateTime(endsAt),
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
				<form className="grid gap-6" onSubmit={submit}>
					<FieldGroup>
						<Field required>
							<FieldLabel>{t.zones.create.name}</FieldLabel>
							<Input maxLength={500} name="title" required />
						</Field>
						<Field>
							<FieldLabel>{t.zones.create.summary}</FieldLabel>
							<Textarea maxLength={2000} name="summary" />
						</Field>
						<Field invalid={categoriesInvalid} required>
							<FieldLabel>{t.zones.create.categories}</FieldLabel>
							<ChoiceSelect
								appearance="field"
								ariaLabel={t.zones.create.categories}
								className="h-10 w-full"
								multiple
								onValueChange={(value) => {
									setCategories(value);
									if (value.length > 0) setCategoriesInvalid(false);
								}}
								options={SearchCategoryValues.map((value) => ({
									value,
									label: t.search.categoryOptions[value],
								}))}
								placeholder={t.zones.create.categoriesPlaceholder}
								value={categories}
							/>
							{categoriesInvalid ? (
								<Alert variant="destructive">
									<AlertDescription>
										{t.zones.create.categoriesRequired}
									</AlertDescription>
								</Alert>
							) : null}
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
									if (value === "comfortable" || value === "compact")
										setDensity(value);
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
						<Button
							className="w-fit"
							isLoading={create.isPending}
							type="submit"
							variant="solid"
						>
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
