"use client";

import type { ContentLanguage } from "@rezics/i18n";
import {
	isPublicationLicenseId,
	isUnitContentLicenseSlug,
	PublicationLicenseIds,
} from "@rezics/license";

import {
	type GetApiUnitsByTypeByUnitIdStatus200,
	usePatchApiUnitsByTypeByUnitId,
	usePostApiUnitsByTypeByUnitIdCreditAttributions,
	usePostApiUnitsByTypeByUnitIdLinks,
	usePostApiUnitsByTypeByUnitIdSubjectAssociations,
	usePutApiUnitsByTypeByUnitIdLocalizationsByLanguage,
	usePutApiUnitsByTypeByUnitIdVersionOfByCanonicalId,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { useQueryClient } from "@tanstack/react-query";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useDeferredValue, useState, type FormEvent } from "react";

import { Badge, EntityPicker } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { Textarea } from "@rezics/ui";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { ContentLanguageControl } from "@/features/content-languages/components/content-language-control";
import { useContentLanguageEditor } from "@/features/content-languages/hooks/use-content-language-editor";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { readPortableText, writePortableText } from "@/lib/block";
import { invalidateUnitDetail } from "./unit-cache";
import {
	LocalizationImageUploadField,
	type LocalizationImageAssetOption,
	type LocalizationImageAssetValue,
} from "@/features/media/components/localization-image-upload-field";
import { LocalizationMediaFallbackNotice } from "@/features/media/components/localization-media-fallback-notice";
import { FeedCard } from "@/features/content-feed/components/feed-card";
import { FeedUnitContent } from "@/features/content-feed/components/feed-unit-content";
import { isWorkUnitType, isVariantUnitType, type WorkUnitType, type UnitType } from "./unit-types";
import {
	CreditAttributionRolesByUnitType,
	isCreditAttributionRoleForUnitType,
	isSubjectAssociationRole,
	SubjectAssociationRoles,
} from "./attribution-role";
import { UnitContentLicenseField } from "./components/unit-content-license-field";

export type EditableUnit = GetApiUnitsByTypeByUnitIdStatus200;
type Unit = EditableUnit;
type SelectedEntity = { id: string; label: string };

