"use client";

import {
	ContentLanguageValues,
	isContentLanguage,
	toContentLanguage,
	type ContentLanguage,
} from "@rezics/i18n";
import { publicSlugHref } from "@rezics/slug";

import {
	getApiRealmsByRealmIdRulesQueryKey,
	getApiRealmsByRealmIdRulesQueryOptions,
	usePatchApiRealmsByRealmId,
	useGetApiUnitsByIdByUnitIdLocalizationOrder,
	usePutApiRealmsByRealmIdRules,
	useReplaceRealmSlugAddress,
	type GetApiRealmsByRealmIdRulesStatus200,
	type GetApiRealmsByRealmIdStatus200,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextDocument } from "@rezics/block";
import type { PortableTextValue } from "@rezics/portable-text";
import { useQueryClient } from "@tanstack/react-query";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import { Checkbox } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { Skeleton } from "@rezics/ui";
import { Spinner } from "@rezics/ui";
import { Textarea } from "@rezics/ui";
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
import { useContentLanguageEditor } from "@/features/content-languages/hooks/use-content-language-editor";
import { useTranslation } from "@/i18n/client";
import { SlugAddressForm } from "@/features/slugs/slug-address-form";
import { DevelopmentPreviewBoundary } from "@/features/preview-access/components/development-preview-boundary";
import { RequestFailure } from "@/i18n/request-failure";
import { readPortableText, writePortableText } from "@/lib/block";
import { invalidateRealmDetails } from "./query";

type RuleDraft = {
	draftId: string;
	source: { kind: "persisted"; unitId: string } | { kind: "new" };
	language: ContentLanguage;
	title: string;
	content: PortableTextValue;
	document?: PortableTextDocument;
	languageRequest:
		| { status: "idle" }
		| { status: "pending"; language: ContentLanguage }
		| { status: "error"; error: unknown };
};
type RuleAcknowledgementMode = "explicit" | "implicit_on_follow";

function createRuleDraftId(): string {
	return crypto.randomUUID();
}

