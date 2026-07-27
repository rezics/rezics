"use client";

import {
	ContentLanguageValues,
	isContentLanguage,
	toContentLanguage,
	type ContentLanguage,
} from "@rezics/i18n";

import {
	getApiRealmsByRealmIdUnitsByUnitIdHistoryQueryKey,
	getApiRealmsByRealmIdUnitsQueryKey,
	useGetApiRealmsByRealmIdUnits,
	useGetApiRealmsByRealmIdUnitsByUnitIdHistory,
	usePatchApiRealmsByRealmIdUnitsByUnitId,
	type GetApiRealmsByRealmIdUnitsByUnitIdHistoryStatus200,
	type GetApiRealmsByRealmIdUnitsStatus200,
	type PatchApiRealmsByRealmIdUnitsByUnitIdBody,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import {
	Button,
	Card,
	CardContent,
	Checkbox,
	Field,
	FieldLabel,
	NativeSelect,
	NativeSelectOption,
	PortableTextContent,
	Skeleton,
} from "@rezics/ui";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { invalidatePostQueries } from "@/features/posts/query";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";
import { readPortableText, writePortableText } from "@/lib/block";
import {
	GovernanceReasonCodes,
	getRealmModerationCommands,
	hasAuthoredAnnotation,
	RealmModerationStatuses,
	toGovernanceReasonCode,
	toRealmModerationCommand,
	toRealmModerationStatus,
	type RealmModerationCommand,
	type RealmModerationStatus,
} from "./moderation-contract";

const RealmModerationListQuery = { limit: 100 } as const;
const RealmModerationHistoryQuery = { limit: 100 } as const;

type RealmModerationUnit = GetApiRealmsByRealmIdUnitsStatus200["items"][number];
type RealmModerationHistoryAction =
	GetApiRealmsByRealmIdUnitsByUnitIdHistoryStatus200["items"][number];
type ModerationAnnotationRole = "internal_note" | "public_notice";

export function RealmModeration({
	realmId,
	embedded = false,
}: {
	realmId: string;
	embedded?: boolean;
}) {
	const { t } = useTranslation(["posts", "realms", "state"]);
	const localizationLanguages = useLocalizationLanguages();
	const units = useGetApiRealmsByRealmIdUnits({
		path: { realmId },
		query: { ...RealmModerationListQuery, localizationLanguages },
	});
	const [filter, setFilter] = useState<RealmModerationStatus | "all">("all");
	const [selectedUnitId, setSelectedUnitId] = useState<string>();
	const filteredUnits =
		filter === "all"
			? units.data?.items
			: units.data?.items.filter((unit) => unit.status === filter);
	const selectedUnit = units.data?.items.find((unit) => unit.unitId === selectedUnitId);

	return (
		<section className="grid gap-3">
			<div className="flex flex-wrap items-end justify-between gap-3">
				{embedded ? null : (
					<h2 className="font-heading text-xl font-bold">{t.realms.moderation}</h2>
				)}
				<Field className="w-full sm:w-48">
					<FieldLabel>{t.realms.moderationFilter}</FieldLabel>
					<NativeSelect
						value={filter}
						onChange={(event) => {
							setFilter(toRealmModerationStatus(event.currentTarget.value));
							setSelectedUnitId(undefined);
						}}
					>
						<NativeSelectOption value="all">
							{t.realms.allModerationStates}
						</NativeSelectOption>
						{RealmModerationStatuses.map((status) => (
							<NativeSelectOption key={status} value={status}>
								{t.realms.moderationStates[status]}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
			</div>
			{units.isPending ? (
				<Skeleton className="h-48 rounded-xl" />
			) : units.error ? (
				<RequestFailure error={units.error} />
			) : filteredUnits?.length ? (
				<div className="grid gap-3">
					{filteredUnits.map((unit) => (
						<RealmModerationRow
							key={unit.unitId}
							unit={unit}
							onSelect={() => setSelectedUnitId(unit.unitId)}
						/>
					))}
				</div>
			) : (
				<p className="text-muted-foreground text-sm">{t.state.empty}</p>
			)}
			{selectedUnit ? (
				<RealmModerationPanel
					key={selectedUnit.unitId}
					realmId={realmId}
					unit={selectedUnit}
					onClose={() => setSelectedUnitId(undefined)}
				/>
			) : null}
		</section>
	);
}

function RealmModerationRow({
	unit,
	onSelect,
}: {
	unit: RealmModerationUnit;
	onSelect: () => void;
}) {
	const { t } = useTranslation(["posts", "realms", "state"]);
	return (
		<Card>
			<CardContent className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
				<div className="min-w-0">
					<p className="truncate font-medium">{unit.title ?? t.posts.untitled}</p>
					<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-sm">
						<span>
							{t.realms.currentState}: {t.realms.moderationStates[unit.status]}
						</span>
						<span>
							{t.realms.postTargetingLockState}:{" "}
							{unit.postTargetingLocked
								? t.realms.postTargetingLocked
								: t.realms.postTargetingUnlocked}
						</span>
					</div>
				</div>
				<Button type="button" size="sm" variant="outline" onClick={onSelect}>
					{t.realms.reviewModeration}
				</Button>
			</CardContent>
		</Card>
	);
}

function RealmModerationPanel({
	realmId,
	unit,
	onClose,
}: {
	realmId: string;
	unit: RealmModerationUnit;
	onClose: () => void;
}) {
	const { t, locale } = useTranslation(["posts", "realms", "state"]);
	const queryClient = useQueryClient();
	const moderate = usePatchApiRealmsByRealmIdUnitsByUnitId();
	const history = useGetApiRealmsByRealmIdUnitsByUnitIdHistory({
		path: { realmId, unitId: unit.unitId },
		query: RealmModerationHistoryQuery,
	});
	const allowedCommands = getRealmModerationCommands(unit.status, unit.postTargetingLocked);
	const [command, setCommand] = useState<RealmModerationCommand>(
		() => allowedCommands[0] ?? "note",
	);
	const [reasonCode, setReasonCode] =
		useState<(typeof GovernanceReasonCodes)[number]>("realm_rules");
	const [includeAnnotation, setIncludeAnnotation] = useState(false);
	const [annotationRole, setAnnotationRole] = useState<ModerationAnnotationRole>("internal_note");
	const [annotationLanguage, setAnnotationLanguage] = useState<ContentLanguage>(
		toContentLanguage(locale.target),
	);
	const [annotation, setAnnotation] = useState<PortableTextValue>([]);
	const annotationRequested = command === "note" || includeAnnotation;
	const annotationValid = !annotationRequested || hasAuthoredAnnotation(annotation);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!annotationValid) return;
		const authoredAnnotation = annotationRequested
			? {
					role: annotationRole,
					language: annotationLanguage,
					content: writePortableText(annotation),
				}
			: undefined;
		let body: PatchApiRealmsByRealmIdUnitsByUnitIdBody;
		if (command === "note") {
			if (!authoredAnnotation) return;
			body = {
				command,
				reasonCode,
				idempotencyKey: crypto.randomUUID(),
				annotation: authoredAnnotation,
			};
		} else {
			body = {
				command,
				reasonCode,
				idempotencyKey: crypto.randomUUID(),
				...(authoredAnnotation ? { annotation: authoredAnnotation } : {}),
			};
		}
		moderate.mutate(
			{
				path: { realmId, unitId: unit.unitId },
				body,
			},
			{
				onSuccess: async () => {
					await Promise.all([
						queryClient.invalidateQueries({
							queryKey: getApiRealmsByRealmIdUnitsQueryKey({
								path: { realmId },
								query: RealmModerationListQuery,
							}),
						}),
						queryClient.invalidateQueries({
							queryKey: getApiRealmsByRealmIdUnitsByUnitIdHistoryQueryKey({
								path: { realmId, unitId: unit.unitId },
								query: RealmModerationHistoryQuery,
							}),
						}),
						invalidatePostQueries(queryClient, unit.unitId),
					]);
					onClose();
				},
			},
		);
	}

	return (
		<Card className="border-brand/35">
			<CardContent className="grid gap-6 p-5">
				<div className="flex items-start justify-between gap-4">
					<div className="min-w-0">
						<p className="truncate font-heading font-bold text-lg">
							{unit.title ?? t.posts.untitled}
						</p>
						<p className="text-muted-foreground text-sm">
							{t.realms.currentState}: {t.realms.moderationStates[unit.status]} ·{" "}
							{unit.postTargetingLocked
								? t.realms.postTargetingLocked
								: t.realms.postTargetingUnlocked}
						</p>
					</div>
					<Button type="button" size="sm" variant="quiet" onClick={onClose}>
						{t.realms.closeModeration}
					</Button>
				</div>

				<form className="grid gap-4 border-t pt-5" onSubmit={submit}>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field required>
							<FieldLabel>{t.realms.moderationAction}</FieldLabel>
							<NativeSelect
								value={command}
								onChange={(event) =>
									setCommand(
										toRealmModerationCommand(
											event.currentTarget.value,
											allowedCommands,
										),
									)
								}
							>
								{allowedCommands.map((value) => (
									<NativeSelectOption key={value} value={value}>
										{t.realms.governanceActions[value]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						<Field required>
							<FieldLabel>{t.realms.moderationReason}</FieldLabel>
							<NativeSelect
								value={reasonCode}
								onChange={(event) =>
									setReasonCode(toGovernanceReasonCode(event.currentTarget.value))
								}
							>
								{GovernanceReasonCodes.map((value) => (
									<NativeSelectOption key={value} value={value}>
										{t.realms.governanceReasons[value]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
					</div>

					<Field className="w-auto" orientation="horizontal">
						<Checkbox
							checked={annotationRequested}
							disabled={command === "note"}
							onCheckedChange={({ checked }) =>
								setIncludeAnnotation(checked === true)
							}
						/>
						<FieldLabel className="font-normal">
							{t.realms.includeAnnotation}
						</FieldLabel>
					</Field>

					{annotationRequested ? (
						<div className="grid gap-4 rounded-lg border bg-muted/20 p-4">
							<div className="grid gap-4 sm:grid-cols-2">
								<Field required>
									<FieldLabel>{t.realms.annotationRole}</FieldLabel>
									<NativeSelect
										value={annotationRole}
										onChange={(event) =>
											setAnnotationRole(
												event.currentTarget.value === "public_notice"
													? "public_notice"
													: "internal_note",
											)
										}
									>
										<NativeSelectOption value="internal_note">
											{t.realms.annotationRoles.internal_note}
										</NativeSelectOption>
										<NativeSelectOption value="public_notice">
											{t.realms.annotationRoles.public_notice}
										</NativeSelectOption>
									</NativeSelect>
								</Field>
								<Field required>
									<FieldLabel>{t.realms.annotationLanguage}</FieldLabel>
									<NativeSelect
										value={annotationLanguage}
										onChange={(event) => {
											const value = event.currentTarget.value;
											if (isContentLanguage(value))
												setAnnotationLanguage(value);
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
							<PortableTextEditor
								label={t.realms.annotation}
								required
								value={annotation}
								onChange={setAnnotation}
							/>
							<p className="text-muted-foreground text-xs">
								{t.realms.annotationPostHint}
							</p>
						</div>
					) : null}

					<RequestFailure error={moderate.error} />
					<Button
						variant="solid"
						type="submit"
						className="w-fit"
						disabled={!annotationValid}
						isLoading={moderate.isPending}
					>
						{t.realms.submitModeration}
					</Button>
				</form>

				<div className="grid gap-3 border-t pt-5">
					<h3 className="font-heading font-bold">{t.realms.moderationHistory}</h3>
					{history.isPending ? (
						<Skeleton className="h-32 rounded-xl" />
					) : history.error ? (
						<RequestFailure error={history.error} />
					) : history.data?.items.length ? (
						<div className="grid gap-3">
							{history.data.items.map((item) => (
								<RealmModerationHistoryItem key={item.id} item={item} />
							))}
						</div>
					) : (
						<p className="text-muted-foreground text-sm">
							{t.realms.noModerationHistory}
						</p>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

function RealmModerationHistoryItem({ item }: { item: RealmModerationHistoryAction }) {
	const { t, locale } = useTranslation(["posts", "realms", "state"]);
	return (
		<article className="grid gap-3 rounded-lg border p-4 text-sm">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<p className="font-medium">{t.realms.governanceActions[item.kind]}</p>
				<time className="text-muted-foreground text-xs" dateTime={item.createdAt}>
					{formatDateTime(item.createdAt, locale.current)}
				</time>
			</div>
			<div className="grid gap-1 text-muted-foreground">
				<p>
					{t.realms.actionBy}: {item.actorName ?? t.realms.unknownMember}
				</p>
				<p>
					{t.realms.moderationReason}: {t.realms.governanceReasons[item.reasonCode]}
				</p>
				{item.previousState && item.resultingState ? (
					<p>
						{t.realms.stateTransition}: {t.realms.moderationStates[item.previousState]}{" "}
						→ {t.realms.moderationStates[item.resultingState]}
					</p>
				) : null}
				{item.previousPostTargetingLocked !== null &&
				item.resultingPostTargetingLocked !== null ? (
					<p>
						{t.realms.postTargetingLockTransition}:{" "}
						{item.previousPostTargetingLocked
							? t.realms.postTargetingLocked
							: t.realms.postTargetingUnlocked}{" "}
						→{" "}
						{item.resultingPostTargetingLocked
							? t.realms.postTargetingLocked
							: t.realms.postTargetingUnlocked}
					</p>
				) : null}
			</div>
			{item.notes.map((note) => (
				<div
					key={`${note.postId}:${note.latestRevisionId ?? "current"}:${note.role}`}
					className="grid gap-2 rounded-md bg-muted/35 p-3"
				>
					<div className="grid gap-1 text-muted-foreground text-xs">
						<span>
							{t.realms.annotationRoles[note.role]} · {note.language}
						</span>
						<span>
							{t.realms.annotationPost}: <code>{note.postId}</code>
						</span>
						{note.latestRevisionId ? (
							<span>
								{t.realms.annotationRevision}: <code>{note.latestRevisionId}</code>
							</span>
						) : null}
					</div>
					<PortableTextContent value={readPortableText(note.content)} variant="compact" />
				</div>
			))}
		</article>
	);
}

function formatDateTime(value: string, language: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat(language, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}
