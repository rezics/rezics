"use client";

import {
	isDocument,
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
	UnitPicker,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import type { FormEvent } from "react";

import { LocalizedDraftGate } from "@/features/content-languages/components/localized-draft-gate";
import {
	useContentLanguageEditor,
	useLocalizedDraft,
	type LocalizedDraftCodec,
} from "@/features/content-languages/hooks/use-content-language-editor";
import {
	decodeDraftAvatar,
	decodeDraftString,
	isDraftRecord,
} from "@/features/content-languages/model/localized-draft-codec";
import {
	AvatarField,
	avatarPresentationToInput,
	type AvatarFieldOption,
	type AvatarFieldValue,
} from "@/features/media/components/avatar-field";
import { LocalizationMediaFallbackNotice } from "@/features/media/components/localization-media-fallback-notice";
import { ContentLanguageControl } from "@/features/content-languages/components/content-language-control";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { toApiDateTime, toLocalDateTime } from "../model/zone-form";
import { useZoneManagement } from "./workspace";

type ZoneLocalizationDraft = {
	readonly title: string;
	readonly summary: string;
	readonly avatar: AvatarFieldValue | null;
};

type ZoneSharedDraft = {
	readonly slug: string;
	readonly localRuleRealmId: string;
	readonly startsAt: string;
	readonly endsAt: string;
	readonly theme: ZoneTheme;
};

const ZoneLocalizationDraftCodec: LocalizedDraftCodec<ZoneLocalizationDraft> = {
	version: 1,
	decode(value) {
		if (!isDraftRecord(value)) return;
		const title = decodeDraftString(value.title);
		const summary = decodeDraftString(value.summary);
		const avatar = decodeDraftAvatar(value.avatar);
		return title === undefined || summary === undefined || avatar === undefined
			? undefined
			: { title, summary, avatar };
	},
};

const ZoneSharedDraftCodec: LocalizedDraftCodec<ZoneSharedDraft> = {
	version: 2,
	decode(value) {
		if (!isDraftRecord(value)) return;
		const slug = decodeDraftString(value.slug);
		const localRuleRealmId = decodeDraftString(value.localRuleRealmId);
		const startsAt = decodeDraftString(value.startsAt);
		const endsAt = decodeDraftString(value.endsAt);
		if (
			slug === undefined ||
			localRuleRealmId === undefined ||
			startsAt === undefined ||
			endsAt === undefined ||
			!isDocument(ZoneThemeDocument, value.theme)
		)
			return;
		return { slug, localRuleRealmId, startsAt, endsAt, theme: value.theme };
	},
};

export function ZoneManagementOverview() {
	const { selectedLanguage } = useContentLanguageEditor();
	return <ZoneManagementOverviewForLanguage key={selectedLanguage} />;
}

function ZoneManagementOverviewForLanguage() {
	const { t } = useTranslation(["errors", "locale", "media", "ui", "zones"]);
	const { selectedLanguage, selectedLanguageIsPending, languagesChanged } =
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
			? [{ ...item.avatar, label: t.locale.contentLanguages[item.language] }]
			: [],
	);
	const initialTheme = parseDocument(ZoneThemeDocument, zone.themeDocument);
	const localizationDraft = useLocalizedDraft<ZoneLocalizationDraft>({
		scope: "zone-overview-localization",
		baseVersion: zone.updatedAt,
		codec: ZoneLocalizationDraftCodec,
		createInitialValue: () => ({
			title: selectedLanguageIsPending ? "" : (selected?.title ?? ""),
			summary: selectedLanguageIsPending ? "" : (selected?.summary ?? ""),
			avatar: selectedLanguageIsPending ? null : (selected?.avatar ?? null),
		}),
	});
	const sharedDraft = useLocalizedDraft<ZoneSharedDraft>({
		scope: "zone-overview-shared",
		partition: "shared",
		baseVersion: zone.updatedAt,
		codec: ZoneSharedDraftCodec,
		createInitialValue: () => ({
			slug: zone.slugAddress?.slug ?? "",
			localRuleRealmId: zone.localRuleRealmId ?? "",
			startsAt: toLocalDateTime(zone.startsAt),
			endsAt: toLocalDateTime(zone.endsAt),
			theme: initialTheme,
		}),
	});
	const localization = localizationDraft.value;
	const shared = sharedDraft.value;

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		try {
			await update.mutateAsync({
				path: { zoneId },
				body: {
					localization: {
						language: selectedLanguage,
						title: localization.title.trim(),
						summary: localization.summary.trim(),
						avatar: avatarPresentationToInput(localization.avatar),
					},
					themeDocument: shared.theme,
					localRuleRealmId: shared.localRuleRealmId || null,
					startsAt: toApiDateTime(shared.startsAt),
					endsAt: toApiDateTime(shared.endsAt),
				},
			});
			if (shared.slug && shared.slug !== zone.slugAddress?.slug)
				await replaceSlug.mutateAsync({ path: { zoneId }, body: { slug: shared.slug } });
			localizationDraft.commit();
			sharedDraft.commit();
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
				<CardContent className="grid gap-6 p-6">
					{zone.capabilities.canManage ? <ContentLanguageControl /> : null}
					{zone.capabilities.canManage ? <LocalizationMediaFallbackNotice /> : null}
					<LocalizedDraftGate
						hydrated={localizationDraft.hydrated && sharedDraft.hydrated}
						onDiscard={() => {
							localizationDraft.discard();
							sharedDraft.discard();
						}}
						serverChanged={localizationDraft.serverChanged || sharedDraft.serverChanged}
					>
						<form className="grid gap-6" onSubmit={submit}>
							<h2 className="font-semibold text-lg">{t.zones.management.profile.title}</h2>
							<FieldGroup className="grid gap-4 sm:grid-cols-2">
								<Field required>
									<FieldLabel>{t.zones.management.profile.name}</FieldLabel>
									<Input
										maxLength={500}
										onChange={(event) => {
											const title = event.currentTarget.value;
											localizationDraft.setValue((current) => ({
												...current,
												title,
											}));
										}}
										required
										value={localization.title}
									/>
								</Field>
								<Field className="sm:col-span-2">
									<FieldLabel>{t.zones.management.profile.summary}</FieldLabel>
									<Textarea
										maxLength={2_000}
										onChange={(event) => {
											const summary = event.currentTarget.value;
											localizationDraft.setValue((current) => ({
												...current,
												summary,
											}));
										}}
										value={localization.summary}
									/>
								</Field>
								<Field className="sm:col-span-2">
									<FieldLabel>{t.media.roles.avatar.title}</FieldLabel>
									<AvatarField
										fallback={avatarOptions[0] ?? null}
										onChange={(avatar) =>
											localizationDraft.setValue((current) => ({
												...current,
												avatar,
											}))
										}
										options={avatarOptions}
										value={localization.avatar}
									/>
								</Field>
								<Field>
									<FieldLabel>{t.zones.management.profile.slug}</FieldLabel>
									<Input
										onChange={(event) => {
											const slug = event.currentTarget.value;
											sharedDraft.setValue((current) => ({
												...current,
												slug,
											}));
										}}
										pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
										required={Boolean(zone.slugAddress)}
										value={shared.slug}
									/>
								</Field>
								<Field>
									<FieldLabel>{t.zones.ruleRealm.label}</FieldLabel>
									<UnitPicker
										ariaLabel={t.zones.ruleRealm.label}
										index="realms"
										kinds={["realm"]}
										onValueChange={(localRuleRealmId) =>
											sharedDraft.setValue((current) => ({
												...current,
												localRuleRealmId: localRuleRealmId ?? "",
											}))
										}
										placeholder={t.ui.pickerPlaceholders.realm}
										value={shared.localRuleRealmId}
									/>
									<p className="text-muted-foreground text-sm">{t.zones.ruleRealm.description}</p>
								</Field>
								<Field>
									<FieldLabel>{t.zones.management.profile.accent}</FieldLabel>
									<Input
										onChange={(event) => {
											const accent = event.currentTarget.value;
											sharedDraft.setValue((current) => ({
												...current,
												theme: { ...current.theme, accent },
											}));
										}}
										type="color"
										value={shared.theme.accent}
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
												sharedDraft.setValue((current) => ({
													...current,
													theme: { ...current.theme, colorScheme },
												}));
										}}
										value={shared.theme.colorScheme}
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
												sharedDraft.setValue((current) => ({
													...current,
													theme: { ...current.theme, density },
												}));
										}}
										value={shared.theme.density}
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
										onChange={(event) => {
											const startsAt = event.currentTarget.value;
											sharedDraft.setValue((current) => ({
												...current,
												startsAt,
											}));
										}}
										type="datetime-local"
										value={shared.startsAt}
									/>
								</Field>
								<Field>
									<FieldLabel>{t.zones.management.profile.endsAt}</FieldLabel>
									<Input
										onChange={(event) => {
											const endsAt = event.currentTarget.value;
											sharedDraft.setValue((current) => ({
												...current,
												endsAt,
											}));
										}}
										type="datetime-local"
										value={shared.endsAt}
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
					</LocalizedDraftGate>
				</CardContent>
			</Card>
			<div className="mt-6 grid gap-4 sm:grid-cols-2">
				{sections
					.filter((section) => section.id !== "overview")
					.map((section) => (
						<Link href={section.href} key={section.id}>
							<Card appearance="outlined" className="h-full transition-colors hover:bg-accent">
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
