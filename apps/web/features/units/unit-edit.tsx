"use client";

import {
	ContentLanguageValues,
	isContentLanguage,
	toContentLanguage,
	type ContentLanguage,
} from "@rezics/i18n";
import { isPublicationLicenseId, PublicationLicenseIds } from "@rezics/license";

import {
	type GetApiUnitsByTypeByUnitIdStatus200,
	usePatchApiUnitsByTypeByUnitId,
	usePostApiUnitsByTypeByUnitIdCreditAttributions,
	usePostApiUnitsByTypeByUnitIdLinks,
	usePostApiUnitsByTypeByUnitIdSubjectAssociations,
	usePutApiUnitsByTypeByUnitIdLocalizationsByLanguage,
	usePutApiUnitsByTypeByUnitIdTagsByTagId,
	usePutApiUnitsByTypeByUnitIdVersionOfByCanonicalId,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { EntityPicker } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { Textarea } from "@rezics/ui";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { readPortableText, writePortableText } from "@/lib/block";
import { invalidateUnitDetail } from "./unit-cache";
import {
	LocalizationImageUploadField,
	type LocalizationImageAssetOption,
	type LocalizationImageAssetValue,
} from "@/features/media/components/localization-image-upload-field";
import { isVariantUnitType, type UnitType } from "./unit-types";

export type EditableUnit = GetApiUnitsByTypeByUnitIdStatus200;
type Unit = EditableUnit;
type SelectedEntity = { id: string; label: string };

function readPositiveInteger(form: FormData, name: string): number | null | undefined {
	const raw = String(form.get(name) ?? "").trim();
	if (!raw) return null;
	const value = Number(raw);
	return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

export function UnitBasicEditor({ type, unit }: { type: UnitType; unit: Unit }) {
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
		const submittedPrimaryLanguage = String(form.get("primaryLanguage") ?? "");
		const primaryLanguage = isContentLanguage(submittedPrimaryLanguage)
			? submittedPrimaryLanguage
			: undefined;
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
		const licensed = form.get("licensed") === "true";
		const details = (() => {
			if (unit.details.type === "book") {
				const pageCount = readPositiveInteger(form, "pageCount");
				if (pageCount === undefined) return undefined;
				return {
					isbn13: String(form.get("isbn13") ?? "").trim() || null,
					publicationDate: releasedOn || null,
					pageCount,
					format: String(form.get("format") ?? "").trim() || null,
					licensed,
				};
			}
			if (unit.details.type === "software")
				return {
					versionLabel: String(form.get("versionLabel") ?? "").trim() || null,
					licensed,
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
				return { kind, runtimeMinutes, episodeCount, seasonCount, licensed };
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
						...(primaryLanguage ? { primaryLanguage } : {}),
						...(unit.details.type === "series"
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
						<Field>
							<FieldLabel>{t.units.detail.primaryLanguage}</FieldLabel>
							<Input
								defaultValue={unit.primaryLanguage ?? ""}
								maxLength={35}
								name="primaryLanguage"
							/>
						</Field>
						{unit.details.type !== "series" && (
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
						)}
						<UnitTypeSpecificFields unit={unit} />
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

function LicensedField({ defaultValue }: { defaultValue: boolean }) {
	const { t } = useTranslation(["units"]);
	return (
		<Field>
			<FieldLabel>{t.units.fields.licensed}</FieldLabel>
			<NativeSelect defaultValue={String(defaultValue)} name="licensed">
				<NativeSelectOption value="false">{t.units.fields.no}</NativeSelectOption>
				<NativeSelectOption value="true">{t.units.fields.yes}</NativeSelectOption>
			</NativeSelect>
		</Field>
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
				<LicensedField defaultValue={details.licensed} />
			</>
		);
	if (details.type === "software")
		return (
			<>
				<Field>
					<FieldLabel>{t.units.fields.versionLabel}</FieldLabel>
					<Input defaultValue={details.versionLabel ?? ""} name="versionLabel" />
				</Field>
				<LicensedField defaultValue={details.licensed} />
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
				<LicensedField defaultValue={details.licensed} />
			</>
		);
	return (
		<Field required>
			<FieldLabel>{t.units.series.kind}</FieldLabel>
			<Input defaultValue={details.kind} maxLength={64} name="kind" required />
		</Field>
	);
}

export function UnitLocalizationEditor({ type, unit }: { type: UnitType; unit: Unit }) {
	const { t, locale } = useTranslation(["cover", "errors", "ui", "units"]);
	const [language, setLanguage] = useState<ContentLanguage>(toContentLanguage(locale.target));
	const selected = unit.localizations.find((entry) => entry.language === language);
	return (
		<Card>
			<CardContent className="grid gap-6 p-6">
				<h2 className="font-heading text-xl font-bold">{t.units.editor.localization}</h2>
				<div className="grid gap-4 sm:grid-cols-2">
					<Field>
						<FieldLabel>{t.units.editor.selectLocalization}</FieldLabel>
						<NativeSelect
							value={language}
							onChange={(event) => {
								const value = event.currentTarget.value;
								if (isContentLanguage(value)) setLanguage(value);
							}}
						>
							{ContentLanguageValues.map((value) => (
								<NativeSelectOption key={value} value={value}>
									{value}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
				</div>
				<UnitLocalizationForm
					key={`${unit.id}:${language}:${selected?.updatedAt ?? "new"}`}
					language={language}
					localization={selected}
					type={type}
					unit={unit}
				/>
			</CardContent>
		</Card>
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
	const { t } = useTranslation(["cover", "errors", "ui", "units"]);
	const queryClient = useQueryClient();
	const [description, setDescription] = useState<PortableTextValue>(() =>
		readPortableText(localization?.description),
	);
	const [cover, setCover] = useState<LocalizationImageAssetValue | null>(
		localization?.cover ?? null,
	);
	const coverOptions: LocalizationImageAssetOption[] = unit.localizations.flatMap((entry) =>
		entry.language !== language && entry.cover
			? [{ ...entry.cover, label: entry.language }]
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
		const form = new FormData(event.currentTarget);
		try {
			await update.mutateAsync({
				path: { type, unitId: unit.id, language },
				body: {
					title: String(form.get("title") ?? "").trim(),
					summary: String(form.get("summary") ?? "").trim(),
					description: writePortableText(description, localization?.description),
					coverAssetId: cover?.id ?? null,
				},
			});
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	return (
		<form onSubmit={submit}>
			<FieldGroup>
				<Field required>
					<FieldLabel>{t.ui.title}</FieldLabel>
					<Input
						defaultValue={localization?.title ?? ""}
						maxLength={500}
						name="title"
						required
					/>
				</Field>
				<Field>
					<FieldLabel>{t.ui.summary}</FieldLabel>
					<Textarea
						defaultValue={localization?.summary ?? ""}
						maxLength={2000}
						name="summary"
					/>
				</Field>
				<PortableTextEditor
					label={t.ui.body}
					onChange={setDescription}
					value={description}
				/>
				<Field>
					<FieldLabel>{t.cover.title}</FieldLabel>
					<LocalizationImageUploadField
						fallback={fallbackCover}
						onChange={setCover}
						options={coverOptions}
						role="cover"
						shape={type === "book" ? "portrait" : "landscape"}
						value={cover}
					/>
				</Field>
				<Button variant="solid" isLoading={update.isPending} type="submit">
					{t.ui.save}
				</Button>
				<RequestFailure error={update.error} fallback={t.ui.retryLater} />
			</FieldGroup>
		</form>
	);
}

export function UnitRelationships({ type, unit }: { type: UnitType; unit: Unit }) {
	const { t } = useTranslation(["cover", "errors", "ui", "units"]);
	const queryClient = useQueryClient();
	const invalidate = () => invalidateUnitDetail(queryClient, type, unit.id);
	const credit = usePostApiUnitsByTypeByUnitIdCreditAttributions({
		mutation: { onSuccess: invalidate },
	});
	const subject = usePostApiUnitsByTypeByUnitIdSubjectAssociations({
		mutation: { onSuccess: invalidate },
	});
	const link = usePostApiUnitsByTypeByUnitIdLinks({ mutation: { onSuccess: invalidate } });
	const tag = usePutApiUnitsByTypeByUnitIdTagsByTagId({ mutation: { onSuccess: invalidate } });
	const version = usePutApiUnitsByTypeByUnitIdVersionOfByCanonicalId({
		mutation: { onSuccess: invalidate },
	});
	const [creditEntity, setCreditEntity] = useState<SelectedEntity>();
	const [subjectEntity, setSubjectEntity] = useState<SelectedEntity>();
	const [linkSource, setLinkSource] = useState<SelectedEntity>();
	const [selectedTag, setSelectedTag] = useState<SelectedEntity>();
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
						try {
							await credit.mutateAsync({
								path: { type, unitId: unit.id },
								body: {
									creditedUnitId: creditEntity.id,
									role: String(form.get("role") ?? "").trim(),
								},
							});
							setCreditEntity(undefined);
							formElement.reset();
						} catch {
							// The typed mutation state supplies the visible API error.
						}
					}}
				>
					<EntityPicker index="entity" onChange={setCreditEntity} value={creditEntity} />
					<Field required>
						<FieldLabel>{t.units.editor.creditRole}</FieldLabel>
						<Input maxLength={64} name="role" required />
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
						try {
							await subject.mutateAsync({
								path: { type, unitId: unit.id },
								body: {
									entityId: subjectEntity.id,
									role: String(form.get("role") ?? "").trim(),
								},
							});
							setSubjectEntity(undefined);
							formElement.reset();
						} catch {
							// The typed mutation state supplies the visible API error.
						}
					}}
				>
					<EntityPicker
						index="entity"
						onChange={setSubjectEntity}
						value={subjectEntity}
					/>
					<Field required>
						<FieldLabel>{t.units.editor.subjectRole}</FieldLabel>
						<Input maxLength={64} name="role" required />
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
						const role = String(form.get("role") ?? "").trim();
						const fallbackText = String(form.get("fallbackText") ?? "").trim();
						try {
							await link.mutateAsync({
								path: { type, unitId: unit.id },
								body: {
									url: String(form.get("url") ?? "").trim(),
									sourceEntityUnitId: linkSource.id,
									...(role ? { role } : {}),
									...(fallbackText ? { fallbackText } : {}),
								},
							});
							setLinkSource(undefined);
							formElement.reset();
						} catch {
							// The typed mutation state supplies the visible API error.
						}
					}}
				>
					<EntityPicker index="entity" onChange={setLinkSource} value={linkSource} />
					<Field required>
						<FieldLabel>{t.units.editor.linkUrl}</FieldLabel>
						<Input name="url" required type="url" />
					</Field>
					<Field>
						<FieldLabel>{t.units.editor.linkRole}</FieldLabel>
						<Input maxLength={32} name="role" />
					</Field>
					<Field>
						<FieldLabel>{t.units.editor.linkLabel}</FieldLabel>
						<Input name="fallbackText" />
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
					<EntityPicker index="tags" onChange={setSelectedTag} value={selectedTag} />
					<Button
						disabled={!selectedTag}
						isLoading={tag.isPending}
						onClick={async () => {
							if (!selectedTag) return;
							try {
								await tag.mutateAsync({
									path: {
										type,
										unitId: unit.id,
										tagId: selectedTag.id,
									},
									body: {},
								});
								setSelectedTag(undefined);
							} catch {
								// The typed mutation state supplies the visible API error.
							}
						}}
						type="button"
						variant="outline"
					>
						{t.units.editor.tag}
					</Button>
					<RequestFailure error={tag.error} fallback={t.ui.retryLater} />
				</div>

				{isVariantUnitType(type) ? (
					<div className="grid gap-4">
						<Field>
							<FieldLabel>{t.units.editor.canonicalUnit}</FieldLabel>
							<EntityPicker
								index="units"
								onChange={setCanonicalUnit}
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
