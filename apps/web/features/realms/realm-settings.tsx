"use client";

import {
	ContentLanguageValues,
	isContentLanguage,
	toContentLanguage,
	type ContentLanguage,
} from "@rezics/i18n";
import { publicSlugHref } from "@rezics/slug";

import {
	getApiRealmsByRealmIdRulesAuthoringQueryKey,
	getApiRealmsByRealmIdRulesQueryKey,
	usePatchApiRealmsByRealmId,
	usePutApiRealmsByRealmIdRules,
	useReplaceRealmSlugAddress,
	type GetApiRealmsByRealmIdRulesAuthoringStatus200,
	type GetApiRealmsByRealmIdStatus200,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { useQueryClient } from "@tanstack/react-query";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import { Checkbox } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { Skeleton } from "@rezics/ui";
import { Textarea } from "@rezics/ui";
import { LocalizedDraftGate } from "@/features/content-languages/components/localized-draft-gate";
import {
	LocalizationImageUploadField,
	type LocalizationImageAssetOption,
	type LocalizationImageAssetValue,
} from "@/features/media/components/localization-image-upload-field";
import { ContentLanguageControl } from "@/features/content-languages/components/content-language-control";
import {
	AvatarField,
	type AvatarFieldOption,
	type AvatarFieldValue,
	avatarPresentationToInput,
} from "@/features/media/components/avatar-field";
import { LocalizationMediaFallbackNotice } from "@/features/media/components/localization-media-fallback-notice";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import {
	useContentLanguageEditor,
	useLocalizedDraft,
	type LocalizedDraftCodec,
} from "@/features/content-languages/hooks/use-content-language-editor";
import {
	decodeDraftAvatar,
	decodeDraftBoolean,
	decodeDraftImageAsset,
	decodeDraftPortableText,
	decodeDraftString,
	isDraftRecord,
} from "@/features/content-languages/model/localized-draft-codec";
import { useTranslation } from "@/i18n/client";
import { hasErrorCode } from "@/i18n/errors";
import { SlugAddressForm } from "@/features/slugs/slug-address-form";
import { DevelopmentPreviewBoundary } from "@/features/preview-access/components/development-preview-boundary";
import { RequestFailure } from "@/i18n/request-failure";
import { readPortableText, writePortableText } from "@/lib/block";
import { invalidateRealmDetails } from "./query";

type RuleDraft = {
	draftId: string;
	localizationOrder: ContentLanguage[];
	localizations: Partial<Record<ContentLanguage, RuleLocalizationDraft>>;
};
type RuleLocalizationDraft = {
	title: string;
	content: PortableTextValue;
};
type RuleAcknowledgementMode = "explicit" | "implicit_on_follow";
type RealmRulesDraft = {
	acknowledgementMode: RuleAcknowledgementMode;
	requireOnJoin: boolean;
	requireOnPost: boolean;
	rules: RuleDraft[];
};
type RealmProfileLocalizationDraft = {
	title: string;
	summary: string;
	avatar: AvatarFieldValue | null;
	banner: LocalizationImageAssetValue | null;
};
type RealmProfileSharedDraft = {
	status: "draft" | "published" | "archived";
	visibility: "public" | "unlisted" | "private";
	joinPolicy: "open" | "approval";
};

function decodeRealmProfileStatus(value: string): RealmProfileSharedDraft["status"] {
	if (value === "draft" || value === "published" || value === "archived") return value;
	throw new Error(`Unexpected Realm status: ${value}`);
}

function decodeRealmProfileVisibility(value: string): RealmProfileSharedDraft["visibility"] {
	if (value === "public" || value === "unlisted" || value === "private") return value;
	throw new Error(`Unexpected Realm visibility: ${value}`);
}

function decodeRealmJoinPolicy(value: string): RealmProfileSharedDraft["joinPolicy"] {
	if (value === "open" || value === "approval") return value;
	throw new Error(`Unexpected Realm join policy: ${value}`);
}

function createRuleDraftId(): string {
	return crypto.randomUUID();
}

function decodeRuleDraft(value: unknown): RuleDraft | undefined {
	if (
		!isDraftRecord(value) ||
		typeof value.draftId !== "string" ||
		!Array.isArray(value.localizationOrder) ||
		!isDraftRecord(value.localizations)
	)
		return;
	const localizationOrder: ContentLanguage[] = [];
	const localizations: Partial<Record<ContentLanguage, RuleLocalizationDraft>> = {};
	for (const language of value.localizationOrder) {
		if (
			typeof language !== "string" ||
			!isContentLanguage(language) ||
			localizationOrder.includes(language)
		)
			return;
		const candidate = value.localizations[language];
		if (!isDraftRecord(candidate)) return;
		const title = decodeDraftString(candidate.title);
		const content = decodeDraftPortableText(candidate.content);
		if (title === undefined || !content) return;
		localizationOrder.push(language);
		localizations[language] = { title, content };
	}
	return localizationOrder.length && localizationOrder.length <= ContentLanguageValues.length
		? { draftId: value.draftId, localizationOrder, localizations }
		: undefined;
}

const RealmRulesDraftCodec: LocalizedDraftCodec<RealmRulesDraft> = {
	version: 1,
	decode(value) {
		if (!isDraftRecord(value) || !Array.isArray(value.rules)) return;
		const acknowledgementMode = value.acknowledgementMode;
		const requireOnJoin = decodeDraftBoolean(value.requireOnJoin);
		const requireOnPost = decodeDraftBoolean(value.requireOnPost);
		if (
			(acknowledgementMode !== "explicit" && acknowledgementMode !== "implicit_on_follow") ||
			requireOnJoin === undefined ||
			requireOnPost === undefined ||
			value.rules.length < 1 ||
			value.rules.length > 100
		)
			return;
		const rules = value.rules.map(decodeRuleDraft);
		if (rules.some((rule) => !rule)) return;
		const decodedRules = rules.filter((rule): rule is RuleDraft => Boolean(rule));
		if (new Set(decodedRules.map(({ draftId }) => draftId)).size !== decodedRules.length) return;
		return {
			acknowledgementMode,
			requireOnJoin,
			requireOnPost,
			rules: decodedRules,
		};
	},
};

const RealmProfileLocalizationDraftCodec: LocalizedDraftCodec<RealmProfileLocalizationDraft> = {
	version: 1,
	decode(value) {
		if (!isDraftRecord(value)) return;
		const title = decodeDraftString(value.title);
		const summary = decodeDraftString(value.summary);
		const avatar = decodeDraftAvatar(value.avatar);
		const banner = decodeDraftImageAsset(value.banner);
		if (
			title === undefined ||
			summary === undefined ||
			avatar === undefined ||
			banner === undefined
		)
			return;
		return { title, summary, avatar, banner };
	},
};

const RealmProfileSharedDraftCodec: LocalizedDraftCodec<RealmProfileSharedDraft> = {
	version: 1,
	decode(value) {
		if (!isDraftRecord(value)) return;
		const { status, visibility, joinPolicy } = value;
		if (
			(status !== "draft" && status !== "published" && status !== "archived") ||
			(visibility !== "public" && visibility !== "unlisted" && visibility !== "private") ||
			(joinPolicy !== "open" && joinPolicy !== "approval")
		)
			return;
		return { status, visibility, joinPolicy };
	},
};

export function RealmProfileSettings({
	realm,
	embedded = false,
}: {
	realm: GetApiRealmsByRealmIdStatus200;
	embedded?: boolean;
}) {
	const { t } = useTranslation(["errors", "locale", "media", "realms", "state", "ui"]);
	const { selectedLanguage, selectedLanguageIsPending, languagesChanged } =
		useContentLanguageEditor();
	const router = useApplicationRouter();
	const queryClient = useQueryClient();
	const update = usePatchApiRealmsByRealmId();
	const replaceSlug = useReplaceRealmSlugAddress({
		mutation: {
			onSuccess: async (address) => {
				await invalidateRealmDetails(queryClient, realm.id);
				const { scopeUnitId } = address;
				if (!scopeUnitId) return;
				const slugHref = publicSlugHref("realm", { ...address, scopeUnitId });
				if (slugHref) router.replace(`${slugHref}/settings`);
			},
		},
	});
	const localization = realm.localizations.find((entry) => entry.language === selectedLanguage);
	const avatarOptions: AvatarFieldOption[] = realm.localizations.flatMap((entry) =>
		entry.language !== selectedLanguage && entry.avatar
			? [{ ...entry.avatar, label: t.locale.contentLanguages[entry.language] }]
			: [],
	);
	const bannerOptions: LocalizationImageAssetOption[] = realm.localizations.flatMap((entry) =>
		entry.language !== selectedLanguage && entry.banner
			? [{ ...entry.banner, label: t.locale.contentLanguages[entry.language] }]
			: [],
	);
	const localizationDraft = useLocalizedDraft<RealmProfileLocalizationDraft>({
		scope: "realm-profile-localization",
		baseVersion: realm.updatedAt,
		codec: RealmProfileLocalizationDraftCodec,
		createInitialValue: () => ({
			title: selectedLanguageIsPending ? "" : (localization?.title ?? ""),
			summary: selectedLanguageIsPending ? "" : (localization?.summary ?? ""),
			avatar: selectedLanguageIsPending ? null : (localization?.avatar ?? null),
			banner: selectedLanguageIsPending ? null : (localization?.banner ?? null),
		}),
	});
	const sharedDraft = useLocalizedDraft<RealmProfileSharedDraft>({
		scope: "realm-profile-shared",
		partition: "shared",
		baseVersion: realm.updatedAt,
		codec: RealmProfileSharedDraftCodec,
		createInitialValue: () => ({
			status: decodeRealmProfileStatus(realm.status),
			visibility: decodeRealmProfileVisibility(realm.visibility),
			joinPolicy: decodeRealmJoinPolicy(realm.joinPolicy),
		}),
	});
	const localizationValue = localizationDraft.value;
	const sharedValue = sharedDraft.value;

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const title = localizationValue.title.trim();
		const summary = localizationValue.summary.trim();
		if (!title) return;
		update.mutate(
			{
				path: { realmId: realm.id },
				body: {
					status: sharedValue.status,
					visibility: sharedValue.visibility,
					joinPolicy: sharedValue.joinPolicy,
					localization: {
						language: selectedLanguage,
						title,
						...(summary ? { summary } : {}),
						avatar: avatarPresentationToInput(localizationValue.avatar),
						bannerAssetId: localizationValue.banner?.id ?? null,
					},
				},
			},
			{
				onSuccess: async () => {
					localizationDraft.commit();
					sharedDraft.commit();
					await invalidateRealmDetails(queryClient, realm.id);
					await languagesChanged();
				},
			},
		);
	}

	return (
		<section className="grid gap-3">
			{embedded ? null : <h2 className="font-heading text-xl font-bold">{t.realms.profile}</h2>}
			<Card>
				<CardContent className="grid gap-6 p-5">
					<ContentLanguageControl />
					<LocalizationMediaFallbackNotice />
					<LocalizedDraftGate
						hydrated={localizationDraft.hydrated && sharedDraft.hydrated}
						onDiscard={() => {
							localizationDraft.discard();
							sharedDraft.discard();
						}}
						serverChanged={localizationDraft.serverChanged || sharedDraft.serverChanged}
					>
						<form className="grid gap-6" onSubmit={submit}>
							<FieldGroup>
								<Field required>
									<FieldLabel>{t.ui.title}</FieldLabel>
									<Input
										name="title"
										required
										maxLength={500}
										onChange={(event) => {
											const title = event.currentTarget.value;
											localizationDraft.setValue((current) => ({
												...current,
												title,
											}));
										}}
										value={localizationValue.title}
									/>
								</Field>
								<Field>
									<FieldLabel>{t.ui.summary}</FieldLabel>
									<Textarea
										name="summary"
										maxLength={2000}
										onChange={(event) => {
											const summary = event.currentTarget.value;
											localizationDraft.setValue((current) => ({
												...current,
												summary,
											}));
										}}
										value={localizationValue.summary}
									/>
								</Field>
								<Field>
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
										value={localizationValue.avatar}
									/>
								</Field>
								<Field>
									<FieldLabel>{t.media.roles.banner.title}</FieldLabel>
									<LocalizationImageUploadField
										fallback={bannerOptions[0] ?? null}
										onChange={(banner) =>
											localizationDraft.setValue((current) => ({
												...current,
												banner,
											}))
										}
										options={bannerOptions}
										role="banner"
										value={localizationValue.banner}
									/>
								</Field>
								<div className="grid gap-4 sm:grid-cols-3">
									<Field>
										<FieldLabel>{t.ui.status}</FieldLabel>
										<NativeSelect
											name="status"
											value={sharedValue.status}
											onChange={(event) => {
												const status = event.currentTarget.value;
												if (status === "draft" || status === "published" || status === "archived")
													sharedDraft.setValue((current) => ({
														...current,
														status,
													}));
											}}
										>
											<NativeSelectOption value="draft">{t.ui.draft}</NativeSelectOption>
											<NativeSelectOption value="published">{t.ui.published}</NativeSelectOption>
											<NativeSelectOption value="archived">{t.ui.archived}</NativeSelectOption>
										</NativeSelect>
									</Field>
									<Field>
										<FieldLabel>{t.ui.visibility}</FieldLabel>
										<NativeSelect
											name="visibility"
											value={sharedValue.visibility}
											onChange={(event) => {
												const visibility = event.currentTarget.value;
												if (
													visibility === "public" ||
													visibility === "unlisted" ||
													visibility === "private"
												)
													sharedDraft.setValue((current) => ({
														...current,
														visibility,
													}));
											}}
										>
											<NativeSelectOption value="public">{t.ui.public}</NativeSelectOption>
											<NativeSelectOption value="unlisted">{t.ui.unlisted}</NativeSelectOption>
											<NativeSelectOption value="private">{t.ui.private}</NativeSelectOption>
										</NativeSelect>
									</Field>
									<Field>
										<FieldLabel>{t.realms.joinPolicy}</FieldLabel>
										<NativeSelect
											name="joinPolicy"
											value={sharedValue.joinPolicy}
											onChange={(event) => {
												const joinPolicy = event.currentTarget.value;
												if (joinPolicy === "open" || joinPolicy === "approval")
													sharedDraft.setValue((current) => ({
														...current,
														joinPolicy,
													}));
											}}
										>
											<NativeSelectOption value="open">{t.realms.open}</NativeSelectOption>
											<NativeSelectOption value="approval">{t.realms.approval}</NativeSelectOption>
										</NativeSelect>
									</Field>
								</div>
								<RequestFailure error={update.error} />
								<Button
									variant="solid"
									type="submit"
									className="w-fit"
									isLoading={update.isPending}
								>
									{t.ui.save}
								</Button>
							</FieldGroup>
						</form>
					</LocalizedDraftGate>
				</CardContent>
			</Card>
			<Card>
				<CardContent className="p-5">
					<DevelopmentPreviewBoundary>
						<SlugAddressForm
							error={replaceSlug.error}
							initialSlug={realm.slugAddress?.slug}
							isPending={replaceSlug.isPending}
							onSubmit={(slug) =>
								replaceSlug.mutateAsync({
									path: { realmId: realm.id },
									body: { slug },
								})
							}
						/>
					</DevelopmentPreviewBoundary>
				</CardContent>
			</Card>
		</section>
	);
}

