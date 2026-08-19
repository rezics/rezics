"use client";

import {
	getApiUsersByIdQueryKey,
	getApiUsersMePreferencesQueryKey,
	getApiUsersMeQueryKey,
	useGetApiRealmsByRealmId,
	useGetApiUsersMe,
	useGetApiUsersMePreferences,
	usePatchApiUsersMe,
	usePutApiUsersMePreferences,
	useAssignCurrentProfileSlug,
	type GetApiUsersMeStatus200,
	type PutApiUsersMePreferencesRequestContentRatingsEnum as ContentRating,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { useSearchParams } from "next/navigation";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useState, type DragEvent, type FormEvent } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";

import { Button } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { EntityPicker } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { ManagementWorkspaceSectionHeader } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { Textarea } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import {
	ChineseContentDisplayValues,
	ContentLanguageValues,
	isChineseContentDisplay,
	isContentLanguage,
	isStoredUiLocale,
	StoredUiLocaleValues,
	toContentLanguage,
	toUiLocale,
	type ContentLanguage,
} from "@rezics/i18n";
import { UnitLicensesField } from "@/features/units/components/unit-licenses-field";
import { readSubmittedLicenses } from "@/features/units/model/unit-licenses";
import { OfficialRealmUnitIds } from "@rezics/slug";
import { SlugAddressForm } from "@/features/slugs/slug-address-form";
import {
	LocalizationImageUploadField,
	type LocalizationImageAssetOption,
	type LocalizationImageAssetValue,
} from "@/features/media/components/localization-image-upload-field";
import {
	AvatarField,
	type AvatarFieldOption,
	type AvatarFieldValue,
	avatarPresentationToInput,
} from "@/features/media/components/avatar-field";
import { LocalizationMediaFallbackNotice } from "@/features/media/components/localization-media-fallback-notice";
import { useSetLocale, useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { authClient } from "@/lib/auth-client";
import { buildLocalizationLanguages, selectLocalization } from "@/lib/localization";
import { SettingsOverviewHref } from "./routing/settings-routes";
import { ProfileAttributionProposalManager } from "@/features/governance/unit-workflows";
import { resetContentRatingDependentQueries } from "@/features/content-feed/data/content-rating-cache";
import { FeedQueryKey } from "@/features/content-feed/query";
import { setPresentationPreferencesQueryData } from "@/features/preferences/data/use-presentation-preferences";
import { ContentRatingPreferenceField } from "./components/content-rating-preference-field";
import { ContentLanguageControl } from "@/features/content-languages/components/content-language-control";
import { ContentLanguageEditorBoundary } from "@/features/content-languages/components/content-language-editor-boundary";
import { LocalizedDraftGate } from "@/features/content-languages/components/localized-draft-gate";
import {
	useContentLanguageEditor,
	useLocalizedDraft,
	type LocalizedDraftCodec,
} from "@/features/content-languages/hooks/use-content-language-editor";
import {
	decodeDraftAvatar,
	decodeDraftImageAsset,
	decodeDraftString,
	isDraftRecord,
} from "@/features/content-languages/model/localized-draft-codec";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { useHydratedSession } from "@/lib/use-hydrated-session";

function SettingsFrame({
	title,
	action,
	children,
}: {
	readonly title: string;
	readonly action?: React.ReactNode;
	readonly children: React.ReactNode;
}) {
	const { t } = useTranslation(["settings"]);
	return (
		<section className="max-w-2xl">
			<ManagementWorkspaceSectionHeader
				action={action}
				backHref={SettingsOverviewHref}
				backLabel={t.settings.workspace.backToOverview}
				link={Link}
				title={title}
			/>
			<div className="grid gap-8">{children}</div>
		</section>
	);
}

interface PickedRealm {
	readonly id: string;
	readonly label: string;
}

type ProfileLocalizationDraft = {
	readonly name: string;
	readonly summary: string;
	readonly avatar: AvatarFieldValue | null;
	readonly banner: LocalizationImageAssetValue | null;
};

const ProfileLocalizationDraftCodec: LocalizedDraftCodec<ProfileLocalizationDraft> = {
	version: 1,
	decode(value) {
		if (!isDraftRecord(value)) return;
		const name = decodeDraftString(value.name);
		const summary = decodeDraftString(value.summary);
		const avatar = decodeDraftAvatar(value.avatar);
		const banner = decodeDraftImageAsset(value.banner);
		return name === undefined ||
			summary === undefined ||
			avatar === undefined ||
			banner === undefined
			? undefined
			: { name, summary, avatar, banner };
	},
};

export function ProfileSettings() {
	const searchParams = useSearchParams();
	const requestedLanguage = searchParams.get("language");
	const fallbackLanguages = useLocalizationLanguages();
	const localizationLanguages =
		requestedLanguage && isContentLanguage(requestedLanguage)
			? [
					requestedLanguage,
					...fallbackLanguages.filter((language) => language !== requestedLanguage),
				]
			: fallbackLanguages;
	const profile = useGetApiUsersMe({ query: { localizationLanguages } });
	if (profile.isPending) return <QueryPending />;
	if (profile.isError || !profile.data)
		return <QueryFailure error={profile.error} retry={() => void profile.refetch()} />;
	return (
		<ContentLanguageEditorBoundary
			onLanguagesChanged={async () => {
				await profile.refetch();
			}}
			unitId={profile.data.id}
		>
			<ProfileSettingsForLanguage current={profile.data} />
		</ContentLanguageEditorBoundary>
	);
}

function ProfileSettingsForLanguage({ current }: { readonly current: GetApiUsersMeStatus200 }) {
	const { selectedLanguage } = useContentLanguageEditor();
	return <ProfileSettingsForm current={current} key={`${current.updatedAt}:${selectedLanguage}`} />;
}

function ProfileSettingsForm({ current }: { current: GetApiUsersMeStatus200 }) {
	const { t } = useTranslation([
		"errors",
		"feed",
		"governance",
		"locale",
		"media",
		"settings",
		"ui",
	]);
	const queryClient = useQueryClient();
	const { selectedLanguage, selectedLanguageIsPending, languagesChanged } =
		useContentLanguageEditor();
	const localization = current.localizations.find((entry) => entry.language === selectedLanguage);
	const avatarOptions: AvatarFieldOption[] = current.localizations.flatMap((entry) =>
		entry.language !== selectedLanguage && entry.avatar
			? [{ ...entry.avatar, label: t.locale.contentLanguages[entry.language] }]
			: [],
	);
	const bannerOptions: LocalizationImageAssetOption[] = current.localizations.flatMap((entry) =>
		entry.language !== selectedLanguage && entry.banner
			? [{ ...entry.banner, label: t.locale.contentLanguages[entry.language] }]
			: [],
	);
	const update = usePatchApiUsersMe({
		mutation: {
			onSuccess: (profile) =>
				Promise.all([
					queryClient.invalidateQueries({ queryKey: getApiUsersMeQueryKey() }),
					queryClient.invalidateQueries({
						queryKey: getApiUsersByIdQueryKey({ path: { id: profile.id } }),
					}),
				]),
		},
	});
	const assignSlug = useAssignCurrentProfileSlug({
		mutation: {
			retry: false,
			throwOnError: false,
			onSuccess: () =>
				Promise.all([
					queryClient.invalidateQueries({ queryKey: getApiUsersMeQueryKey() }),
					queryClient.invalidateQueries({
						queryKey: getApiUsersByIdQueryKey({ path: { id: current.id } }),
					}),
				]),
		},
	});
	const [saved, setSaved] = useState(false);
	const draft = useLocalizedDraft<ProfileLocalizationDraft>({
		scope: "profile-localization",
		baseVersion: localization?.updatedAt ?? null,
		codec: ProfileLocalizationDraftCodec,
		createInitialValue: () => ({
			name: selectedLanguageIsPending ? "" : (localization?.title ?? ""),
			summary: selectedLanguageIsPending ? "" : (localization?.summary ?? ""),
			avatar: selectedLanguageIsPending ? null : (localization?.avatar ?? null),
			banner: selectedLanguageIsPending ? null : (localization?.banner ?? null),
		}),
	});
	const { value } = draft;
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaved(false);
		const name = value.name.trim();
		if (!name) return;
		try {
			await update.mutateAsync({
				body: {
					updatedAt: current.updatedAt,
					language: selectedLanguage,
					name,
					summary: value.summary.trim(),
					avatar: avatarPresentationToInput(value.avatar),
					bannerAssetId: value.banner?.id ?? null,
				},
			});
			draft.commit();
			await languagesChanged();
			setSaved(true);
		} catch {
			setSaved(false);
		}
	}
	return (
		<SettingsFrame action={<ContentLanguageControl />} title={t.settings.profile}>
			<LocalizationMediaFallbackNotice />
			<LocalizedDraftGate
				hydrated={draft.hydrated}
				onDiscard={draft.discard}
				serverChanged={draft.serverChanged}
			>
				<form onSubmit={submit}>
					<FieldGroup>
						<Field>
							<FieldLabel>{t.media.roles.avatar.title}</FieldLabel>
							<AvatarField
								fallback={avatarOptions[0] ?? null}
								onChange={(avatar) => draft.setValue((current) => ({ ...current, avatar }))}
								options={avatarOptions}
								value={value.avatar}
							/>
						</Field>
						<Field>
							<FieldLabel>{t.media.roles.banner.title}</FieldLabel>
							<LocalizationImageUploadField
								fallback={bannerOptions[0] ?? null}
								onChange={(banner) => draft.setValue((current) => ({ ...current, banner }))}
								options={bannerOptions}
								role="banner"
								value={value.banner}
							/>
						</Field>
						<Field required>
							<FieldLabel>{t.ui.displayName}</FieldLabel>
							<Input
								maxLength={120}
								name="name"
								onChange={(event) => {
									const name = event.currentTarget.value;
									draft.setValue((current) => ({ ...current, name }));
								}}
								required
								value={value.name}
							/>
						</Field>
						<Field>
							<FieldLabel>{t.ui.introduction}</FieldLabel>
							<Textarea
								name="summary"
								onChange={(event) => {
									const summary = event.currentTarget.value;
									draft.setValue((current) => ({ ...current, summary }));
								}}
								value={value.summary}
							/>
						</Field>
						{saved && <p className="text-success-foreground text-sm">{t.ui.saved}</p>}
						<Button variant="solid" type="submit" isLoading={update.isPending}>
							{t.ui.save}
						</Button>
					</FieldGroup>
				</form>
			</LocalizedDraftGate>
			<Card>
				<CardContent className="p-5">
					<SlugAddressForm
						error={assignSlug.error}
						initialSlug={current.slugAddress?.slug}
						isPending={assignSlug.isPending}
						mode="assign-once"
						onSubmit={(slug) => assignSlug.mutateAsync({ body: { slug } })}
					/>
				</CardContent>
			</Card>
			<ProfileAttributionProposalManager profileId={current.id} />
		</SettingsFrame>
	);
}

