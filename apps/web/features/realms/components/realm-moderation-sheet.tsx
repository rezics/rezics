"use client";

import {
	ContentLanguageValues,
	isContentLanguage,
	toContentLanguage,
	type ContentLanguage,
} from "@rezics/i18n";
import {
	useGetApiRealmsByRealmIdUnitsByUnitIdHistory,
	useGetApiRealmsByRealmIdReports,
	usePatchApiRealmsByRealmIdUnitsByUnitId,
	type GetApiRealmsByRealmIdUnitsQuery,
	type GetApiRealmsByRealmIdUnitsByUnitIdHistoryStatus200,
	type GetApiRealmsByRealmIdReportsStatus200,
	type PatchApiRealmsByRealmIdUnitsByUnitIdBody,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	Checkbox,
	Field,
	FieldLabel,
	NativeSelect,
	NativeSelectOption,
	Sheet,
	SheetBody,
	SheetContent,
	SheetFooter,
	SheetHeader,
	Skeleton,
	toast,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";

import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { readPortableText, writePortableText } from "@/lib/block";
import { LocalizedPortableTextContent } from "@/features/content-language-display/localized-portable-text-content";
import {
	RealmModerationHistoryQuery,
	refreshRealmModerationData,
	updateRealmModerationQueueCache,
	type RealmModerationUnit,
} from "../data/realm-moderation-query";
import {
	GovernanceReasonCodes,
	hasAuthoredAnnotation,
	toGovernanceReasonCode,
	toRealmModerationCommand,
	type RealmModerationCommand,
} from "../model/moderation-contract";
import type { RealmModerationFilter, RealmReportFilter } from "../routing/realm-moderation-route";

type RealmModerationHistoryAction =
	GetApiRealmsByRealmIdUnitsByUnitIdHistoryStatus200["items"][number];
type RealmUnitReport = GetApiRealmsByRealmIdReportsStatus200["items"][number];
type ModerationAnnotationRole = "internal_note" | "public_notice";

export function RealmModerationSheet({
	realmId,
	unit,
	cacheQuery,
	filter,
	reportFilter,
	onOpenChange,
}: {
	readonly realmId: string;
	readonly unit: RealmModerationUnit;
	readonly cacheQuery: GetApiRealmsByRealmIdUnitsQuery;
	readonly filter: RealmModerationFilter;
	readonly reportFilter: RealmReportFilter;
	readonly onOpenChange: (open: boolean) => void;
}) {
	const { t, locale } = useTranslation(["locale", "posts", "realms", "reports"]);
	const queryClient = useQueryClient();
	const mutation = usePatchApiRealmsByRealmIdUnitsByUnitId();
	const history = useGetApiRealmsByRealmIdUnitsByUnitIdHistory({
		path: { realmId, unitId: unit.unitId },
		query: RealmModerationHistoryQuery,
	});
	const reports = useGetApiRealmsByRealmIdReports({
		path: { realmId },
		query: { unitId: unit.unitId, limit: 100 },
	});
	const [command, setCommand] = useState<RealmModerationCommand>(
		() => unit.allowedCommands[0] ?? "note",
	);
	const [reasonCode, setReasonCode] =
		useState<(typeof GovernanceReasonCodes)[number]>("realm_rules");
	const [includeAnnotation, setIncludeAnnotation] = useState(false);
	const [annotationRole, setAnnotationRole] = useState<ModerationAnnotationRole>("internal_note");
	const [annotationLanguage, setAnnotationLanguage] = useState<ContentLanguage>(
		toContentLanguage(locale.target),
	);
	const [annotation, setAnnotation] = useState<PortableTextValue>([]);
	const [removeConfirmationOpen, setRemoveConfirmationOpen] = useState(false);
	const submissionInFlight = useRef(false);
	const annotationRequested = command === "note" || includeAnnotation;
	const annotationValid = !annotationRequested || hasAuthoredAnnotation(annotation);
	const title = unit.title ?? t.posts.untitled;
	const formId = `realm-moderation-${unit.unitId}`;

	function buildBody(): PatchApiRealmsByRealmIdUnitsByUnitIdBody | undefined {
		if (!annotationValid) return undefined;
		const authoredAnnotation = annotationRequested
			? {
					role: annotationRole,
					language: annotationLanguage,
					content: writePortableText(annotation),
				}
			: undefined;
		if (command === "note") {
			if (!authoredAnnotation) return undefined;
			return {
				command,
				reasonCode,
				idempotencyKey: crypto.randomUUID(),
				annotation: authoredAnnotation,
			};
		}
		return {
			command,
			reasonCode,
			idempotencyKey: crypto.randomUUID(),
			...(authoredAnnotation ? { annotation: authoredAnnotation } : {}),
		};
	}

	async function applyModeration() {
		if (submissionInFlight.current) return;
		const body = buildBody();
		if (!body) return;
		submissionInFlight.current = true;
		try {
			const result = await mutation.mutateAsync({
				path: { realmId, unitId: unit.unitId },
				body,
			});
			updateRealmModerationQueueCache(
				queryClient,
				realmId,
				cacheQuery,
				filter,
				reportFilter,
				unit.unitId,
				result.target,
			);
			onOpenChange(false);
			toast.create({ title: t.realms.moderationSucceeded, type: "success" });
			refreshRealmModerationData(queryClient, realmId, unit.unitId);
		} catch {
			// The typed mutation state renders the localized request failure below.
		} finally {
			submissionInFlight.current = false;
		}
	}

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!annotationValid) return;
		if (command === "remove") {
			setRemoveConfirmationOpen(true);
			return;
		}
		void applyModeration();
	}

	return (
		<>
			<Sheet
				onOpenChange={({ open }) => {
					if (!open && !mutation.isPending) onOpenChange(false);
				}}
				open
			>
				<SheetContent
					className="sm:max-w-2xl"
					placement="right"
					showCloseButton={!mutation.isPending}
				>
					<SheetHeader
						description={t.realms.moderationSnapshot({
							status: t.realms.moderationStates[unit.status],
							targeting: unit.postTargetingLocked
								? t.realms.postTargetingLocked
								: t.realms.postTargetingUnlocked,
						})}
						title={title}
					/>
					<SheetBody className="grid content-start gap-6">
						<form className="grid gap-4" id={formId} onSubmit={submit}>
							<div className="grid gap-4 sm:grid-cols-2">
								<Field required>
									<FieldLabel>{t.realms.moderationAction}</FieldLabel>
									<NativeSelect
										value={command}
										onChange={(event) =>
											setCommand(
												toRealmModerationCommand(
													event.currentTarget.value,
													unit.allowedCommands,
												),
											)
										}
									>
										{unit.allowedCommands.map((value) => (
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
											setReasonCode(
												toGovernanceReasonCode(event.currentTarget.value),
											)
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
														event.currentTarget.value ===
															"public_notice"
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
														{t.locale.contentLanguages[value]}
													</NativeSelectOption>
												))}
											</NativeSelect>
										</Field>
									</div>
									<PortableTextEditor
										label={t.realms.annotation}
										onChange={setAnnotation}
										required
										value={annotation}
									/>
									<p className="text-muted-foreground text-xs">
										{t.realms.annotationPostHint}
									</p>
								</div>
							) : null}
							<RequestFailure error={mutation.error} />
						</form>

						<div className="grid gap-3 border-t pt-5">
							<h3 className="font-heading font-bold">{t.reports.heading}</h3>
							{reports.isPending ? (
								<Skeleton className="h-32 rounded-xl" />
							) : reports.error ? (
								<RequestFailure error={reports.error} />
							) : reports.data?.items.length ? (
								<div className="grid gap-3">
									{reports.data.items.map((item) => (
										<RealmReportItem key={item.id} report={item} />
									))}
								</div>
							) : (
								<p className="text-muted-foreground text-sm">{t.reports.empty}</p>
							)}
						</div>

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
					</SheetBody>
					<SheetFooter>
						<Button
							disabled={mutation.isPending}
							onClick={() => onOpenChange(false)}
							type="button"
							variant="outline"
						>
							{t.realms.closeModeration}
						</Button>
						<Button
							disabled={!annotationValid}
							form={formId}
							isLoading={mutation.isPending}
							type="submit"
							variant={command === "remove" ? "destructive" : "solid"}
						>
							{t.realms.submitModeration}
						</Button>
					</SheetFooter>
				</SheetContent>
			</Sheet>

			<AlertDialog
				onOpenChange={({ open }) => {
					if (!mutation.isPending) setRemoveConfirmationOpen(open);
				}}
				open={removeConfirmationOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t.realms.confirmRemovalTitle}</AlertDialogTitle>
						<AlertDialogDescription>
							{t.realms.confirmRemovalDescription({ title })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={mutation.isPending}>
							{t.realms.cancelModeration}
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={mutation.isPending}
							onClick={() => {
								setRemoveConfirmationOpen(false);
								void applyModeration();
							}}
							variant="destructive"
						>
							{t.realms.confirmRemoval}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

function RealmReportItem({ report }: { readonly report: RealmUnitReport }) {
	const { t, locale } = useTranslation(["reports"]);
	return (
		<article className="grid gap-3 rounded-lg border p-4 text-sm">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<p className="font-medium">{report.rule.title}</p>
				<time className="text-muted-foreground text-xs" dateTime={report.createdAt}>
					{t.reports.reportedAt({
						date: formatDateTime(report.createdAt, locale.current),
					})}
				</time>
			</div>
			<div className="grid gap-1 text-muted-foreground text-xs">
				<p>
					{t.reports.caseState}: {t.reports.caseStates[report.caseState]}
				</p>
				<p>
					{t.reports.revision}: <code>{report.reportedRevisionId}</code>
				</p>
			</div>
			{report.details ? (
				<p className="whitespace-pre-wrap rounded-md bg-muted/35 p-3">{report.details}</p>
			) : null}
		</article>
	);
}

function RealmModerationHistoryItem({ item }: { item: RealmModerationHistoryAction }) {
	const { t, locale } = useTranslation(["locale", "realms"]);
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
						{t.realms.stateTransition}:{" "}
						{t.realms.moderationTransition({
							from: t.realms.moderationStates[item.previousState],
							to: t.realms.moderationStates[item.resultingState],
						})}
					</p>
				) : null}
				{item.previousPostTargetingLocked !== null &&
				item.resultingPostTargetingLocked !== null ? (
					<p>
						{t.realms.postTargetingLockTransition}:{" "}
						{t.realms.moderationTransition({
							from: item.previousPostTargetingLocked
								? t.realms.postTargetingLocked
								: t.realms.postTargetingUnlocked,
							to: item.resultingPostTargetingLocked
								? t.realms.postTargetingLocked
								: t.realms.postTargetingUnlocked,
						})}
					</p>
				) : null}
			</div>
			{item.notes.map((note) => (
				<div
					className="grid gap-2 rounded-md bg-muted/35 p-3"
					key={`${note.postId}:${note.latestRevisionId ?? "current"}:${note.role}`}
				>
					<div className="grid gap-1 text-muted-foreground text-xs">
						<span>
							{t.realms.annotationRoleLanguage({
								role: t.realms.annotationRoles[note.role],
								language: t.locale.contentLanguages[note.language],
							})}
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
					<LocalizedPortableTextContent
						language={note.language}
						value={readPortableText(note.content)}
						variant="compact"
					/>
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