export function RealmProfileSettings({
	realm,
	embedded = false,
}: {
	realm: GetApiRealmsByRealmIdStatus200;
	embedded?: boolean;
}) {
	const { t } = useTranslation(["errors", "locale", "media", "realms", "state", "ui"]);
	const { selectedLanguage, selectedLanguageIsPending, setDirty, languagesChanged } =
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
	const [avatar, setAvatar] = useState<AvatarFieldValue | null>(localization?.avatar ?? null);
	const [banner, setBanner] = useState<LocalizationImageAssetValue | null>(
		localization?.banner ?? null,
	);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const title = String(data.get("title") ?? "").trim();
		const summary = String(data.get("summary") ?? "").trim();
		if (!title) return;
		const submittedStatus = data.get("status");
		const submittedVisibility = data.get("visibility");
		const status =
			submittedStatus === "published" || submittedStatus === "archived"
				? submittedStatus
				: "draft";
		const visibility =
			submittedVisibility === "unlisted" || submittedVisibility === "private"
				? submittedVisibility
				: "public";
		update.mutate(
			{
				path: { realmId: realm.id },
				body: {
					status,
					visibility,
					joinPolicy: data.get("joinPolicy") === "approval" ? "approval" : "open",
					localization: {
						language: selectedLanguage,
						title,
						...(summary ? { summary } : {}),
						avatar: avatarPresentationToInput(avatar),
						bannerAssetId: banner?.id ?? null,
					},
				},
			},
			{
				onSuccess: async () => {
					setDirty(false);
					await invalidateRealmDetails(queryClient, realm.id);
					await languagesChanged();
				},
			},
		);
	}

	return (
		<section className="grid gap-3">
			{embedded ? null : (
				<h2 className="font-heading text-xl font-bold">{t.realms.profile}</h2>
			)}
			<Card>
				<CardContent className="grid gap-6 p-5">
					<ContentLanguageControl />
					<LocalizationMediaFallbackNotice />
					<form className="grid gap-6" onChange={() => setDirty(true)} onSubmit={submit}>
						<FieldGroup>
							<Field required>
								<FieldLabel>{t.ui.title}</FieldLabel>
								<Input
									name="title"
									required
									maxLength={500}
									defaultValue={
										selectedLanguageIsPending ? "" : (localization?.title ?? "")
									}
								/>
							</Field>
							<Field>
								<FieldLabel>{t.ui.summary}</FieldLabel>
								<Textarea
									name="summary"
									maxLength={2000}
									defaultValue={
										selectedLanguageIsPending
											? ""
											: (localization?.summary ?? "")
									}
								/>
							</Field>
							<Field>
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
								<FieldLabel>{t.media.roles.banner.title}</FieldLabel>
								<LocalizationImageUploadField
									fallback={bannerOptions[0] ?? null}
									onChange={(value) => {
										setBanner(value);
										setDirty(true);
									}}
									options={bannerOptions}
									role="banner"
									value={banner}
								/>
							</Field>
							<div className="grid gap-4 sm:grid-cols-3">
								<Field>
									<FieldLabel>{t.ui.status}</FieldLabel>
									<NativeSelect name="status" defaultValue={realm.status}>
										<NativeSelectOption value="draft">
											{t.ui.draft}
										</NativeSelectOption>
										<NativeSelectOption value="published">
											{t.ui.published}
										</NativeSelectOption>
										<NativeSelectOption value="archived">
											{t.ui.archived}
										</NativeSelectOption>
									</NativeSelect>
								</Field>
								<Field>
									<FieldLabel>{t.ui.visibility}</FieldLabel>
									<NativeSelect name="visibility" defaultValue={realm.visibility}>
										<NativeSelectOption value="public">
											{t.ui.public}
										</NativeSelectOption>
										<NativeSelectOption value="unlisted">
											{t.ui.unlisted}
										</NativeSelectOption>
										<NativeSelectOption value="private">
											{t.ui.private}
										</NativeSelectOption>
									</NativeSelect>
								</Field>
								<Field>
									<FieldLabel>{t.realms.joinPolicy}</FieldLabel>
									<NativeSelect name="joinPolicy" defaultValue={realm.joinPolicy}>
										<NativeSelectOption value="open">
											{t.realms.open}
										</NativeSelectOption>
										<NativeSelectOption value="approval">
											{t.realms.approval}
										</NativeSelectOption>
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
	data: GetApiRealmsByRealmIdRulesStatus200 | undefined;
	pending: boolean;
	error: Parameters<typeof RequestFailure>[0]["error"];
	embedded?: boolean;
}) {
	const { t, locale } = useTranslation(["errors", "locale", "media", "realms", "state", "ui"]);
	const queryClient = useQueryClient();
	const save = usePutApiRealmsByRealmIdRules();
	const [drafts, setDrafts] = useState<RuleDraft[]>();
	const initializedRevision = useRef<string | undefined>(undefined);
	const [acknowledgementMode, setAcknowledgementMode] =
		useState<RuleAcknowledgementMode>("explicit");
	const [requireOnJoin, setRequireOnJoin] = useState(false);
	const [requireOnPost, setRequireOnPost] = useState(false);
	const defaultLanguage = toContentLanguage(locale.target);

	useEffect(() => {
		if (!data) return;
		const revisionKey = `${realmId}:${data.revisionId ?? "empty"}`;
		if (initializedRevision.current === revisionKey) return;
		initializedRevision.current = revisionKey;
		setDrafts(
			data.items.length
				? data.items.map((rule) => ({
						draftId: rule.id,
						source: { kind: "persisted" as const, unitId: rule.id },
						language: rule.language,
						title: rule.title,
						content: readPortableText(rule.content),
						document: rule.content,
						languageRequest: { status: "idle" as const },
					}))
				: [
						{
							draftId: createRuleDraftId(),
							source: { kind: "new" as const },
							language: defaultLanguage,
							title: "",
							content: [],
							languageRequest: { status: "idle" as const },
						},
					],
		);
		setAcknowledgementMode(data.acknowledgementMode);
		setRequireOnJoin(Boolean(data.requireOnJoin));
		setRequireOnPost(Boolean(data.requireOnPost));
	}, [data, defaultLanguage, realmId]);

	if (error)
		return (
			<section>
				<RequestFailure error={error} />
			</section>
		);
	if (pending || !drafts)
		return (
			<section>
				<Skeleton className="h-64 rounded-xl" />
			</section>
		);
	const currentDrafts = drafts;
	const languageChangePending = currentDrafts.some(
		(rule) => rule.languageRequest.status === "pending",
	);

	async function changeRuleLanguage(rule: RuleDraft, language: ContentLanguage) {
		if (language === rule.language) {
			setDrafts((current) =>
				current?.map((item) =>
					item.draftId === rule.draftId
						? { ...item, languageRequest: { status: "idle" } }
						: item,
				),
			);
			return;
		}

		if (rule.source.kind === "new") {
			setDrafts((current) =>
				current?.map((item) =>
					item.draftId === rule.draftId
						? { ...item, language, languageRequest: { status: "idle" } }
						: item,
				),
			);
			return;
		}
		const ruleUnitId = rule.source.unitId;

		setDrafts((current) =>
			current?.map((item) =>
				item.draftId === rule.draftId
					? { ...item, languageRequest: { status: "pending", language } }
					: item,
			),
		);

		try {
			const localizedRules = await queryClient.fetchQuery(
				getApiRealmsByRealmIdRulesQueryOptions({
					path: { realmId },
					query: { localizationLanguages: [language] },
				}),
			);
			const localizedRule = localizedRules.items.find((item) => item.id === ruleUnitId);
			if (!localizedRule || localizedRule.language !== language)
				throw new Error("Requested Realm rule localization is unavailable");

			setDrafts((current) =>
				current?.map((item) =>
					item.draftId === rule.draftId &&
					item.languageRequest.status === "pending" &&
					item.languageRequest.language === language
						? {
								...item,
								language,
								title: localizedRule.title,
								content: readPortableText(localizedRule.content),
								document: localizedRule.content,
								languageRequest: { status: "idle" },
							}
						: item,
				),
			);
		} catch (languageError) {
			setDrafts((current) =>
				current?.map((item) =>
					item.draftId === rule.draftId &&
					item.languageRequest.status === "pending" &&
					item.languageRequest.language === language
						? {
								...item,
								languageRequest: { status: "error", error: languageError },
							}
						: item,
				),
			);
		}
	}

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (languageChangePending) return;
		const rules = currentDrafts.filter((rule) => rule.title.trim());
		if (!rules.length) return;
		save.mutate(
			{
				path: { realmId },
				body: {
					acknowledgementMode,
					requireOnJoin,
					requireOnPost,
					rules: rules.map((rule) => ({
						language: rule.language,
						title: rule.title.trim(),
						content: writePortableText(rule.content, rule.document),
					})),
				},
			},
			{
				onSuccess: () =>
					queryClient.invalidateQueries({
						queryKey: getApiRealmsByRealmIdRulesQueryKey({ path: { realmId } }),
					}),
			},
		);
	}

	return (
		<section className="grid gap-3">
			{embedded ? null : <h2 className="font-heading text-xl font-bold">{t.realms.rules}</h2>}
			<Card>
				<CardContent className="p-5">
					<form className="grid gap-5" onSubmit={submit}>
						<Field>
							<FieldLabel>{t.realms.ruleAcknowledgementMode}</FieldLabel>
							<NativeSelect
								value={acknowledgementMode}
								onChange={(event) => {
									const mode = event.currentTarget.value;
									if (mode === "explicit" || mode === "implicit_on_follow")
										setAcknowledgementMode(mode);
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
						<div className="grid gap-2">
							<div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
								<RuleRequirement
									checked={requireOnJoin}
									onChange={setRequireOnJoin}
								>
									{t.realms.requireOnJoin}
								</RuleRequirement>
								<RuleRequirement
									checked={requireOnPost}
									onChange={setRequireOnPost}
								>
									{t.realms.requireOnPost}
								</RuleRequirement>
							</div>
							<p className="text-muted-foreground text-sm">
								{t.realms.ruleAcknowledgementHint}
							</p>
						</div>
						{drafts.map((rule) => {
							const languagePending = rule.languageRequest.status === "pending";
							return (
								<div
									key={rule.draftId}
									aria-busy={languagePending || undefined}
									className="grid gap-3 border-t pt-5"
								>
									<div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
										<RuleLanguageField
											draft={rule}
											onChange={(language) =>
												void changeRuleLanguage(rule, language)
											}
										/>
										<Field required>
											<FieldLabel>{t.realms.ruleTitle}</FieldLabel>
											{languagePending ? (
												<Skeleton className="h-9 rounded-md" />
											) : (
												<Input
													required
													maxLength={500}
													value={rule.title}
													onChange={(event) => {
														const title = event.currentTarget.value;
														setDrafts((current) =>
															current?.map((item) =>
																item.draftId === rule.draftId
																	? { ...item, title }
																	: item,
															),
														);
													}}
												/>
											)}
										</Field>
										<Button
											type="button"
											size="sm"
											variant="quiet"
											disabled={drafts.length === 1 || languagePending}
											onClick={() =>
												setDrafts((current) =>
													current?.filter(
														(item) => item.draftId !== rule.draftId,
													),
												)
											}
										>
											{t.realms.removeRule}
										</Button>
									</div>
									{languagePending ? (
										<div
											className="flex min-h-48 items-center justify-center gap-2 rounded-xl border bg-muted/20 text-muted-foreground"
											role="status"
										>
											<Spinner aria-hidden className="size-5" />
											<span className="text-sm">{t.state.loading}</span>
										</div>
									) : (
										<PortableTextEditor
											key={`${rule.draftId}:${rule.language}`}
											label={t.realms.ruleContent}
											value={rule.content}
											onChange={(content) =>
												setDrafts((current) =>
													current?.map((item) =>
														item.draftId === rule.draftId
															? { ...item, content }
															: item,
													),
												)
											}
										/>
									)}
									<RequestFailure
										error={
											rule.languageRequest.status === "error"
												? rule.languageRequest.error
												: undefined
										}
									/>
								</div>
							);
						})}
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() =>
									setDrafts((current) => [
										...(current ?? []),
										{
											draftId: createRuleDraftId(),
											source: { kind: "new" },
											language: toContentLanguage(locale.target),
											title: "",
											content: [],
											languageRequest: { status: "idle" },
										},
									])
								}
							>
								{t.realms.addRule}
							</Button>
							<Button
								variant="solid"
								type="submit"
								disabled={languageChangePending}
								isLoading={save.isPending}
							>
								{t.ui.save}
							</Button>
						</div>
						<RequestFailure error={save.error} />
					</form>
				</CardContent>
			</Card>
		</section>
	);
}

