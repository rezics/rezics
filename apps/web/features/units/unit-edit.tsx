"use client";

import {
	type GetApiUnitsByTypeByUnitIdStatus200,
	useGetApiUnitsByTypeByUnitId,
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
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { EntityPicker } from "@rezics/ui";
import { PageHeading } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { Textarea } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { readPortableText, writePortableText } from "@/lib/block";
import { invalidateUnitDetail } from "./unit-cache";
import {
	LocalizationImageUploadField,
	type LocalizationImageAssetOption,
	type LocalizationImageAssetValue,
} from "./localization-image-upload-field";
import type { UnitType } from "./unit-types";

type Unit = GetApiUnitsByTypeByUnitIdStatus200;
type SelectedEntity = { id: string; label: string };

export function UnitEditWorkspace({ type, id }: { type: UnitType; id: string }) {
	return (
		<RequireSession>
			<UnitEditWorkspaceContent id={id} type={type} />
		</RequireSession>
	);
}

function UnitEditWorkspaceContent({ type, id }: { type: UnitType; id: string }) {
	const query = useGetApiUnitsByTypeByUnitId({ path: { type, unitId: id } });
	const { t } = useTranslation({ suspense: true });
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data) return <QueryPending />;
	if (!query.data.capabilities.canEdit)
		return (
			<main className="mx-auto grid min-h-64 w-full max-w-4xl place-items-center px-4 py-10">
				<p className="text-destructive text-sm">{t.errors.forbidden}</p>
			</main>
		);
	return <UnitEditForm type={type} unit={query.data} />;
}

function UnitEditForm({ type, unit }: { type: UnitType; unit: Unit }) {
	const { t } = useTranslation({ suspense: true });
	const queryClient = useQueryClient();
	const router = useRouter();
	const update = usePatchApiUnitsByTypeByUnitId({
		mutation: {
			onSuccess: async () => invalidateUnitDetail(queryClient, type, unit.id, true),
		},
	});

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const primaryLanguage = String(form.get("primaryLanguage") ?? "").trim();
		const releasedOn = String(form.get("releasedOn") ?? "").trim();
		const submittedStatus = form.get("status");
		const submittedVisibility = form.get("visibility");
		const submittedContentRating = form.get("contentRating");
		const submittedAiDisclosure = form.get("aiDisclosure");
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
		try {
			await update.mutateAsync({
				path: { type, unitId: unit.id },
				body: {
					updatedAt: unit.updatedAt,
					status,
					visibility,
					contentRating,
					aiDisclosure,
					license: String(form.get("license") ?? "").trim() || null,
					unit: {
						...(primaryLanguage ? { primaryLanguage } : {}),
						releasedOn: releasedOn || null,
					},
				},
			});
			router.push(`/units/${type}/${unit.id}`);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading title={t.units.editor.title} />
			<Card>
				<CardContent className="p-6">
					<form onSubmit={submit}>
						<FieldGroup>
							<h2 className="font-heading text-xl font-bold">
								{t.units.editor.settings}
							</h2>
							<Field>
								<FieldLabel>{t.ui.status}</FieldLabel>
								<NativeSelect name="status" defaultValue={unit.status}>
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
								<NativeSelect
									name="contentRating"
									defaultValue={unit.contentRating}
								>
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
							<Field>
								<FieldLabel>{t.units.detail.releasedOn}</FieldLabel>
								<Input
									defaultValue={unit.releasedOn ?? ""}
									name="releasedOn"
									type="date"
								/>
							</Field>
							<Field>
								<FieldLabel>{t.units.detail.license}</FieldLabel>
								<Input defaultValue={unit.license ?? ""} name="license" />
							</Field>
							<Button isLoading={update.isPending} type="submit">
								{t.units.editor.saveSettings}
							</Button>
							<RequestFailure error={update.error} fallback={t.ui.retryLater} />
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
			<UnitLocalizationEditor type={type} unit={unit} />
			<UnitRelationships type={type} unit={unit} />
		</main>
	);
}

function UnitLocalizationEditor({ type, unit }: { type: UnitType; unit: Unit }) {
	const { t, locale } = useTranslation({ suspense: true });
	const [language, setLanguage] = useState<string>(locale.target);
	const [enteredLanguage, setEnteredLanguage] = useState<string>(locale.target);
	const Languages = Array.from(
		new Set([...unit.localizations.map((entry) => entry.language), locale.target, language]),
	);
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
								setLanguage(event.currentTarget.value);
								setEnteredLanguage(event.currentTarget.value);
							}}
						>
							{Languages.map((value) => (
								<NativeSelectOption key={value} value={value}>
									{value}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel>{t.units.editor.languageCode}</FieldLabel>
						<div className="flex gap-2">
							<Input
								maxLength={35}
								onChange={(event) => setEnteredLanguage(event.currentTarget.value)}
								value={enteredLanguage}
							/>
							<Button
								disabled={!enteredLanguage.trim()}
								onClick={() => setLanguage(enteredLanguage.trim())}
								type="button"
								variant="outline"
							>
								{t.units.editor.useLanguage}
							</Button>
						</div>
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
	language: string;
	localization: Unit["localizations"][number] | undefined;
}) {
	const { t } = useTranslation({ suspense: true });
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
				<Button isLoading={update.isPending} type="submit">
					{t.ui.save}
				</Button>
				<RequestFailure error={update.error} fallback={t.ui.retryLater} />
			</FieldGroup>
		</form>
	);
}

function UnitRelationships({ type, unit }: { type: UnitType; unit: Unit }) {
	const { t } = useTranslation({ suspense: true });
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
						const form = new FormData(event.currentTarget);
						try {
							await credit.mutateAsync({
								path: { type, unitId: unit.id },
								body: {
									entityId: creditEntity.id,
									role: String(form.get("role") ?? "").trim(),
								},
							});
							setCreditEntity(undefined);
							event.currentTarget.reset();
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
						const form = new FormData(event.currentTarget);
						try {
							await subject.mutateAsync({
								path: { type, unitId: unit.id },
								body: {
									entityId: subjectEntity.id,
									role: String(form.get("role") ?? "").trim(),
								},
							});
							setSubjectEntity(undefined);
							event.currentTarget.reset();
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
						const form = new FormData(event.currentTarget);
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
							event.currentTarget.reset();
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
			</CardContent>
		</Card>
	);
}