function readPositiveInteger(form: FormData, name: string): number | null | undefined {
	const raw = String(form.get(name) ?? "").trim();
	if (!raw) return null;
	const value = Number(raw);
	return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

export function UnitMetadataEditor({ type, unit }: { type: UnitType; unit: Unit }) {
	const { t } = useTranslation(["cover", "errors", "licenses", "ui", "units"]);
	const queryClient = useQueryClient();
	const update = usePatchApiUnitsByTypeByUnitId({
		mutation: {
			onSuccess: async () => invalidateUnitDetail(queryClient, type, unit.id, true),
		},
	});

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const releasedOn = String(form.get("releasedOn") ?? "").trim();
		const submittedStatus = form.get("status");
		const submittedVisibility = form.get("visibility");
		const submittedContentRating = form.get("contentRating");
		const submittedAiDisclosure = form.get("aiDisclosure");
		const submittedLicense = form.get("license");
		if (
			submittedLicense !== null &&
			submittedLicense !== "" &&
			!isPublicationLicenseId(submittedLicense)
		)
			return;
		const status =
			submittedStatus === "published" || submittedStatus === "archived"
				? submittedStatus
				: "draft";
		const visibility =
			submittedVisibility === "unlisted" || submittedVisibility === "private"
				? submittedVisibility
				: "public";
		const contentRating =
			submittedContentRating === "r15" ||
			submittedContentRating === "r18" ||
			submittedContentRating === "r18g"
				? submittedContentRating
				: "general";
		const aiDisclosure =
			submittedAiDisclosure === "none" ||
			submittedAiDisclosure === "ai_assisted" ||
			submittedAiDisclosure === "ai_originated" ||
			submittedAiDisclosure === "machine_generated"
				? submittedAiDisclosure
				: "unknown";
		const submittedContentLicense = form.get("contentLicense");
		if (
			submittedContentLicense !== null &&
			submittedContentLicense !== "none" &&
			!isUnitContentLicenseSlug(submittedContentLicense)
		)
			return;
		const contentLicenseGrant = isUnitContentLicenseSlug(submittedContentLicense)
			? { referenceLicenseSlug: submittedContentLicense }
			: undefined;
		const details = (() => {
			if (unit.details.type === "book") {
				const pageCount = readPositiveInteger(form, "pageCount");
				if (pageCount === undefined) return undefined;
				return {
					isbn13: String(form.get("isbn13") ?? "").trim() || null,
					publicationDate: releasedOn || null,
					pageCount,
					format: String(form.get("format") ?? "").trim() || null,
					...(contentLicenseGrant ? { contentLicense: contentLicenseGrant } : {}),
				};
			}
			if (unit.details.type === "software")
				return {
					versionLabel: String(form.get("versionLabel") ?? "").trim() || null,
					...(contentLicenseGrant ? { contentLicense: contentLicenseGrant } : {}),
				};
			if (unit.details.type === "media") {
				const runtimeMinutes = readPositiveInteger(form, "runtimeMinutes");
				const episodeCount = readPositiveInteger(form, "episodeCount");
				const seasonCount = readPositiveInteger(form, "seasonCount");
				if (
					runtimeMinutes === undefined ||
					episodeCount === undefined ||
					seasonCount === undefined
				)
					return undefined;
				const kind = String(form.get("kind") ?? "").trim();
				if (!kind) return undefined;
				return {
					kind,
					runtimeMinutes,
					episodeCount,
					seasonCount,
					...(contentLicenseGrant ? { contentLicense: contentLicenseGrant } : {}),
				};
			}
			if (unit.details.type === "video" || unit.details.type === "audio") {
				const durationSeconds = readPositiveInteger(form, "durationSeconds");
				if (durationSeconds === undefined) return undefined;
				return { durationSeconds };
			}
			const kind = String(form.get("kind") ?? "").trim();
			return kind ? { kind } : undefined;
		})();
		if (!details) return;
		try {
			await update.mutateAsync({
				path: { type, unitId: unit.id },
				body: {
					updatedAt: unit.updatedAt,
					status,
					visibility,
					contentRating,
					aiDisclosure,
					license: isPublicationLicenseId(submittedLicense) ? submittedLicense : null,
					unit: {
						...(unit.details.type === "series" ||
						unit.details.type === "video" ||
						unit.details.type === "audio"
							? {}
							: { releasedOn: releasedOn || null }),
					},
					details,
				},
			});
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<Card appearance="outlined">
			<CardContent className="p-6">
				<form onSubmit={submit}>
					<FieldGroup>
						<h2 className="font-heading text-xl font-bold">
							{t.units.editor.settings}
						</h2>
						<Field>
							<FieldLabel>{t.ui.status}</FieldLabel>
							<NativeSelect name="status" defaultValue={unit.status}>
								<NativeSelectOption value="draft">{t.ui.draft}</NativeSelectOption>
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
							<NativeSelect name="visibility" defaultValue={unit.visibility}>
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
							<FieldLabel>{t.ui.contentRating}</FieldLabel>
							<NativeSelect name="contentRating" defaultValue={unit.contentRating}>
								<NativeSelectOption value="general">
									{t.units.rating.general}
								</NativeSelectOption>
								<NativeSelectOption value="r15">
									{t.units.rating.r15}
								</NativeSelectOption>
								<NativeSelectOption value="r18">
									{t.units.rating.r18}
								</NativeSelectOption>
								<NativeSelectOption value="r18g">
									{t.units.rating.r18g}
								</NativeSelectOption>
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel>{t.units.detail.aiDisclosure}</FieldLabel>
							<NativeSelect name="aiDisclosure" defaultValue={unit.aiDisclosure}>
								<NativeSelectOption value="unknown">
									{t.units.aiDisclosure.unknown}
								</NativeSelectOption>
								<NativeSelectOption value="none">
									{t.units.aiDisclosure.none}
								</NativeSelectOption>
								<NativeSelectOption value="ai_assisted">
									{t.units.aiDisclosure.ai_assisted}
								</NativeSelectOption>
								<NativeSelectOption value="ai_originated">
									{t.units.aiDisclosure.ai_originated}
								</NativeSelectOption>
								<NativeSelectOption value="machine_generated">
									{t.units.aiDisclosure.machine_generated}
								</NativeSelectOption>
							</NativeSelect>
						</Field>
						{unit.details.type !== "series" &&
						unit.details.type !== "video" &&
						unit.details.type !== "audio" ? (
							<Field>
								<FieldLabel>
									{unit.details.type === "book"
										? t.units.fields.publicationDate
										: t.units.fields.releaseDate}
								</FieldLabel>
								<Input
									defaultValue={unit.releasedOn ?? ""}
									name="releasedOn"
									type="date"
								/>
							</Field>
						) : null}
						<UnitTypeSpecificFields unit={unit} />
						{unit.ownershipMode === "profile_owned" &&
						(unit.details.type === "book" ||
							unit.details.type === "software" ||
							unit.details.type === "media") ? (
							<UnitContentLicenseField
								defaultSlug={
									unit.details.contentLicense?.referenceLicenseSlug ?? null
								}
							/>
						) : null}
						<Field>
							<FieldLabel>{t.units.detail.license}</FieldLabel>
							<NativeSelect defaultValue={unit.license ?? ""} name="license">
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
						<Button variant="solid" isLoading={update.isPending} type="submit">
							{t.units.editor.saveSettings}
						</Button>
						<RequestFailure error={update.error} fallback={t.ui.retryLater} />
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}

function UnitTypeSpecificFields({ unit }: { unit: Unit }) {
	const { t } = useTranslation(["units"]);
	const details = unit.details;
	if (details.type === "book")
		return (
			<>
				<Field>
					<FieldLabel>{t.units.fields.isbn13}</FieldLabel>
					<Input defaultValue={details.isbn13 ?? ""} name="isbn13" pattern="[0-9]{13}" />
				</Field>
				<Field>
					<FieldLabel>{t.units.fields.pageCount}</FieldLabel>
					<Input
						defaultValue={details.pageCount ?? ""}
						min={1}
						name="pageCount"
						type="number"
					/>
				</Field>
				<Field>
					<FieldLabel>{t.units.fields.format}</FieldLabel>
					<Input defaultValue={details.format ?? ""} name="format" />
				</Field>
			</>
		);
	if (details.type === "software")
		return (
			<>
				<Field>
					<FieldLabel>{t.units.fields.versionLabel}</FieldLabel>
					<Input defaultValue={details.versionLabel ?? ""} name="versionLabel" />
				</Field>
			</>
		);
	if (details.type === "media")
		return (
			<>
				<Field required>
					<FieldLabel>{t.units.fields.mediaKind}</FieldLabel>
					<Input defaultValue={details.kind} name="kind" required />
				</Field>
				<Field>
					<FieldLabel>{t.units.fields.runtimeMinutes}</FieldLabel>
					<Input
						defaultValue={details.runtimeMinutes ?? ""}
						min={1}
						name="runtimeMinutes"
						type="number"
					/>
				</Field>
				<Field>
					<FieldLabel>{t.units.fields.episodeCount}</FieldLabel>
					<Input
						defaultValue={details.episodeCount ?? ""}
						min={1}
						name="episodeCount"
						type="number"
					/>
				</Field>
				<Field>
					<FieldLabel>{t.units.fields.seasonCount}</FieldLabel>
					<Input
						defaultValue={details.seasonCount ?? ""}
						min={1}
						name="seasonCount"
						type="number"
					/>
				</Field>
			</>
		);
	if (details.type === "video" || details.type === "audio")
		return (
			<Field>
				<FieldLabel>{t.units.fields.durationSeconds}</FieldLabel>
				<Input
					defaultValue={details.durationSeconds ?? ""}
					min={1}
					name="durationSeconds"
					type="number"
				/>
			</Field>
		);
	if ("kind" in details)
		return (
			<Field required>
				<FieldLabel>{t.units.series.kind}</FieldLabel>
				<Input defaultValue={details.kind} maxLength={64} name="kind" required />
			</Field>
		);
	return null;
}

export function UnitContentEditor({ type, unit }: { type: UnitType; unit: Unit }) {
	const { t } = useTranslation(["cover", "errors", "ui", "units"]);
	const { selectedLanguage: language, selectedLanguageIsPending } = useContentLanguageEditor();
	const selected = unit.localizations.find((entry) => entry.language === language);
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-center gap-4 rounded-2xl bg-card p-4 sm:p-5">
				<LocalizationMediaFallbackNotice />
				{selectedLanguageIsPending ? (
					<p className="text-sm text-muted-foreground">
						{t.units.contentLanguages.addDescription}
					</p>
				) : null}
				<div className="ms-auto shrink-0">
					<ContentLanguageControl />
				</div>
			</div>
			<UnitLocalizationForm
				key={`${unit.id}:${language}:${selected?.updatedAt ?? "new"}`}
				language={language}
				localization={selected}
				type={type}
				unit={unit}
			/>
		</div>
	);
}

function UnitLocalizationForm({
	type,
	unit,
	language,
	localization,
}: {
	type: UnitType;
	unit: Unit;
	language: ContentLanguage;
	localization: Unit["localizations"][number] | undefined;
}) {
	const { t } = useTranslation(["cover", "editor", "errors", "feed", "locale", "ui", "units"]);
	const queryClient = useQueryClient();
	const { dirty, setDirty, languagesChanged } = useContentLanguageEditor();
	const [title, setTitle] = useState(localization?.title ?? "");
	const [summary, setSummary] = useState(localization?.summary ?? "");
	const [description, setDescription] = useState<PortableTextValue>(() =>
		readPortableText(localization?.description),
	);
	const [cover, setCover] = useState<LocalizationImageAssetValue | null>(
		localization?.cover ?? null,
	);
	const deferredTitle = useDeferredValue(title);
	const deferredSummary = useDeferredValue(summary);
	const coverOptions: LocalizationImageAssetOption[] = unit.localizations.flatMap((entry) =>
		entry.language !== language && entry.cover
			? [{ ...entry.cover, label: t.locale.contentLanguages[entry.language] }]
			: [],
	);
	const fallbackCover = coverOptions[0] ?? null;
	const update = usePutApiUnitsByTypeByUnitIdLocalizationsByLanguage({
		mutation: {
			onSuccess: async () => invalidateUnitDetail(queryClient, type, unit.id, true),
		},
	});
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		try {
			await update.mutateAsync({
				path: { type, unitId: unit.id, language },
				body: {
					title: title.trim(),
					summary: summary.trim(),
					description: writePortableText(description, localization?.description),
					coverAssetId: cover?.id ?? null,
				},
			});
			setDirty(false);
			await languagesChanged();
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	const previewKindLabel = isWorkUnitType(type)
		? t.feed.content.kinds[`unit:${type}`]
		: t.units.types[type];
	return (
		<form
			className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]"
			onSubmit={submit}
		>
			<div className="min-w-0">
				<FieldGroup>
					<Field required>
						<FieldLabel>{t.ui.title}</FieldLabel>
						<Input
							maxLength={500}
							name="title"
							onChange={(event) => {
								setTitle(event.target.value);
								setDirty(true);
							}}
							required
							value={title}
						/>
					</Field>
					<Field>
						<FieldLabel>{t.ui.summary}</FieldLabel>
						<Textarea
							maxLength={2000}
							name="summary"
							onChange={(event) => {
								setSummary(event.target.value);
								setDirty(true);
							}}
							value={summary}
						/>
					</Field>
					<PortableTextEditor
						label={t.ui.description}
						onChange={(value) => {
							setDescription(value);
							setDirty(true);
						}}
						value={description}
					/>
					<Field>
						<FieldLabel>{t.cover.title}</FieldLabel>
						<LocalizationImageUploadField
							fallback={fallbackCover}
							onChange={(value) => {
								setCover(value);
								setDirty(true);
							}}
							options={coverOptions}
							role="cover"
							value={cover}
						/>
					</Field>
					<div className="flex flex-wrap items-center gap-3">
						<Button
							disabled={!dirty || !title.trim()}
							isLoading={update.isPending}
							type="submit"
							variant="solid"
						>
							{t.ui.save}
						</Button>
						{dirty ? (
							<Badge variant="secondary">{t.units.content.unsavedDraft}</Badge>
						) : null}
					</div>
					<RequestFailure error={update.error} fallback={t.ui.retryLater} />
				</FieldGroup>
			</div>
			<aside className="grid gap-3 lg:sticky lg:top-6">
				<h3 className="font-heading font-bold text-sm">{t.editor.preview}</h3>
				<FeedCard aria-label={t.editor.preview}>
					<FeedUnitContent
						coverUrl={cover?.url ?? fallbackCover?.url}
						headingId={`unit-content-preview-${unit.id}-${language}`}
						headingLevel={3}
						kind={type}
						kindLabel={previewKindLabel}
						standalone
						summary={deferredSummary.trim()}
						title={deferredTitle.trim() || t.ui.unnamed}
					/>
				</FeedCard>
			</aside>
		</form>
	);
}

export function UnitRelationships({ type, unit }: { type: WorkUnitType; unit: Unit }) {
	const { t } = useTranslation(["cover", "errors", "tags", "ui", "units"]);
	const queryClient = useQueryClient();
	const invalidate = () => invalidateUnitDetail(queryClient, type, unit.id);
	const credit = usePostApiUnitsByTypeByUnitIdCreditAttributions({
		mutation: { onSuccess: invalidate },
	});
	const subject = usePostApiUnitsByTypeByUnitIdSubjectAssociations({
		mutation: { onSuccess: invalidate },
	});
	const link = usePostApiUnitsByTypeByUnitIdLinks({ mutation: { onSuccess: invalidate } });
	const version = usePutApiUnitsByTypeByUnitIdVersionOfByCanonicalId({
		mutation: { onSuccess: invalidate },
	});
	const [creditEntity, setCreditEntity] = useState<SelectedEntity>();
	const [subjectEntity, setSubjectEntity] = useState<SelectedEntity>();
	const [subjectContextPost, setSubjectContextPost] = useState<SelectedEntity>();
	const [linkSource, setLinkSource] = useState<SelectedEntity>();
	const [canonicalUnit, setCanonicalUnit] = useState<SelectedEntity>();

	return (
		<Card>
			<CardContent className="grid gap-8 p-6">
				<h2 className="font-heading text-xl font-bold">{t.units.editor.relationships}</h2>
				<form
					className="grid gap-4"
					onSubmit={async (event) => {
						event.preventDefault();
						if (!creditEntity) return;
						const formElement = event.currentTarget;
						const form = new FormData(formElement);
						const role = String(form.get("role") ?? "");
						if (!isCreditAttributionRoleForUnitType(type, role)) return;
						try {
							await credit.mutateAsync({
								path: { type, unitId: unit.id },
								body: {
									creditedUnitId: creditEntity.id,
									role,
								},
							});
							setCreditEntity(undefined);
							formElement.reset();
						} catch {
							// The typed mutation state supplies the visible API error.
						}
					}}
				>
					<EntityPicker
						ariaLabel={t.units.editor.credit}
						index="entities"
						onChange={setCreditEntity}
						placeholder={t.ui.pickerPlaceholders.entity}
						value={creditEntity}
					/>
					<Field required>
						<FieldLabel>{t.units.editor.creditRole}</FieldLabel>
						<NativeSelect name="role" required>
							{CreditAttributionRolesByUnitType[type].map((role) => (
								<NativeSelectOption key={role} value={role}>
									{t.units.attributionRoles[role]}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Button
						disabled={!creditEntity}
						isLoading={credit.isPending}
						type="submit"
						variant="outline"
					>
						{t.units.editor.credit}
					</Button>
					<RequestFailure error={credit.error} fallback={t.ui.retryLater} />
				</form>

				<form
					className="grid gap-4"
					onSubmit={async (event) => {
						event.preventDefault();
						if (!subjectEntity) return;
						const formElement = event.currentTarget;
						const form = new FormData(formElement);
						const role = String(form.get("role") ?? "");
						if (!isSubjectAssociationRole(role)) return;
						try {
							await subject.mutateAsync({
								path: { type, unitId: unit.id },
								body: {
									entityId: subjectEntity.id,
									...(subjectContextPost
										? { contextPostId: subjectContextPost.id }
										: {}),
									role,
								},
							});
							setSubjectEntity(undefined);
							setSubjectContextPost(undefined);
							formElement.reset();
						} catch {
							// The typed mutation state supplies the visible API error.
						}
					}}
				>
					<EntityPicker
						ariaLabel={t.units.editor.subjectAssociation}
						index="entities"
						onChange={setSubjectEntity}
						placeholder={t.ui.pickerPlaceholders.entity}
						value={subjectEntity}
					/>
					<Field>
						<FieldLabel>{t.units.editor.contextWikiPost}</FieldLabel>
						<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
							<EntityPicker
								ariaLabel={t.units.editor.contextWikiPost}
								index="posts"
								kind="wiki"
								onChange={setSubjectContextPost}
								placeholder={t.ui.pickerPlaceholders.post}
								value={subjectContextPost}
							/>
							{subjectContextPost ? (
								<Button
									onClick={() => setSubjectContextPost(undefined)}
									type="button"
									variant="outline"
								>
									{t.ui.clear}
								</Button>
							) : null}
						</div>
					</Field>
					<Field required>
						<FieldLabel>{t.units.editor.subjectRole}</FieldLabel>
						<NativeSelect name="role" required>
							{SubjectAssociationRoles.map((role) => (
								<NativeSelectOption key={role} value={role}>
									{t.units.subjectAssociationRoles[role]}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Button
						disabled={!subjectEntity}
						isLoading={subject.isPending}
						type="submit"
						variant="outline"
					>
						{t.units.editor.subjectAssociation}
					</Button>
					<RequestFailure error={subject.error} fallback={t.ui.retryLater} />
				</form>

				<form
					className="grid gap-4"
					onSubmit={async (event) => {
						event.preventDefault();
						if (!linkSource) return;
						const formElement = event.currentTarget;
						const form = new FormData(formElement);
						try {
							await link.mutateAsync({
								path: { type, unitId: unit.id },
								body: {
									url: String(form.get("url") ?? "").trim(),
									sourceEntityUnitId: linkSource.id,
								},
							});
							setLinkSource(undefined);
							formElement.reset();
						} catch {
							// The typed mutation state supplies the visible API error.
						}
					}}
				>
					<EntityPicker
						ariaLabel={t.units.editor.link}
						index="entities"
						onChange={setLinkSource}
						placeholder={t.ui.pickerPlaceholders.entity}
						value={linkSource}
					/>
					<Field required>
						<FieldLabel>{t.units.editor.linkUrl}</FieldLabel>
						<Input name="url" required type="url" />
					</Field>
					<Button
						disabled={!linkSource}
						isLoading={link.isPending}
						type="submit"
						variant="outline"
					>
						{t.units.editor.link}
					</Button>
					<RequestFailure error={link.error} fallback={t.ui.retryLater} />
				</form>

				<div className="grid gap-4">
					<p className="text-sm text-muted-foreground">{t.tags.page.manageOnTagPage}</p>
					<Button asChild className="w-fit" variant="outline">
						<Link href={`/units/${type}/${unit.id}/tags`}>{t.tags.page.viewAll}</Link>
					</Button>
				</div>

				{isVariantUnitType(type) ? (
					<div className="grid gap-4">
						<Field>
							<FieldLabel>{t.units.editor.canonicalUnit}</FieldLabel>
							<EntityPicker
								ariaLabel={t.units.editor.canonicalUnit}
								index="units"
								onChange={setCanonicalUnit}
								placeholder={t.ui.pickerPlaceholders.unit}
								value={canonicalUnit}
							/>
						</Field>
						<Button
							disabled={!canonicalUnit || canonicalUnit.id === unit.id}
							isLoading={version.isPending}
							onClick={async () => {
								if (!canonicalUnit || canonicalUnit.id === unit.id) return;
								try {
									await version.mutateAsync({
										path: {
											type,
											unitId: unit.id,
											canonicalId: canonicalUnit.id,
										},
									});
									setCanonicalUnit(undefined);
								} catch {
									// The typed mutation state supplies the visible API error.
								}
							}}
							type="button"
							variant="outline"
						>
							{t.units.editor.version}
						</Button>
						<RequestFailure error={version.error} fallback={t.ui.retryLater} />
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}