function RuleLanguageField({
	draft,
	onChange,
}: {
	draft: RuleDraft;
	onChange: (language: ContentLanguage) => void;
}) {
	if (draft.source.kind === "new")
		return (
			<RuleLanguageSelect
				disabled={false}
				draft={draft}
				languages={ContentLanguageValues}
				onChange={onChange}
			/>
		);
	return (
		<PersistedRuleLanguageField
			draft={draft}
			onChange={onChange}
			unitId={draft.source.unitId}
		/>
	);
}

function PersistedRuleLanguageField({
	draft,
	unitId,
	onChange,
}: {
	draft: RuleDraft;
	unitId: string;
	onChange: (language: ContentLanguage) => void;
}) {
	const query = useGetApiUnitsByIdByUnitIdLocalizationOrder({ path: { unitId } });
	const selectedLanguage =
		draft.languageRequest.status === "pending"
			? draft.languageRequest.language
			: draft.language;
	const supportedLanguages = query.data?.languages ?? [];
	const languages = supportedLanguages.includes(selectedLanguage)
		? supportedLanguages
		: [selectedLanguage, ...supportedLanguages];

	return (
		<div className="grid gap-1">
			<RuleLanguageSelect
				disabled={query.isPending || query.isError}
				draft={draft}
				languages={languages}
				onChange={onChange}
			/>
			<RequestFailure error={query.error} />
		</div>
	);
}

function RuleLanguageSelect({
	disabled,
	draft,
	languages,
	onChange,
}: {
	disabled: boolean;
	draft: RuleDraft;
	languages: readonly ContentLanguage[];
	onChange: (language: ContentLanguage) => void;
}) {
	const { t } = useTranslation(["locale", "realms"]);
	const pending = draft.languageRequest.status === "pending";
	const selectedLanguage =
		draft.languageRequest.status === "pending"
			? draft.languageRequest.language
			: draft.language;

	return (
		<Field>
			<FieldLabel>{t.realms.ruleLanguage}</FieldLabel>
			<NativeSelect
				disabled={disabled || pending}
				value={selectedLanguage}
				onChange={(event) => {
					const language = event.currentTarget.value;
					if (isContentLanguage(language)) onChange(language);
				}}
			>
				{languages.map((language) => (
					<NativeSelectOption key={language} value={language}>
						{t.locale.contentLanguages[language]}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
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
			<Checkbox
				checked={checked}
				onCheckedChange={({ checked }) => onChange(checked === true)}
			/>
			<FieldLabel className="font-normal">{children}</FieldLabel>
		</Field>
	);
}
