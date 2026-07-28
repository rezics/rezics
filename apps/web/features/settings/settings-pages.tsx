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
	useReplaceOwnProfileSlugAddress,
	type GetApiUsersMeStatus200,
	type PutApiUsersMePreferencesRequestContentRatingsEnum as ContentRating,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
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
	ContentLanguageValues,
	isContentLanguage,
	isStoredUiLocale,
	toContentLanguage,
	toUiLocale,
	type ContentLanguage,
} from "@rezics/i18n";
import { isPublicationLicenseId, PublicationLicenseIds } from "@rezics/license";
import { OfficialRealmUnitIds } from "@rezics/slug";
import { SlugAddressForm } from "@/features/slugs/slug-address-form";
import {
	LocalizationImageUploadField,
	type LocalizationImageAssetValue,
} from "@/features/media/components/localization-image-upload-field";
import {
	AvatarField,
	type AvatarFieldValue,
	avatarPresentationToInput,
} from "@/features/media/components/avatar-field";
import { useSetLocale, useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { authClient } from "@/lib/auth-client";
import { buildLocalizationLanguages, selectLocalization } from "@/lib/localization";
import { SettingsOverviewHref } from "./routing/settings-routes";
import { ProfileAttributionProposalManager } from "@/features/governance/unit-workflows";
import { FeedQueryKey } from "@/features/content-feed/query";
import { ContentRatingPreferenceField } from "./components/content-rating-preference-field";
import { ContentLanguageControl } from "@/features/content-languages/components/content-language-control";
import { ContentLanguageEditorBoundary } from "@/features/content-languages/components/content-language-editor-boundary";
import { useContentLanguageEditor } from "@/features/content-languages/hooks/use-content-language-editor";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";

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

export function ProfileSettings() {
	const searchParams = useSearchParams();
	const requestedLanguage = searchParams.get("language");
	const fallbackLanguages = useLocalizationLanguages();
	const localizationLanguages =
		requestedLanguage && isContentLanguage(requestedLanguage)
			? [requestedLanguage]
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
	return (
		<ProfileSettingsForm current={current} key={`${current.updatedAt}:${selectedLanguage}`} />
	);
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
	const { selectedLanguage, selectedLanguageIsPending, setDirty, languagesChanged } =
		useContentLanguageEditor();
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
	const replaceSlug = useReplaceOwnProfileSlugAddress({
		mutation: {
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
	const [avatar, setAvatar] = useState<AvatarFieldValue | null>(
		selectedLanguageIsPending ? null : current.avatar,
	);
	const [banner, setBanner] = useState<LocalizationImageAssetValue | null>(
		selectedLanguageIsPending ? null : current.banner,
	);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaved(false);
		const data = new FormData(event.currentTarget);
		const name = String(data.get("name") ?? "").trim();
		if (!name) return;
		try {
			await update.mutateAsync({
				body: {
					updatedAt: current.updatedAt,
					language: selectedLanguage,
					name,
					summary: String(data.get("summary") ?? "").trim(),
					avatar: avatarPresentationToInput(avatar),
					bannerAssetId: banner?.id ?? null,
				},
			});
			setDirty(false);
			await languagesChanged();
			setSaved(true);
		} catch {
			setSaved(false);
		}
	}
	return (
		<SettingsFrame action={<ContentLanguageControl />} title={t.settings.profile}>
			<form onChange={() => setDirty(true)} onSubmit={submit}>
				<FieldGroup>
					<Field>
						<FieldLabel>{t.media.roles.avatar.title}</FieldLabel>
						<AvatarField
							onChange={(value) => {
								setAvatar(value);
								setDirty(true);
							}}
							value={avatar}
						/>
					</Field>
					<Field>
						<FieldLabel>{t.media.roles.banner.title}</FieldLabel>
						<LocalizationImageUploadField
							onChange={(value) => {
								setBanner(value);
								setDirty(true);
							}}
							role="banner"
							value={banner}
						/>
					</Field>
					<Field required>
						<FieldLabel>{t.ui.displayName}</FieldLabel>
						<Input
							defaultValue={selectedLanguageIsPending ? "" : (current.name ?? "")}
							maxLength={120}
							name="name"
							required
						/>
					</Field>
					<Field>
						<FieldLabel>{t.ui.introduction}</FieldLabel>
						<Textarea
							name="summary"
							defaultValue={selectedLanguageIsPending ? "" : (current.summary ?? "")}
						/>
					</Field>
					{saved && <p className="text-success-foreground text-sm">{t.ui.saved}</p>}
					<Button variant="solid" type="submit" isLoading={update.isPending}>
						{t.ui.save}
					</Button>
				</FieldGroup>
			</form>
			<Card>
				<CardContent className="p-5">
					<SlugAddressForm
						error={replaceSlug.error}
						initialSlug={current.slugAddress?.slug}
						isPending={replaceSlug.isPending}
						onSubmit={(slug) => replaceSlug.mutateAsync({ body: { slug } })}
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
	const preferences = useGetApiUsersMePreferences();
	const localizationLanguages = buildLocalizationLanguages(
		preferences.data?.preferredLanguages ?? [],
		toContentLanguage(locale.target),
	);
	const storedDefaultScoreContextUnitId =
		preferences.data?.defaultScoreContextUnitId ?? OfficialRealmUnitIds.score;
	const storedDefaultScoreContext = useGetApiRealmsByRealmId(
		{
			path: { realmId: storedDefaultScoreContextUnitId },
			query: { localizationLanguages },
		},
		{ query: { enabled: Boolean(preferences.data) } },
	);
	const update = usePutApiUsersMePreferences({
		mutation: {
			onSuccess: () =>
				Promise.all([
					queryClient.invalidateQueries({
						queryKey: getApiUsersMePreferencesQueryKey(),
					}),
					queryClient.invalidateQueries({ queryKey: FeedQueryKey }),
				]),
		},
	});
	const { setLocale } = useSetLocale();
	const [saved, setSaved] = useState(false);
	const [invalid, setInvalid] = useState(false);
	const [selectedDefaultScoreContext, setSelectedDefaultScoreContext] = useState<PickedRealm>();
	const [editedPreferredLanguages, setEditedPreferredLanguages] = useState<ContentLanguage[]>();
	const [editedContentRatings, setEditedContentRatings] = useState<ContentRating[]>();
	const [pendingLanguage, setPendingLanguage] = useState<ContentLanguage>();
	const [draggedLanguage, setDraggedLanguage] = useState<ContentLanguage>();
	if (preferences.isPending) return <QueryPending />;
	if (preferences.isError || !preferences.data)
		return <QueryFailure error={preferences.error} retry={() => void preferences.refetch()} />;
	if (storedDefaultScoreContext.isPending) return <QueryPending />;
	if (storedDefaultScoreContext.isError || !storedDefaultScoreContext.data)
		return (
			<QueryFailure
				error={storedDefaultScoreContext.error}
				retry={() => void storedDefaultScoreContext.refetch()}
			/>
		);
	const storedDefaultScoreContextLocalization = selectLocalization(
		storedDefaultScoreContext.data.localizations,
		storedDefaultScoreContext.data.language,
		storedDefaultScoreContext.data.language,
	);
	const defaultScoreContext = selectedDefaultScoreContext ?? {
		id: storedDefaultScoreContext.data.id,
		label: storedDefaultScoreContextLocalization?.title ?? storedDefaultScoreContext.data.id,
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
	const languageLabel = (language: ContentLanguage) =>
		language === "zh" ? t.locale.zh : t.locale.en;
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
		const submittedDefaultLicense = data.get("defaultLicense");
		if (
			!contentRatings.length ||
			!isStoredUiLocale(interfaceLocale) ||
			!preferredLanguages.length ||
			(submittedDefaultLicense !== null &&
				submittedDefaultLicense !== "" &&
				!isPublicationLicenseId(submittedDefaultLicense))
		) {
			setInvalid(true);
			return;
		}
		try {
			await update.mutateAsync({
				body: {
					interfaceLocale,
					defaultLicense: isPublicationLicenseId(submittedDefaultLicense)
						? submittedDefaultLicense
						: null,
					defaultRealmManageMode: data.get("defaultRealmManageMode") === "true",
					defaultScoreContextUnitId: defaultScoreContext.id,
					collectionConfig: current.collectionConfig,
					personalizedFeed: data.get("personalizedFeed") === "true",
					filterFeedByPreferredLanguages:
						data.get("filterFeedByPreferredLanguages") === "true",
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
						<NativeSelect
							name="interfaceLocale"
							defaultValue={preferences.data.interfaceLocale}
						>
							<NativeSelectOption value="zh-hant">{t.locale.zh}</NativeSelectOption>
							<NativeSelectOption value="en">{t.locale.en}</NativeSelectOption>
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel>{t.settings.contentLanguages}</FieldLabel>
						<p className="text-sm text-muted-foreground">
							{t.settings.contentLanguagesHint}
						</p>
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
												preferredLanguages.filter(
													(candidate) => candidate !== language,
												),
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
										setEditedPreferredLanguages([
											...preferredLanguages,
											languageToAdd,
										]);
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
					<Field>
						<FieldLabel>{t.settings.defaultLicense}</FieldLabel>
						<NativeSelect
							name="defaultLicense"
							defaultValue={preferences.data.defaultLicense ?? ""}
						>
							<NativeSelectOption value="">
								{t.licenses.unspecified}
							</NativeSelectOption>
							{PublicationLicenseIds.map((id) => (
								<NativeSelectOption key={id} value={id}>
									{t.licenses.options[id].label}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel>{t.settings.defaultScoreContext}</FieldLabel>
						<EntityPicker
							index="realms"
							onChange={setSelectedDefaultScoreContext}
							value={defaultScoreContext}
						/>
						<p className="text-sm text-muted-foreground">
							{t.settings.defaultScoreContextHint}
						</p>
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
	const router = useRouter();
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
