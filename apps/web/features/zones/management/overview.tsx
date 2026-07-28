"use client";

import {
	parseDocument,
	ZoneThemeDocument,
	type ZoneThemeDocument as ZoneTheme,
} from "@rezics/block";
import {
	getApiZonesByZoneIdQueryKey,
	usePatchApiZonesByZoneId,
	useReplaceZoneSlugAddress,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	NativeSelect,
	NativeSelectOption,
	Textarea,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import {
	AvatarField,
	avatarPresentationToInput,
	type AvatarFieldOption,
	type AvatarFieldValue,
} from "@/features/media/components/avatar-field";
import { useContentLanguageEditor } from "@/features/content-languages/hooks/use-content-language-editor";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { toApiDateTime, toLocalDateTime } from "../model/zone-form";
import { useZoneManagement } from "./workspace";

export function ZoneManagementOverview() {
	const { selectedLanguage } = useContentLanguageEditor();
	return <ZoneManagementOverviewForLanguage key={selectedLanguage} />;
}

function ZoneManagementOverviewForLanguage() {
	const { t } = useTranslation(["errors", "locale", "media", "ui", "zones"]);
	const { selectedLanguage, selectedLanguageIsPending, setDirty, languagesChanged } =
		useContentLanguageEditor();
	const { sections, zone, zoneId } = useZoneManagement();
	const queryClient = useQueryClient();
	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: getApiZonesByZoneIdQueryKey({ path: { zoneId } }),
		});
	const update = usePatchApiZonesByZoneId({ mutation: { onSuccess: invalidate } });
	const replaceSlug = useReplaceZoneSlugAddress({ mutation: { onSuccess: invalidate } });
	const selected = zone.localizations.find((item) => item.language === selectedLanguage);
	const avatarOptions: AvatarFieldOption[] = zone.localizations.flatMap((item) =>
		item.language !== selectedLanguage && item.avatar
			? [{ ...item.avatar, label: t.locale[item.language] }]
			: [],
	);
	const [title, setTitle] = useState(selectedLanguageIsPending ? "" : (selected?.title ?? ""));
	const [summary, setSummary] = useState(
		selectedLanguageIsPending ? "" : (selected?.summary ?? ""),
	);
	const [avatar, setAvatar] = useState<AvatarFieldValue | null>(
		selectedLanguageIsPending ? null : (selected?.avatar ?? null),
	);
	const [slug, setSlug] = useState(zone.slugAddress?.slug ?? "");
	const [startsAt, setStartsAt] = useState(toLocalDateTime(zone.startsAt));
	const [endsAt, setEndsAt] = useState(toLocalDateTime(zone.endsAt));
	const initialTheme = parseDocument(ZoneThemeDocument, zone.themeDocument);
	const [theme, setTheme] = useState<ZoneTheme>(initialTheme);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		try {
			await update.mutateAsync({
				path: { zoneId },
				body: {
					localization: {
						language: selectedLanguage,
						title: title.trim(),
						summary: summary.trim(),
						avatar: avatarPresentationToInput(avatar),
					},
					themeDocument: theme,
					startsAt: toApiDateTime(startsAt),
					endsAt: toApiDateTime(endsAt),
				},
			});
			if (slug && slug !== zone.slugAddress?.slug)
				await replaceSlug.mutateAsync({ path: { zoneId }, body: { slug } });
			setDirty(false);
			await languagesChanged();
		} catch {
			// Typed mutation state supplies the visible request failure.
		}
	}

	return (
		<section>
			<h1 className="font-semibold text-2xl">{t.zones.management.sections.overview.label}</h1>
			<p className="mt-2 text-muted-foreground">
				{t.zones.management.sections.overview.description}
			</p>
			<Card appearance="outlined" className="mt-6">
				<CardContent className="p-6">
					<form className="grid gap-6" onChange={() => setDirty(true)} onSubmit={submit}>
						<h2 className="font-semibold text-lg">
							{t.zones.management.profile.title}
						</h2>
						<FieldGroup className="grid gap-4 sm:grid-cols-2">
							<Field required>
								<FieldLabel>{t.zones.management.profile.name}</FieldLabel>
								<Input
									maxLength={500}
									onChange={(event) => setTitle(event.currentTarget.value)}
									required
									value={title}
								/>
							</Field>
							<Field className="sm:col-span-2">
								<FieldLabel>{t.zones.management.profile.summary}</FieldLabel>
								<Textarea
									maxLength={2_000}
									onChange={(event) => setSummary(event.currentTarget.value)}
									value={summary}
								/>
							</Field>
							<Field className="sm:col-span-2">
								<FieldLabel>{t.media.roles.avatar.title}</FieldLabel>
								<AvatarField
									fallback={avatarOptions[0] ?? null}
									onChange={(value) => {
										setAvatar(value);
										setDirty(true);
									}}
									options={avatarOptions}
									value={avatar}
								/>
							</Field>
							<Field>
								<FieldLabel>{t.zones.management.profile.slug}</FieldLabel>
								<Input
									onChange={(event) => setSlug(event.currentTarget.value)}
									pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
									required={Boolean(zone.slugAddress)}
									value={slug}
								/>
							</Field>
							<Field>
								<FieldLabel>{t.zones.management.profile.accent}</FieldLabel>
								<Input
									onChange={(event) =>
										setTheme({ ...theme, accent: event.currentTarget.value })
									}
									type="color"
									value={theme.accent}
								/>
							</Field>
							<Field>
								<FieldLabel>{t.zones.management.profile.colorScheme}</FieldLabel>
								<NativeSelect
									onChange={(event) => {
										const colorScheme = event.currentTarget.value;
										if (
											colorScheme === "system" ||
											colorScheme === "light" ||
											colorScheme === "dark"
										)
											setTheme({ ...theme, colorScheme });
									}}
									value={theme.colorScheme}
								>
									{(["system", "light", "dark"] as const).map((value) => (
										<NativeSelectOption key={value} value={value}>
											{t.zones.management.profile.colorSchemes[value]}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Field>
							<Field>
								<FieldLabel>{t.zones.management.profile.density}</FieldLabel>
								<NativeSelect
									onChange={(event) => {
										const density = event.currentTarget.value;
										if (density === "comfortable" || density === "compact")
											setTheme({ ...theme, density });
									}}
									value={theme.density}
								>
									{(["comfortable", "compact"] as const).map((value) => (
										<NativeSelectOption key={value} value={value}>
											{t.zones.management.profile.densities[value]}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Field>
							<Field>
								<FieldLabel>{t.zones.management.profile.startsAt}</FieldLabel>
								<Input
									onChange={(event) => setStartsAt(event.currentTarget.value)}
									type="datetime-local"
									value={startsAt}
								/>
							</Field>
							<Field>
								<FieldLabel>{t.zones.management.profile.endsAt}</FieldLabel>
								<Input
									onChange={(event) => setEndsAt(event.currentTarget.value)}
									type="datetime-local"
									value={endsAt}
								/>
							</Field>
						</FieldGroup>
						<Button isLoading={update.isPending || replaceSlug.isPending} type="submit">
							{t.zones.management.profile.save}
						</Button>
						<RequestFailure
							error={update.error ?? replaceSlug.error}
							fallback={t.ui.retryLater}
						/>
					</form>
				</CardContent>
			</Card>
			<div className="mt-6 grid gap-4 sm:grid-cols-2">
				{sections
					.filter((section) => section.id !== "overview")
					.map((section) => (
						<Link href={section.href} key={section.id}>
							<Card
								appearance="outlined"
								className="h-full transition-colors hover:bg-accent"
							>
								<CardHeader>
									<CardTitle>{section.label}</CardTitle>
									<CardDescription>{section.description}</CardDescription>
								</CardHeader>
								<CardContent />
							</Card>
						</Link>
					))}
			</div>
		</section>
	);
}
