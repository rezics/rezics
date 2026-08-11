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
	usePutApiUnitsByTypeByUnitIdLocalizationsByLanguage,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, type FormEvent } from "react";

import { Badge } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { Textarea } from "@rezics/ui";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { ContentLanguageControl } from "@/features/content-languages/components/content-language-control";
import { LocalizedDraftGate } from "@/features/content-languages/components/localized-draft-gate";
import {
	useContentLanguageEditor,
	useLocalizedDraft,
	type LocalizedDraftCodec,
} from "@/features/content-languages/hooks/use-content-language-editor";
import {
	decodeDraftImageAsset,
	decodeDraftPortableText,
	decodeDraftString,
	isDraftRecord,
} from "@/features/content-languages/model/localized-draft-codec";
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
import { isWorkUnitType, type UnitType } from "./unit-types";
import { UnitContentLicenseField } from "./components/unit-content-license-field";
import { WorkReleaseStatusField } from "./components/work-release-status-field";
import { isWorkReleaseStatus } from "./model/work-release-status";

export type EditableUnit = GetApiUnitsByTypeByUnitIdStatus200;
type Unit = EditableUnit;
type UnitLocalizationDraft = {
	title: string;
	summary: string;
	description: PortableTextValue;
	cover: LocalizationImageAssetValue | null;
};
const UnitLocalizationDraftCodec: LocalizedDraftCodec<UnitLocalizationDraft> = {
	version: 1,
	decode(value) {
		if (!isDraftRecord(value)) return;
		const title = decodeDraftString(value.title);
		const summary = decodeDraftString(value.summary);
		const description = decodeDraftPortableText(value.description);
		const cover = decodeDraftImageAsset(value.cover);
		return title === undefined || summary === undefined || !description || cover === undefined
			? undefined
			: { title, summary, description, cover };
	},
};

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
		const submittedReleaseStatus = form.get("releaseStatus");
		const submittedLicense = form.get("license");
		if (
			submittedLicense !== null &&
			submittedLicense !== "" &&
			!isPublicationLicenseId(submittedLicense)
		)
			return;
		const status =
			submittedStatus === "published" || submittedStatus === "archived" ? submittedStatus : "draft";
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
				if (!isWorkReleaseStatus(submittedReleaseStatus)) return undefined;
				const pageCount = readPositiveInteger(form, "pageCount");
				if (pageCount === undefined) return undefined;
				return {
					releaseStatus: submittedReleaseStatus,
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
				if (!isWorkReleaseStatus(submittedReleaseStatus)) return undefined;
				const runtimeMinutes = readPositiveInteger(form, "runtimeMinutes");
				const episodeCount = readPositiveInteger(form, "episodeCount");
				const seasonCount = readPositiveInteger(form, "seasonCount");
				if (runtimeMinutes === undefined || episodeCount === undefined || seasonCount === undefined)
					return undefined;
				const kind = String(form.get("kind") ?? "").trim();
				if (!kind) return undefined;
				return {
					releaseStatus: submittedReleaseStatus,
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
						<h2 className="font-heading text-xl font-bold">{t.units.editor.settings}</h2>
						<Field>
							<FieldLabel>{t.ui.status}</FieldLabel>
							<NativeSelect name="status" defaultValue={unit.status}>
								<NativeSelectOption value="draft">{t.ui.draft}</NativeSelectOption>
								<NativeSelectOption value="published">{t.ui.published}</NativeSelectOption>
								<NativeSelectOption value="archived">{t.ui.archived}</NativeSelectOption>
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel>{t.ui.visibility}</FieldLabel>
							<NativeSelect name="visibility" defaultValue={unit.visibility}>
								<NativeSelectOption value="public">{t.ui.public}</NativeSelectOption>
								<NativeSelectOption value="unlisted">{t.ui.unlisted}</NativeSelectOption>
								<NativeSelectOption value="private">{t.ui.private}</NativeSelectOption>
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel>{t.ui.contentRating}</FieldLabel>
							<NativeSelect name="contentRating" defaultValue={unit.contentRating}>
								<NativeSelectOption value="general">{t.units.rating.general}</NativeSelectOption>
								<NativeSelectOption value="r15">{t.units.rating.r15}</NativeSelectOption>
								<NativeSelectOption value="r18">{t.units.rating.r18}</NativeSelectOption>
								<NativeSelectOption value="r18g">{t.units.rating.r18g}</NativeSelectOption>
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel>{t.units.detail.aiDisclosure}</FieldLabel>
							<NativeSelect name="aiDisclosure" defaultValue={unit.aiDisclosure}>
								<NativeSelectOption value="unknown">
									{t.units.aiDisclosure.unknown}
								</NativeSelectOption>
								<NativeSelectOption value="none">{t.units.aiDisclosure.none}</NativeSelectOption>
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
								<Input defaultValue={unit.releasedOn ?? ""} name="releasedOn" type="date" />
							</Field>
						) : null}
						<UnitTypeSpecificFields unit={unit} />
						{unit.ownershipMode === "profile_owned" &&
						(unit.details.type === "book" ||
							unit.details.type === "software" ||
							unit.details.type === "media") ? (
							<UnitContentLicenseField
								context="edit"
								grantedSlug={unit.details.contentLicense?.referenceLicenseSlug ?? null}
							/>
						) : null}
						<Field>
							<FieldLabel>{t.units.detail.license}</FieldLabel>
							<NativeSelect defaultValue={unit.license ?? ""} name="license">
								<NativeSelectOption value="">{t.licenses.unspecified}</NativeSelectOption>
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
				<WorkReleaseStatusField defaultValue={details.releaseStatus} />
				<Field>
					<FieldLabel>{t.units.fields.isbn13}</FieldLabel>
					<Input defaultValue={details.isbn13 ?? ""} name="isbn13" pattern="[0-9]{13}" />
				</Field>
				<Field>
					<FieldLabel>{t.units.fields.pageCount}</FieldLabel>
					<Input defaultValue={details.pageCount ?? ""} min={1} name="pageCount" type="number" />
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
				<WorkReleaseStatusField defaultValue={details.releaseStatus} />
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
					<p className="text-sm text-muted-foreground">{t.units.contentLanguages.addDescription}</p>
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
	const { languagesChanged } = useContentLanguageEditor();
	const draft = useLocalizedDraft<UnitLocalizationDraft>({
		scope: "unit-localization",
		baseVersion: localization?.updatedAt ?? null,
		codec: UnitLocalizationDraftCodec,
		createInitialValue: () => ({
			title: localization?.title ?? "",
			summary: localization?.summary ?? "",
			description: readPortableText(localization?.description),
			cover: localization?.cover ?? null,
		}),
	});
	const { value } = draft;
	const deferredTitle = useDeferredValue(value.title);
	const deferredSummary = useDeferredValue(value.summary);
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
					title: value.title.trim(),
					summary: value.summary.trim(),
					description: writePortableText(value.description, localization?.description),
					coverAssetId: value.cover?.id ?? null,
				},
			});
			draft.commit();
			await languagesChanged();
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	const previewKindLabel = isWorkUnitType(type)
		? t.feed.content.kinds[`unit:${type}`]
		: t.units.types[type];
	return (
		<LocalizedDraftGate
			hydrated={draft.hydrated}
			onDiscard={draft.discard}
			serverChanged={draft.serverChanged}
		>
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
									const title = event.currentTarget.value;
									draft.setValue((current) => ({ ...current, title }));
								}}
								required
								value={value.title}
							/>
						</Field>
						<Field>
							<FieldLabel>{t.ui.summary}</FieldLabel>
							<Textarea
								maxLength={2000}
								name="summary"
								onChange={(event) => {
									const summary = event.currentTarget.value;
									draft.setValue((current) => ({ ...current, summary }));
								}}
								value={value.summary}
							/>
						</Field>
						<PortableTextEditor
							label={t.ui.description}
							onChange={(description) => draft.setValue((current) => ({ ...current, description }))}
							value={value.description}
						/>
						<Field>
							<FieldLabel>{t.cover.title}</FieldLabel>
							<LocalizationImageUploadField
								fallback={fallbackCover}
								onChange={(cover) => draft.setValue((current) => ({ ...current, cover }))}
								options={coverOptions}
								role="cover"
								value={value.cover}
							/>
						</Field>
						<div className="flex flex-wrap items-center gap-3">
							<Button
								disabled={!draft.dirty || !value.title.trim()}
								isLoading={update.isPending}
								type="submit"
								variant="solid"
							>
								{t.ui.save}
							</Button>
							{draft.dirty ? (
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
							coverUrl={value.cover?.url ?? fallbackCover?.url}
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
		</LocalizedDraftGate>
	);
}
