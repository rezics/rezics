"use client";

import type { ContentLanguage } from "@rezics/i18n";
import { isLicenseId } from "@rezics/license";

import {
	type GetApiUnitsByTypeByUnitIdStatus200,
	usePatchApiUnitsByTypeByUnitId,
	usePutApiUnitsByTypeByUnitIdLocalizationsByLanguage,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useState, type FormEvent } from "react";

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
import { UnitLicensesField } from "./components/unit-licenses-field";
import { readSubmittedLicenses } from "./model/unit-licenses";
import { adaptedAudioUnitIdsChanged } from "./model/adapted-audio";
import { FeedUnitContent } from "@/features/content-feed/components/feed-unit-content";
import type { UnitType } from "./unit-types";

import { ContentLanguageSupportField } from "@/features/content-language-support/components/content-language-support-field";
import { ContentLanguageSupportEvidence } from "@/features/content-language-support/components/content-language-support-evidence";
import {
	adoptContentLanguageEvidence,
	contentLanguageSupportChanged,
	createContentLanguageSupportDraft,
} from "@/features/content-language-support/model/content-language-support";
import { AdaptedAudioField } from "./components/adapted-audio-field";

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
	const { t } = useTranslation(["create", "ui", "units"]),
		cache = useQueryClient();
	const [languages, setLanguages] = useState(() =>
		createContentLanguageSupportDraft(unit.contentLanguageSupport),
	);
	const [tracks, setTracks] = useState<readonly string[]>(() =>
		unit.details.type === "video" ? (unit.details.adaptedAudioUnitIds ?? []) : [],
	);
	const [invalidDuration, setInvalidDuration] = useState(false);
	const update = usePatchApiUnitsByTypeByUnitId({
		mutation: { onSuccess: () => invalidateUnitDetail(cache, type, unit.id, true) },
	});
	const licenses = unit.licenseOfferings.map((grant) => grant.licenseId).filter(isLicenseId);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (update.isPending) return;
		const form = new FormData(event.currentTarget),
			duration = readPositiveInteger(form, "durationSeconds");
		if (duration === undefined || (duration !== null && duration > 2147483647)) {
			setInvalidDuration(true);
			return;
		}
		setInvalidDuration(false);
		const submittedStatus = form.get("status"),
			submittedVisibility = form.get("visibility"),
			submittedRating = form.get("contentRating"),
			submittedAi = form.get("aiDisclosure");
		const status =
				submittedStatus === "published" || submittedStatus === "archived"
					? submittedStatus
					: "draft",
			visibility =
				submittedVisibility === "public" || submittedVisibility === "unlisted"
					? submittedVisibility
					: "private",
			contentRating =
				submittedRating === "r15" || submittedRating === "r18" || submittedRating === "r18g"
					? submittedRating
					: "general",
			aiDisclosure =
				submittedAi === "none" ||
				submittedAi === "ai_assisted" ||
				submittedAi === "ai_originated" ||
				submittedAi === "machine_generated"
					? submittedAi
					: "unknown";
		await update
			.mutateAsync({
				path: { type, unitId: unit.id },
				body: {
					updatedAt: unit.updatedAt,
					status,
					visibility,
					contentRating,
					aiDisclosure,
					licenses: readSubmittedLicenses(form),
					...(contentLanguageSupportChanged(unit.contentLanguageSupport, languages)
						? {
								contentLanguageSupport: languages.map((entry) => ({
									languageTag: entry.languageTag,
									...(entry.channels ? { channels: [...entry.channels] } : {}),
								})),
							}
						: {}),
					details: {
						durationSeconds: duration,
						...(type === "video" &&
						unit.details.type === "video" &&
						adaptedAudioUnitIdsChanged(unit.details.adaptedAudioUnitIds ?? [], tracks)
							? { adaptedAudioUnitIds: tracks.length ? [...tracks] : null }
							: {}),
					},
				},
			})
			.catch(() => undefined);
	}
	return (
		<Card appearance="outlined">
			<CardContent className="p-6">
				<form onSubmit={(event) => void submit(event)}>
					<FieldGroup>
						<h2 className="font-heading text-xl font-bold">{t.units.editor.settings}</h2>
						<Field>
							<FieldLabel>{t.ui.status}</FieldLabel>
							<NativeSelect name="status" defaultValue={unit.status}>
								{(["draft", "published", "archived"] as const).map((value) => (
									<NativeSelectOption key={value} value={value}>
										{t.ui[value]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel>{t.ui.visibility}</FieldLabel>
							<NativeSelect name="visibility" defaultValue={unit.visibility}>
								{(["private", "unlisted", "public"] as const).map((value) => (
									<NativeSelectOption key={value} value={value}>
										{t.ui[value]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel>{t.ui.contentRating}</FieldLabel>
							<NativeSelect name="contentRating" defaultValue={unit.contentRating}>
								{(["general", "r15", "r18", "r18g"] as const).map((value) => (
									<NativeSelectOption key={value} value={value}>
										{t.units.rating[value]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel>{t.units.detail.aiDisclosure}</FieldLabel>
							<NativeSelect name="aiDisclosure" defaultValue={unit.aiDisclosure}>
								{(
									["unknown", "none", "ai_assisted", "ai_originated", "machine_generated"] as const
								).map((value) => (
									<NativeSelectOption key={value} value={value}>
										{t.units.aiDisclosure[value]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						<Field invalid={invalidDuration}>
							<FieldLabel>{t.units.fields.durationSeconds}</FieldLabel>
							<Input
								name="durationSeconds"
								type="number"
								min={1}
								max={2147483647}
								step={1}
								defaultValue={unit.details.durationSeconds ?? ""}
							/>
							{invalidDuration ? (
								<p role="alert" className="text-destructive text-sm">
									{t.create.native.errors.number}
								</p>
							) : null}
						</Field>
						{type === "video" ? <AdaptedAudioField value={tracks} onChange={setTracks} /> : null}
						<ContentLanguageSupportField
							value={languages}
							onChange={setLanguages}
							disabled={update.isPending}
						/>
						<ContentLanguageSupportEvidence
							type={type}
							unitId={unit.id}
							onAdopt={(value) =>
								setLanguages((current) => adoptContentLanguageEvidence(current, value))
							}
						/>
						<UnitLicensesField defaultValue={licenses} />
						<Button type="submit" isLoading={update.isPending} disabled={update.isPending}>
							{t.units.editor.saveSettings}
						</Button>
						<RequestFailure error={update.error} />
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
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
	const previewKindLabel = t.units.types[type];
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