export function RealmRules({
	realmId,
	data,
	pending,
	error,
	embedded = false,
}: {
	realmId: string;
	data: GetApiRealmsByRealmIdRulesAuthoringStatus200 | undefined;
	pending: boolean;
	error: Parameters<typeof RequestFailure>[0]["error"];
	embedded?: boolean;
}) {
	if (error)
		return (
			<section>
				<RequestFailure error={error} />
			</section>
		);
	if (pending || !data)
		return (
			<section>
				<Skeleton className="h-64 rounded-xl" />
			</section>
		);
	return (
		<RealmRulesEditor
			key={`${realmId}:${data.revisionId ?? "empty"}`}
			data={data}
			embedded={embedded}
			realmId={realmId}
		/>
	);
}

function RealmRulesEditor({
	realmId,
	data,
	embedded,
}: {
	realmId: string;
	data: GetApiRealmsByRealmIdRulesAuthoringStatus200;
	embedded: boolean;
}) {
	const { t, locale } = useTranslation(["locale", "realms", "ui"]);
	const queryClient = useQueryClient();
	const save = usePutApiRealmsByRealmIdRules();
	const [moveAnnouncement, setMoveAnnouncement] = useState("");
	const defaultLanguage = toContentLanguage(locale.target);
	const firstPersistedLanguage = data.items[0]?.localizations[0]?.language;
	const initialLanguage = data.items.some((rule) =>
		rule.localizations.some(({ language }) => language === defaultLanguage),
	)
		? defaultLanguage
		: (firstPersistedLanguage ?? defaultLanguage);
	const [activeLanguage, setActiveLanguage] = useState(initialLanguage);
	const draft = useLocalizedDraft<RealmRulesDraft>({
		scope: "realm-rules",
		partition: "shared",
		baseVersion: data.revisionId,
		codec: RealmRulesDraftCodec,
		createInitialValue: () => ({
			acknowledgementMode: data.acknowledgementMode,
			requireOnJoin: data.requireOnJoin,
			requireOnPost: data.requireOnPost,
			rules: data.items.length
				? data.items.map((rule) => {
						const localizations: Partial<Record<ContentLanguage, RuleLocalizationDraft>> = {};
						const localizationOrder: ContentLanguage[] = [];
						for (const localization of rule.localizations) {
							localizationOrder.push(localization.language);
							localizations[localization.language] = {
								title: localization.title,
								content: readPortableText(localization.content),
							};
						}
						return { draftId: rule.id, localizationOrder, localizations };
					})
				: [
						{
							draftId: createRuleDraftId(),
							localizationOrder: [initialLanguage],
							localizations: { [initialLanguage]: { title: "", content: [] } },
						},
					],
		}),
	});
	const { value } = draft;

	function updateRule(draftId: string, update: (current: RuleDraft) => RuleDraft): void {
		draft.setValue((current) => ({
			...current,
			rules: current.rules.map((rule) => (rule.draftId === draftId ? update(rule) : rule)),
		}));
	}
	function addLocalization(rule: RuleDraft): void {
		const language = activeLanguage;
		if (rule.localizations[language]) return;
		updateRule(rule.draftId, (current) => ({
			...current,
			localizationOrder: [...current.localizationOrder, language],
			localizations: { ...current.localizations, [language]: { title: "", content: [] } },
		}));
	}
	function removeLocalization(rule: RuleDraft): void {
		const language = activeLanguage;
		if (rule.localizationOrder.length === 1 || !rule.localizations[language]) return;
		updateRule(rule.draftId, (current) => {
			const localizations = { ...current.localizations };
			delete localizations[language];
			return {
				...current,
				localizationOrder: current.localizationOrder.filter((candidate) => candidate !== language),
				localizations,
			};
		});
	}
	function updateLocalization(
		rule: RuleDraft,
		update: (current: RuleLocalizationDraft) => RuleLocalizationDraft,
	): void {
		const language = activeLanguage;
		const currentLocalization = rule.localizations[language];
		if (!currentLocalization) return;
		updateRule(rule.draftId, (current) => ({
			...current,
			localizations: { ...current.localizations, [language]: update(currentLocalization) },
		}));
	}
	function moveRule(draftId: string, direction: -1 | 1): void {
		const index = value.rules.findIndex((rule) => rule.draftId === draftId);
		const destination = index + direction;
		if (index < 0 || destination < 0 || destination >= value.rules.length) return;
		draft.setValue((current) => {
			const source = current.rules.findIndex((rule) => rule.draftId === draftId);
			const target = source + direction;
			if (source < 0 || target < 0 || target >= current.rules.length) return current;
			const rules = [...current.rules];
			const [moved] = rules.splice(source, 1);
			if (!moved) return current;
			rules.splice(target, 0, moved);
			return { ...current, rules };
		});
		setMoveAnnouncement(
			t.realms.ruleMoved({ position: destination + 1, count: value.rules.length }),
		);
	}
	const incomplete = value.rules.some((rule) =>
		rule.localizationOrder.some((language) => !rule.localizations[language]?.title.trim()),
	);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (incomplete) return;
		save.mutate(
			{
				path: { realmId },
				body: {
					baseRevisionId: data.revisionId,
					acknowledgementMode: value.acknowledgementMode,
					requireOnJoin: value.requireOnJoin,
					requireOnPost: value.requireOnPost,
					rules: value.rules.map((rule) => ({
						localizations: rule.localizationOrder.map((language) => {
							const localization = rule.localizations[language];
							if (!localization)
								throw new Error("Realm rule draft localization order is inconsistent");
							return {
								language,
								title: localization.title.trim(),
								content: writePortableText(localization.content),
							};
						}),
					})),
				},
			},
			{
				onError: async (error) => {
					if (!hasErrorCode(error, "RealmRuleRevisionChanged")) return;
					await queryClient.invalidateQueries({
						queryKey: getApiRealmsByRealmIdRulesAuthoringQueryKey({
							path: { realmId },
						}),
					});
				},
				onSuccess: async () => {
					draft.commit();
					await Promise.all([
						queryClient.invalidateQueries({
							queryKey: getApiRealmsByRealmIdRulesAuthoringQueryKey({
								path: { realmId },
							}),
						}),
						queryClient.invalidateQueries({
							queryKey: getApiRealmsByRealmIdRulesQueryKey({ path: { realmId } }),
						}),
					]);
				},
			},
		);
	}

	return (
		<section className="grid gap-3">
			{embedded ? null : <h2 className="font-heading text-xl font-bold">{t.realms.rules}</h2>}
			<LocalizedDraftGate
				hydrated={draft.hydrated}
				onDiscard={draft.discard}
				serverChanged={draft.serverChanged}
			>
				<Card>
					<CardContent className="p-5">
						<form className="grid gap-5" onSubmit={submit}>
							<Field>
								<FieldLabel>{t.realms.ruleAcknowledgementMode}</FieldLabel>
								<NativeSelect
									value={value.acknowledgementMode}
									onChange={(event) => {
										const mode = event.currentTarget.value;
										if (mode === "explicit" || mode === "implicit_on_follow")
											draft.setValue((current) => ({
												...current,
												acknowledgementMode: mode,
											}));
									}}
								>
									<NativeSelectOption value="explicit">
										{t.realms.ruleAcknowledgementModes.explicit}
									</NativeSelectOption>
									<NativeSelectOption value="implicit_on_follow">
										{t.realms.ruleAcknowledgementModes.implicitOnFollow}
									</NativeSelectOption>
								</NativeSelect>
							</Field>
							<Field>
								<FieldLabel>{t.realms.ruleLanguage}</FieldLabel>
								<NativeSelect
									value={activeLanguage}
									onChange={(event) => {
										const language = event.currentTarget.value;
										if (isContentLanguage(language)) setActiveLanguage(language);
									}}
								>
									{ContentLanguageValues.map((language) => (
										<NativeSelectOption key={language} value={language}>
											{t.locale.contentLanguages[language]}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Field>
							<div className="grid gap-2">
								<div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
									<RuleRequirement
										checked={value.requireOnJoin}
										onChange={(requireOnJoin) =>
											draft.setValue((current) => ({
												...current,
												requireOnJoin,
											}))
										}
									>
										{t.realms.requireOnJoin}
									</RuleRequirement>
									<RuleRequirement
										checked={value.requireOnPost}
										onChange={(requireOnPost) =>
											draft.setValue((current) => ({
												...current,
												requireOnPost,
											}))
										}
									>
										{t.realms.requireOnPost}
									</RuleRequirement>
								</div>
								<p className="text-muted-foreground text-sm">{t.realms.ruleAcknowledgementHint}</p>
							</div>
							<div aria-live="polite" className="sr-only" role="status">
								{moveAnnouncement}
							</div>
							{value.rules.map((rule, index) => {
								const localization = rule.localizations[activeLanguage];
								return (
									<div key={rule.draftId} className="grid gap-4 border-t pt-5">
										<div className="flex flex-wrap items-center gap-2">
											<h3 className="me-auto font-medium">
												{t.realms.ruleNumber({ position: index + 1 })}
											</h3>
											<span className="text-xs text-muted-foreground">
												{t.realms.ruleTranslationCount({
													count: rule.localizationOrder.length,
												})}
											</span>
											<Button
												aria-label={t.realms.moveRuleUp({
													position: index + 1,
												})}
												disabled={index === 0}
												onClick={() => moveRule(rule.draftId, -1)}
												size="icon-sm"
												type="button"
												variant="outline"
											>
												<ArrowUp aria-hidden />
											</Button>
											<Button
												aria-label={t.realms.moveRuleDown({
													position: index + 1,
												})}
												disabled={index === value.rules.length - 1}
												onClick={() => moveRule(rule.draftId, 1)}
												size="icon-sm"
												type="button"
												variant="outline"
											>
												<ArrowDown aria-hidden />
											</Button>
											<Button
												disabled={value.rules.length === 1}
												onClick={() =>
													draft.setValue((current) => ({
														...current,
														rules: current.rules.filter((item) => item.draftId !== rule.draftId),
													}))
												}
												size="sm"
												type="button"
												variant="quiet"
											>
												{t.realms.removeRule}
											</Button>
										</div>
										{localization ? (
											<>
												<Field required>
													<FieldLabel>{t.realms.ruleTitle}</FieldLabel>
													<Input
														maxLength={500}
														onChange={(event) => {
															const title = event.currentTarget.value;
															updateLocalization(rule, (current) => ({
																...current,
																title,
															}));
														}}
														required
														value={localization.title}
													/>
												</Field>
												<PortableTextEditor
													key={`${rule.draftId}:${activeLanguage}`}
													label={t.realms.ruleContent}
													onChange={(content) =>
														updateLocalization(rule, (current) => ({
															...current,
															content,
														}))
													}
													value={localization.content}
												/>
												<Button
													disabled={rule.localizationOrder.length === 1}
													onClick={() => removeLocalization(rule)}
													size="sm"
													type="button"
													variant="quiet"
												>
													{t.realms.removeRuleTranslation}
												</Button>
											</>
										) : (
											<div className="grid justify-items-start gap-3 rounded-xl border border-dashed p-5">
												<p className="text-sm text-muted-foreground">
													{t.realms.ruleTranslationMissing({
														language: t.locale.contentLanguages[activeLanguage],
													})}
												</p>
												<Button
													onClick={() => addLocalization(rule)}
													type="button"
													variant="outline"
												>
													{t.realms.addRuleTranslation}
												</Button>
											</div>
										)}
									</div>
								);
							})}
							<div className="flex flex-wrap gap-2">
								<Button
									disabled={value.rules.length >= 100}
									type="button"
									variant="outline"
									onClick={() =>
										draft.setValue((current) => ({
											...current,
											rules: [
												...current.rules,
												{
													draftId: createRuleDraftId(),
													localizationOrder: [activeLanguage],
													localizations: {
														[activeLanguage]: {
															title: "",
															content: [],
														},
													},
												},
											],
										}))
									}
								>
									{t.realms.addRule}
								</Button>
								<Button
									variant="solid"
									type="submit"
									disabled={incomplete || !draft.dirty}
									isLoading={save.isPending}
								>
									{t.ui.save}
								</Button>
							</div>
							{incomplete ? (
								<p className="text-sm text-destructive">{t.realms.ruleTranslationsIncomplete}</p>
							) : null}
							<RequestFailure error={save.error} />
						</form>
					</CardContent>
				</Card>
			</LocalizedDraftGate>
		</section>
	);
}

function RuleRequirement({
	checked,
	onChange,
	children,
}: {
	checked: boolean;
	onChange: (value: boolean) => void;
	children: string;
}) {
	return (
		<Field className="w-auto" orientation="horizontal">
			<Checkbox checked={checked} onCheckedChange={({ checked }) => onChange(checked === true)} />
			<FieldLabel className="font-normal">{children}</FieldLabel>
		</Field>
	);
}