export function PreferenceSettings() {
	const { locale, t } = useTranslation([
		"errors",
		"feed",
		"governance",
		"licenses",
		"locale",
		"media",
		"settings",
		"ui",
	]);
	const queryClient = useQueryClient();
	const { data: session } = useHydratedSession();
	const preferences = useGetApiUsersMePreferences();
	const localizationLanguages = buildLocalizationLanguages(
		preferences.data?.preferredLanguages ?? [],
		toContentLanguage(locale.target),
	);
	const storedDefaultScoreRealmId =
		preferences.data?.defaultScoreRealmId ?? OfficialRealmUnitIds.score;
	const storedDefaultScoreRealm = useGetApiRealmsByRealmId(
		{
			path: { realmId: storedDefaultScoreRealmId },
			query: { localizationLanguages },
		},
		{ query: { enabled: Boolean(preferences.data) } },
	);
	const update = usePutApiUsersMePreferences({
		mutation: {
			onSuccess: async (data) => {
				const previousRatings = preferences.data?.contentRatings;
				const contentRatingsChanged =
					!previousRatings ||
					previousRatings.length !== data.contentRatings.length ||
					previousRatings.some((rating, index) => rating !== data.contentRatings[index]);
				queryClient.setQueryData(getApiUsersMePreferencesQueryKey(), data);
				if (session) setPresentationPreferencesQueryData(queryClient, session.user.id, data);
				if (contentRatingsChanged) await resetContentRatingDependentQueries(queryClient);
				else await queryClient.invalidateQueries({ queryKey: FeedQueryKey });
			},
		},
	});
	const { setLocale } = useSetLocale();
	const [saved, setSaved] = useState(false);
	const [invalid, setInvalid] = useState(false);
	const [selectedDefaultScoreRealm, setSelectedDefaultScoreRealm] = useState<PickedRealm>();
	const [editedPreferredLanguages, setEditedPreferredLanguages] = useState<ContentLanguage[]>();
	const [editedContentRatings, setEditedContentRatings] = useState<ContentRating[]>();
	const [pendingLanguage, setPendingLanguage] = useState<ContentLanguage>();
	const [draggedLanguage, setDraggedLanguage] = useState<ContentLanguage>();
	if (preferences.isPending) return <QueryPending />;
	if (preferences.isError || !preferences.data)
		return <QueryFailure error={preferences.error} retry={() => void preferences.refetch()} />;
	if (storedDefaultScoreRealm.isPending) return <QueryPending />;
	if (storedDefaultScoreRealm.isError || !storedDefaultScoreRealm.data)
		return (
			<QueryFailure
				error={storedDefaultScoreRealm.error}
				retry={() => void storedDefaultScoreRealm.refetch()}
			/>
		);
	const storedDefaultScoreRealmLocalization = selectLocalization(
		storedDefaultScoreRealm.data.localizations,
		storedDefaultScoreRealm.data.language,
		storedDefaultScoreRealm.data.language,
	);
	const defaultScoreRealm = selectedDefaultScoreRealm ?? {
		id: storedDefaultScoreRealm.data.id,
		label: storedDefaultScoreRealmLocalization?.title ?? storedDefaultScoreRealm.data.id,
	};
	const preferredLanguages = editedPreferredLanguages ?? preferences.data.preferredLanguages;
	const contentRatings = editedContentRatings ?? preferences.data.contentRatings;
	const availableLanguages = ContentLanguageValues.filter(
		(language) => !preferredLanguages.includes(language),
	);
	const languageToAdd =
		pendingLanguage && availableLanguages.includes(pendingLanguage)
			? pendingLanguage
			: availableLanguages[0];
	const languageLabel = (language: ContentLanguage) => t.locale.contentLanguages[language];
	const moveLanguage = (language: ContentLanguage, offset: -1 | 1) => {
		setEditedPreferredLanguages((edited) => {
			const current = edited ?? preferences.data.preferredLanguages;
			const from = current.indexOf(language);
			const to = from + offset;
			if (from < 0 || to < 0 || to >= current.length) return [...current];
			const next = [...current];
			const [moved] = next.splice(from, 1);
			if (!moved) return next;
			next.splice(to, 0, moved);
			return next;
		});
	};
	const dropLanguage = (event: DragEvent<HTMLLIElement>, targetLanguage: ContentLanguage) => {
		event.preventDefault();
		if (!draggedLanguage || draggedLanguage === targetLanguage) return;
		setEditedPreferredLanguages((edited) => {
			const current = edited ?? preferences.data.preferredLanguages;
			const from = current.indexOf(draggedLanguage);
			const to = current.indexOf(targetLanguage);
			if (from < 0 || to < 0) return [...current];
			const next = [...current];
			const [moved] = next.splice(from, 1);
			if (!moved) return next;
			next.splice(to, 0, moved);
			return next;
		});
		setDraggedLanguage(undefined);
	};
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaved(false);
		setInvalid(false);
		const current = preferences.data;
		if (!current) return;
		const data = new FormData(event.currentTarget);
		const interfaceLocale = String(data.get("interfaceLocale"));
		const chineseContentDisplay = String(data.get("chineseContentDisplay"));
		const submittedDefaultLicenses = readSubmittedLicenses(data, "defaultLicenses");
		if (
			!contentRatings.length ||
			!isChineseContentDisplay(chineseContentDisplay) ||
			!isStoredUiLocale(interfaceLocale) ||
			!preferredLanguages.length
		) {
			setInvalid(true);
			return;
		}
		try {
			await update.mutateAsync({
				body: {
					interfaceLocale,
					chineseContentDisplay,
					defaultLicenses: submittedDefaultLicenses,
					defaultRealmManageMode: data.get("defaultRealmManageMode") === "true",
					defaultScoreRealmId: defaultScoreRealm.id,
					collectionConfig: current.collectionConfig,
					personalizedFeed: data.get("personalizedFeed") === "true",
					filterFeedByPreferredLanguages: data.get("filterFeedByPreferredLanguages") === "true",
					contentRatings,
					preferredLanguages,
				},
			});
			setLocale(toUiLocale(interfaceLocale));
			setSaved(true);
		} catch {
			setSaved(false);
		}
	}
	return (
		<SettingsFrame title={t.settings.preferences}>
			<form onSubmit={submit}>
				<FieldGroup>
					<Field>
						<FieldLabel>{t.settings.interfaceLanguage}</FieldLabel>
						<NativeSelect name="interfaceLocale" defaultValue={preferences.data.interfaceLocale}>
							{StoredUiLocaleValues.map((value) => (
								<NativeSelectOption key={value} value={value}>
									{t.locale.uiLocales[value]}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel>{t.locale.chineseContentDisplay.label}</FieldLabel>
						<p className="text-sm text-muted-foreground">{t.locale.chineseContentDisplay.hint}</p>
						<NativeSelect
							name="chineseContentDisplay"
							defaultValue={preferences.data.chineseContentDisplay}
						>
							{ChineseContentDisplayValues.map((value) => (
								<NativeSelectOption key={value} value={value}>
									{t.locale.chineseContentDisplay[value]}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel>{t.settings.contentLanguages}</FieldLabel>
						<p className="text-sm text-muted-foreground">{t.settings.contentLanguagesHint}</p>
						<ol className="grid gap-2">
							{preferredLanguages.map((language, index) => (
								<li
									aria-label={t.settings.dragContentLanguage({
										language: languageLabel(language),
									})}
									className="flex items-center gap-2 rounded-md border border-border-weak bg-surface px-2 py-2"
									draggable
									key={language}
									onDragEnd={() => setDraggedLanguage(undefined)}
									onDragOver={(event) => {
										event.preventDefault();
										event.dataTransfer.dropEffect = "move";
									}}
									onDragStart={(event) => {
										event.dataTransfer.effectAllowed = "move";
										event.dataTransfer.setData("text/plain", language);
										setDraggedLanguage(language);
									}}
									onDrop={(event) => dropLanguage(event, language)}
								>
									<GripVertical
										aria-hidden
										className="size-4 shrink-0 cursor-grab text-muted-foreground"
									/>
									<span className="min-w-0 flex-1 text-sm font-medium">
										{languageLabel(language)}
									</span>
									<Button
										aria-label={t.settings.moveContentLanguageUp({
											language: languageLabel(language),
										})}
										disabled={index === 0}
										onClick={() => moveLanguage(language, -1)}
										size="icon-sm"
										type="button"
										variant="quiet"
									>
										<ArrowUp aria-hidden />
									</Button>
									<Button
										aria-label={t.settings.moveContentLanguageDown({
											language: languageLabel(language),
										})}
										disabled={index === preferredLanguages.length - 1}
										onClick={() => moveLanguage(language, 1)}
										size="icon-sm"
										type="button"
										variant="quiet"
									>
										<ArrowDown aria-hidden />
									</Button>
									<Button
										aria-label={t.settings.removeContentLanguage({
											language: languageLabel(language),
										})}
										disabled={preferredLanguages.length === 1}
										onClick={() =>
											setEditedPreferredLanguages(
												preferredLanguages.filter((candidate) => candidate !== language),
											)
										}
										size="icon-sm"
										type="button"
										variant="quiet"
									>
										<Trash2 aria-hidden />
									</Button>
								</li>
							))}
						</ol>
						{languageToAdd ? (
							<div className="flex gap-2">
								<NativeSelect
									aria-label={t.settings.addContentLanguage}
									onChange={(event) => {
										if (isContentLanguage(event.currentTarget.value))
											setPendingLanguage(event.currentTarget.value);
									}}
									value={languageToAdd}
								>
									{availableLanguages.map((language) => (
										<NativeSelectOption key={language} value={language}>
											{languageLabel(language)}
										</NativeSelectOption>
									))}
								</NativeSelect>
								<Button
									onClick={() => {
										setEditedPreferredLanguages([...preferredLanguages, languageToAdd]);
										setPendingLanguage(undefined);
									}}
									type="button"
									variant="outline"
								>
									<Plus aria-hidden />
									{t.settings.addContentLanguage}
								</Button>
							</div>
						) : null}
					</Field>
					<UnitLicensesField
						defaultValue={preferences.data.defaultLicenses}
						label={t.settings.defaultLicenses}
						name="defaultLicenses"
					/>
					<Field>
						<FieldLabel>{t.settings.defaultScoreRealm}</FieldLabel>
						<EntityPicker
							ariaLabel={t.settings.defaultScoreRealm}
							index="realms"
							onChange={setSelectedDefaultScoreRealm}
							placeholder={t.ui.pickerPlaceholders.realm}
							value={defaultScoreRealm}
						/>
						<p className="text-sm text-muted-foreground">{t.settings.defaultScoreRealmHint}</p>
					</Field>
					<ContentRatingPreferenceField
						generalLabel={t.settings.general}
						invalid={invalid}
						invalidMessage={t.errors.invalid}
						legend={t.ui.contentRating}
						onChange={setEditedContentRatings}
						value={contentRatings}
					/>
					<Field>
						<FieldLabel>{t.feed.personalized}</FieldLabel>
						<NativeSelect
							name="personalizedFeed"
							defaultValue={String(preferences.data.personalizedFeed)}
						>
							<NativeSelectOption value="false">{t.settings.off}</NativeSelectOption>
							<NativeSelectOption value="true">{t.settings.on}</NativeSelectOption>
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel>{t.settings.filterFeedByPreferredLanguages}</FieldLabel>
						<NativeSelect
							name="filterFeedByPreferredLanguages"
							defaultValue={String(preferences.data.filterFeedByPreferredLanguages)}
						>
							<NativeSelectOption value="false">{t.settings.off}</NativeSelectOption>
							<NativeSelectOption value="true">{t.settings.on}</NativeSelectOption>
						</NativeSelect>
						<p className="text-sm text-muted-foreground">
							{t.settings.filterFeedByPreferredLanguagesHint}
						</p>
					</Field>
					<Field>
						<FieldLabel>{t.settings.realmManageMode}</FieldLabel>
						<NativeSelect
							name="defaultRealmManageMode"
							defaultValue={String(preferences.data.defaultRealmManageMode ?? false)}
						>
							<NativeSelectOption value="false">{t.settings.off}</NativeSelectOption>
							<NativeSelectOption value="true">{t.settings.on}</NativeSelectOption>
						</NativeSelect>
					</Field>
					<RequestFailure error={update.error} fallback={t.ui.retryLater} />
					{saved && <p className="text-success-foreground text-sm">{t.ui.saved}</p>}
					<Button variant="solid" type="submit" isLoading={update.isPending}>
						{t.ui.save}
					</Button>
				</FieldGroup>
			</form>
		</SettingsFrame>
	);
}

export function AccountSettings() {
	const { t } = useTranslation([
		"errors",
		"feed",
		"governance",
		"locale",
		"media",
		"settings",
		"ui",
	]);
	const router = useApplicationRouter();
	const queryClient = useQueryClient();
	return (
		<SettingsFrame title={t.settings.account}>
			<Card>
				<CardContent className="flex flex-col items-start gap-4">
					<p className="text-sm text-muted-foreground">{t.settings.accountDescription}</p>
					<Button
						variant="outline"
						onClick={async () => {
							await authClient.signOut();
							queryClient.clear();
							router.push("/");
							router.refresh();
						}}
					>
						{t.ui.logout}
					</Button>
				</CardContent>
			</Card>
		</SettingsFrame>
	);
}
