"use client";
import { useState, useId, type FormEvent } from "react";
import type { CatalogOwner } from "@rezics/reference";
import {
	useCreateCatalogResource,
	listCurrentUserStudioContentQueryKey,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import {
	Button,
	EntityPicker,
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	Input,
	NativeSelect,
	NativeSelectOption,
	PageHeading,
	Textarea,
	Checkbox,
} from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { AppLink } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { ContentLanguageEditorTagValues } from "@/features/content-language-support/model/content-language-support";
import { formatContentLanguageName } from "@/features/content-language-support/model/content-language-presentation";
import {
	buildNativeCreateRequest,
	createNativeCreateDraft,
	isNativeCreateKind,
	nativeCreateSelection,
	NativeCreateKindsByOwner,
	NativeCreateOwnerByKind,
	NativeCreateShapeByKind,
	NativeProgramShapes,
	NativeEntityShapes,
	NativeReferenceShapes,
	NativeVersionKinds,
	NativeDevelopmentStates,
	NativeTruthValues,
	type NativeCreateDraft,
	type NativeCreateField,
	type NativeCreateReferenceField,
	type NativeCreateResult,
} from "../model/native-create";
import {
	communityUnitSearchHref,
	nativeCommunityUnitSearchSubject,
} from "../model/community-unit-search";

function ChoiceField<Value extends string>({
	label,
	value,
	options,
	onChange,
}: {
	readonly label: string;
	readonly value: Value;
	readonly options: readonly { value: Value; label: string }[];
	readonly onChange: (value: Value) => void;
}) {
	const id = useId();
	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<NativeSelect
				id={id}
				value={value}
				onChange={(event) => {
					const selected = options.find((option) => option.value === event.target.value);
					if (selected) onChange(selected.value);
				}}
			>
				{options.map((option) => (
					<NativeSelectOption key={option.value} value={option.value}>
						{option.label}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}
function TextField({
	field,
	label,
	value,
	onChange,
	required = false,
	multiline = false,
	numeric = false,
	integer = true,
	maxLength = 4096,
	list,
	invalid = false,
}: {
	readonly field: NativeCreateField;
	readonly label: string;
	readonly value: string;
	readonly onChange: (field: NativeCreateField, value: string) => void;
	readonly required?: boolean;
	readonly multiline?: boolean;
	readonly numeric?: boolean;
	readonly integer?: boolean;
	readonly maxLength?: number;
	readonly list?: string;
	readonly invalid?: boolean;
}) {
	const id = useId();
	return (
		<Field required={required} invalid={invalid}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			{multiline ? (
				<Textarea
					id={id}
					value={value}
					required={required}
					maxLength={maxLength}
					onChange={(event) => onChange(field, event.target.value)}
				/>
			) : (
				<Input
					id={id}
					value={value}
					required={required}
					maxLength={maxLength}
					list={list}
					type={numeric ? "number" : field === "url" ? "url" : "text"}
					step={numeric ? (integer ? 1 : "any") : undefined}
					onChange={(event) => onChange(field, event.target.value)}
				/>
			)}
		</Field>
	);
}

export function NativeCatalogCreatePage({
	owner,
	initialKind,
	initialName = "",
	initialShape,
}: {
	readonly owner: CatalogOwner;
	readonly initialKind?: string;
	readonly initialName?: string;
	readonly initialShape?: string;
}) {
	const { t, locale } = useTranslation(["actions", "create", "ui"]),
		copy = t.create.native;
	const router = useApplicationRouter(),
		cache = useQueryClient();
	const [draft, setDraft] = useState<NativeCreateDraft>(() => {
		const kind =
			initialKind &&
			isNativeCreateKind(initialKind) &&
			NativeCreateOwnerByKind[initialKind] === owner
				? initialKind
				: (NativeCreateKindsByOwner[owner].find(
						(kind) => NativeCreateShapeByKind[kind] === initialShape,
					) ?? NativeCreateKindsByOwner[owner][0]);
		const value = createNativeCreateDraft(kind, initialName);
		const entityShape = NativeEntityShapes.find((shape) => shape === initialShape),
			programShape = NativeProgramShapes.find((shape) => shape === initialShape),
			referenceShape = NativeReferenceShapes.find((shape) => shape === initialShape);
		return {
			...value,
			...(entityShape ? { entityShape } : {}),
			...(programShape ? { programShape } : {}),
			...(referenceShape ? { referenceShape } : {}),
		};
	});
	const [failure, setFailure] = useState<Extract<NativeCreateResult, { ok: false }>>();
	const mutation = useCreateCatalogResource({
		mutation: {
			onSuccess: async (created) => {
				await cache.invalidateQueries({ queryKey: listCurrentUserStudioContentQueryKey() });
				router.push(`/catalog/${created.reference.owner}/${created.reference.id}`);
			},
		},
	});
	const datalistId = useId();
	const visualNovelId = useId();
	function change(field: NativeCreateField, value: string) {
		setDraft((current) => ({ ...current, fields: { ...current.fields, [field]: value } }));
		setFailure(undefined);
	}
	const field = (
		key: NativeCreateField,
		options: {
			required?: boolean;
			multiline?: boolean;
			numeric?: boolean;
			integer?: boolean;
			maxLength?: number;
			label?: string;
		} = {},
	) => (
		<TextField
			{...options}
			field={key}
			label={options.label ?? copy.fields[key]}
			value={draft.fields[key]}
			onChange={change}
			invalid={failure?.field === key}
			list={key.endsWith("Language") ? datalistId : undefined}
		/>
	);
	const reference = (
		key: NativeCreateReferenceField,
		referenceOwner: CatalogOwner,
		shape: string,
		required = false,
	) => {
		const value = draft.references[key];
		return (
			<Field required={required} invalid={failure?.field === key}>
				<FieldLabel>{copy.references[key]}</FieldLabel>
				<EntityPicker
					index="units"
					owners={[referenceOwner]}
					shapes={[shape]}
					ariaLabel={copy.references[key]}
					placeholder={copy.findReference}
					value={
						value
							? {
									id: value.reference.id,
									label: value.label,
									owner: value.reference.owner,
									shape: value.shape,
								}
							: undefined
					}
					onChange={(value) => {
						const selected = nativeCreateSelection(value, referenceOwner, [shape]);
						setDraft((current) => ({
							...current,
							references: { ...current.references, [key]: selected },
						}));
						setFailure(selected ? undefined : { ok: false, code: "reference", field: key });
					}}
					onClear={() => {
						setDraft((current) => ({
							...current,
							references: { ...current.references, [key]: undefined },
						}));
						setFailure(undefined);
					}}
				/>
			</Field>
		);
	};
	const dateFields = (
		<div className="grid gap-4 sm:grid-cols-3">
			{field("year", { numeric: true })}
			{field("month", { numeric: true })}
			{field("day", { numeric: true })}
			<div className="sm:col-span-3">{field("dateText")}</div>
		</div>
	);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (mutation.isPending) return;
		const value = buildNativeCreateRequest(draft);
		if (!value.ok) {
			setFailure(value);
			return;
		}
		setFailure(undefined);
		await mutation.mutateAsync({ body: value.body }).catch(() => undefined);
	}
	const shape =
		draft.kind === "program"
			? draft.programShape
			: draft.kind === "entity"
				? draft.entityShape
				: draft.kind === "reference"
					? draft.referenceShape
					: NativeCreateShapeByKind[draft.kind];
	return (
		<RequireSession>
			<main className="mx-auto grid w-full max-w-2xl gap-6 px-4 py-8">
				<PageHeading title={copy.title} />
				<p className="text-muted-foreground text-sm">{copy.privateDraft}</p>
				<form onSubmit={(event) => void submit(event)}>
					<FieldGroup>
						<ChoiceField
							label={copy.kind}
							value={draft.kind}
							options={NativeCreateKindsByOwner[owner].map((kind) => ({
								value: kind,
								label: copy.kinds[kind],
							}))}
							onChange={(kind) => {
								setDraft((current) => ({
									...createNativeCreateDraft(kind, current.fields.name),
									fields: {
										...createNativeCreateDraft(kind).fields,
										name: current.fields.name,
										nameLanguage: current.fields.nameLanguage,
									},
								}));
								setFailure(undefined);
								mutation.reset();
							}}
						/>
						{field("name", { required: true, maxLength: 500 })}
						<AppLink
							href={communityUnitSearchHref(
								nativeCommunityUnitSearchSubject(owner, shape),
								draft.fields.name,
							)}
							className="w-fit text-sm text-link hover:underline"
						>
							{copy.searchExisting}
						</AppLink>
						{field("nameLanguage", { maxLength: 255 })}
						<FieldDescription>{copy.unknownLanguage}</FieldDescription>
						<datalist id={datalistId}>
							{ContentLanguageEditorTagValues.map((tag) => (
								<option
									key={tag}
									value={tag}
									label={formatContentLanguageName(locale.target, tag)}
								/>
							))}
						</datalist>
						{draft.kind === "text_version" ? field("textLanguage", { maxLength: 255 }) : null}
						{draft.kind === "publication" ? (
							<>
								{field("pageCount", { numeric: true })}
								{field("paginationText")}
							</>
						) : null}
						{draft.kind === "serialization"
							? reference("textVersion", "publishing", "text_version")
							: null}
						{draft.kind === "recording" ? (
							<>
								{field("duration", { numeric: true })}
								<ChoiceField
									label={copy.videoRecording}
									value={draft.recordingVideo}
									options={NativeTruthValues.map((value) => ({ value, label: copy.truth[value] }))}
									onChange={(recordingVideo) =>
										setDraft((current) => ({ ...current, recordingVideo }))
									}
								/>
							</>
						) : null}
						{draft.kind === "music_release" ? (
							<>
								{reference("releaseGroup", "music", "release_group")}
								{field("textLanguage", { maxLength: 255, label: copy.releaseTextLanguage })}
							</>
						) : null}
						{draft.kind === "software_content" ? (
							<>
								{field("originalLanguage", { maxLength: 255 })}
								<ChoiceField
									label={copy.development}
									value={draft.development}
									options={NativeDevelopmentStates.map((value) => ({
										value,
										label: copy.developmentStates[value],
									}))}
									onChange={(development) => setDraft((current) => ({ ...current, development }))}
								/>
								<Field orientation="horizontal">
									<Checkbox
										ids={{ hiddenInput: visualNovelId }}
										checked={draft.visualNovel}
										onCheckedChange={({ checked }) =>
											setDraft((current) => ({ ...current, visualNovel: checked === true }))
										}
										aria-label={copy.visualNovel}
									/>
									<FieldLabel htmlFor={visualNovelId}>{copy.visualNovel}</FieldLabel>
								</Field>
								{field("description", { multiline: true, maxLength: 16384 })}
							</>
						) : null}
						{draft.kind === "software_version" ? (
							<>
								{reference("content", "software", "content", true)}
								<ChoiceField
									label={copy.versionKind}
									value={draft.versionKind}
									options={NativeVersionKinds.map((value) => ({
										value,
										label: copy.versionKinds[value],
									}))}
									onChange={(versionKind) => setDraft((current) => ({ ...current, versionKind }))}
								/>
								{field("versionLabel")}
								{field("textLanguage", { maxLength: 255, label: copy.versionLanguage })}
								{field("evidence", { required: true, multiline: true, maxLength: 16384 })}
							</>
						) : null}
						{draft.kind === "software_release" ? (
							<>
								{dateFields}
								{field("description", { multiline: true, maxLength: 16384 })}
							</>
						) : null}
						{draft.kind === "entity" ? (
							<>
								<ChoiceField
									label={copy.shape}
									value={draft.entityShape}
									options={NativeEntityShapes.map((value) => ({
										value,
										label: copy.entityShapes[value],
									}))}
									onChange={(entityShape) => setDraft((current) => ({ ...current, entityShape }))}
								/>
								<FieldDescription>{copy.entityScope}</FieldDescription>
								{reference("area", "reference", "area")}
							</>
						) : null}
						{draft.kind === "program" ? (
							<>
								<ChoiceField
									label={copy.shape}
									value={draft.programShape}
									options={NativeProgramShapes.map((value) => ({
										value,
										label: copy.programShapes[value],
									}))}
									onChange={(programShape) => setDraft((current) => ({ ...current, programShape }))}
								/>
								{draft.programShape === "program" ? (
									<>
										{field("mainEpisodes", { numeric: true })}
										{field("totalEpisodes", { numeric: true })}
									</>
								) : (
									reference("program", "program", "program")
								)}
								{draft.programShape === "season" ? field("number") : null}
								{draft.programShape === "program_version" || draft.programShape === "episode"
									? field("duration", { numeric: true })
									: null}
								{draft.programShape === "episode" ? (
									<>
										{reference("season", "program", "season")}
										{field("episodeNumber", { numeric: true, integer: false })}
										{dateFields}
									</>
								) : null}
							</>
						) : null}
						{draft.kind === "reference" ? (
							<>
								<ChoiceField
									label={copy.shape}
									value={draft.referenceShape}
									options={NativeReferenceShapes.map((value) => ({
										value,
										label: copy.referenceShapes[value],
									}))}
									onChange={(referenceShape) =>
										setDraft((current) => ({ ...current, referenceShape }))
									}
								/>
								{draft.referenceShape === "web_resource"
									? field("url", { required: true, maxLength: 8192 })
									: null}
								{draft.referenceShape === "place" ? (
									<>
										{reference("area", "reference", "area")}
										{field("address")}
										<div className="grid gap-4 sm:grid-cols-2">
											{field("latitude", { numeric: true, integer: false })}
											{field("longitude", { numeric: true, integer: false })}
										</div>
									</>
								) : null}
								{draft.referenceShape === "event" ? (
									<>
										{reference("place", "reference", "place")}
										{dateFields}
										{field("localTime")}
										{field("setlist", { multiline: true, maxLength: 16000 })}
									</>
								) : null}
							</>
						) : null}
						{failure ? (
							<p className="text-sm text-destructive" role="alert">
								{copy.errors[failure.code]}
							</p>
						) : null}
						<RequestFailure error={mutation.error} />
						<Button type="submit" isLoading={mutation.isPending} disabled={mutation.isPending}>
							{t.actions.create}
						</Button>
					</FieldGroup>
				</form>
			</main>
		</RequireSession>
	);
}
