"use client";

import {
	ContentLanguageValues,
	isContentLanguage,
	toContentLanguage,
	type ContentLanguage,
} from "@rezics/i18n";
import {
	getApiRealmsByRealmIdReports,
	getApiRealmsByRealmIdReportsQueryKey,
	useGetApiRealmsByRealmIdUnitsByUnitIdHistory,
	useGetApiReportsUnitsByUnitIdDestinations,
	usePatchApiRealmsByRealmIdUnitsByUnitId,
	usePostApiRealmsByRealmIdUnitsByUnitIdReview,
	type GetApiRealmsByRealmIdReportsQuery,
	type GetApiRealmsByRealmIdReportsStatus200,
	type GetApiRealmsByRealmIdUnitsByUnitIdHistoryStatus200,
	type GetApiRealmsByRealmIdUnitsQuery,
	type PatchApiRealmsByRealmIdUnitsByUnitIdBody,
	type PostApiRealmsByRealmIdUnitsByUnitIdReviewBody,
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
	FieldDescription,
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
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";

import { LocalizedPortableTextContent } from "@/features/content-language-display/localized-portable-text-content";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import {
	contentRuleSelectionKey,
	getContentRuleDestination,
	getContentRuleKeys,
	getContentRuleReferences,
	retainAvailableContentRuleSelection,
	updateContentRuleSelection,
} from "@/features/governance/model/content-rule-selection";
import {
	ContentRuleMultiSelect,
	ContentRuleSourceSelect,
} from "@/features/governance/components/content-rule-picker";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { readPortableText, writePortableText } from "@/lib/block";
import {
	RealmModerationHistoryQuery,
	refreshRealmModerationData,
	updateRealmModerationQueueCache,
	type RealmModerationUnit,
} from "../data/realm-moderation-query";
import {
	hasAuthoredAnnotation,
	realmGovernanceActionRequiresRules,
	toRealmModerationCommand,
	type RealmModerationCommand,
} from "../model/moderation-contract";
import type { RealmModerationFilter, RealmReportFilter } from "../routing/realm-moderation-route";

type RealmModerationHistoryAction =
	GetApiRealmsByRealmIdUnitsByUnitIdHistoryStatus200["items"][number];
type RealmUnitReport = GetApiRealmsByRealmIdReportsStatus200["items"][number];
type ModerationAnnotationRole = "internal_note" | "public_notice";
type GovernanceSubmission =
	| { readonly type: "action"; readonly body: PatchApiRealmsByRealmIdUnitsByUnitIdBody }
	| {
			readonly type: "review";
			readonly body: PostApiRealmsByRealmIdUnitsByUnitIdReviewBody;
	  };

export function RealmModerationSheet({
	realmId,
	unit,
	queueCache,
	onOpenChange,
}: {
	readonly realmId: string;
	readonly unit: RealmModerationUnit;
	readonly queueCache?: Readonly<{
		readonly query: GetApiRealmsByRealmIdUnitsQuery;
		readonly filter: RealmModerationFilter;
		readonly reportFilter: RealmReportFilter;
	}>;
	readonly onOpenChange: (open: boolean) => void;
}) {
	const { t, locale } = useTranslation(["locale", "posts", "realms", "reports"]);
	const localizationLanguages = useLocalizationLanguages();
	const queryClient = useQueryClient();
	const actionMutation = usePatchApiRealmsByRealmIdUnitsByUnitId();
	const reviewMutation = usePostApiRealmsByRealmIdUnitsByUnitIdReview();
	const history = useGetApiRealmsByRealmIdUnitsByUnitIdHistory({
		path: { realmId, unitId: unit.unitId },
		query: RealmModerationHistoryQuery,
	});
	const reportQuery = {
		unitId: unit.unitId,
		localizationLanguages,
		limit: 50,
	} satisfies GetApiRealmsByRealmIdReportsQuery;
	const reports = useInfiniteQuery({
		queryKey: getApiRealmsByRealmIdReportsQueryKey({
			path: { realmId },
			query: reportQuery,
		}),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiRealmsByRealmIdReports({
				path: { realmId },
				query: { ...reportQuery, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
	const destinations = useGetApiReportsUnitsByUnitIdDestinations({
		path: { unitId: unit.unitId },
		query: { contextRealmId: realmId, localizationLanguages },
	});
	const [commandSelection, setCommandSelection] = useState<RealmModerationCommand>(
		() => unit.allowedCommands[0] ?? "note",
	);
	const [selectedRuleKeys, setSelectedRuleKeys] = useState<string[]>([]);
	const [ruleSourceId, setRuleSourceId] = useState("");
	const [includeAnnotation, setIncludeAnnotation] = useState(false);
	const [annotationRole, setAnnotationRole] = useState<ModerationAnnotationRole>("internal_note");
	const [annotationLanguage, setAnnotationLanguage] = useState<ContentLanguage>(
		toContentLanguage(locale.target),
	);
	const [annotation, setAnnotation] = useState<PortableTextValue>([]);
	const [removeConfirmationOpen, setRemoveConfirmationOpen] = useState(false);
	const submissionInFlight = useRef(false);
	const command = toRealmModerationCommand(commandSelection, unit.allowedCommands);
	const rulesRequired = realmGovernanceActionRequiresRules(command);
	const destinationItems = destinations.data?.items ?? [];
	const currentSelectedRuleKeys = retainAvailableContentRuleSelection(
		selectedRuleKeys,
		destinationItems,
	);
	const activeDestination = getContentRuleDestination(destinationItems, ruleSourceId);
	const activeSelectedRuleKeys = activeDestination
		? getContentRuleKeys(activeDestination).filter((key) => currentSelectedRuleKeys.includes(key))
		: [];
	const selectedRules = getContentRuleReferences(destinationItems, currentSelectedRuleKeys);
	const annotationRequested = command === "note" || includeAnnotation;
	const annotationValid = !annotationRequested || hasAuthoredAnnotation(annotation);
	const rulesValid = !rulesRequired || selectedRules.length > 0;
	const mutationPending = actionMutation.isPending || reviewMutation.isPending;
	const title = unit.title ?? t.posts.untitled;
	const formId = `realm-moderation-${unit.unitId}`;
	const reportItems = reports.data?.pages.flatMap((page) => page.items) ?? [];
	const ruleTitles = new Map(
		destinationItems.flatMap((destination) =>
			destination.rules.map(
				(rule) =>
					[
						contentRuleSelectionKey(destination.id, destination.revisionId, rule.id),
						rule.title,
					] as const,
			),
		),
	);

	function updateRuleSource(sourceId: string) {
		if (!destinationItems.some(({ id }) => id === sourceId)) return;
		setRuleSourceId(sourceId);
	}

	function updateRuleCheckedState(key: string, checked: boolean) {
		const availableRuleKeys = new Set(
			destinationItems.flatMap((destination) => getContentRuleKeys(destination)),
		);
		if (!availableRuleKeys.has(key)) return;
		setSelectedRuleKeys((current) =>
			updateContentRuleSelection(
				retainAvailableContentRuleSelection(current, destinationItems),
				key,
				checked,
			),
		);
	}

	function buildSubmission(): GovernanceSubmission | undefined {
		if (!annotationValid || !rulesValid) return undefined;
		const authoredAnnotation = annotationRequested
			? {
					role: annotationRole,
					language: annotationLanguage,
					content: writePortableText(annotation),
				}
			: undefined;
		if (command === "note") {
			if (!authoredAnnotation) return undefined;
			return { type: "review", body: { command, annotation: authoredAnnotation } };
		}
		if (command === "dismiss") {
			return {
				type: "review",
				body: {
					command,
					...(authoredAnnotation ? { annotation: authoredAnnotation } : {}),
				},
			};
		}
		const common = {
			idempotencyKey: crypto.randomUUID(),
			...(authoredAnnotation ? { annotation: authoredAnnotation } : {}),
		};
		if (realmGovernanceActionRequiresRules(command)) {
			if (!selectedRules.length) return undefined;
			return { type: "action", body: { ...common, command, rules: selectedRules } };
		}
		if (command !== "approve" && command !== "restore" && command !== "unlock_post_targeting")
			return undefined;
		return { type: "action", body: { ...common, command } };
	}

	async function applyGovernance() {
		if (submissionInFlight.current) return;
		const submission = buildSubmission();
		if (!submission) return;
		submissionInFlight.current = true;
		try {
			const result =
				submission.type === "action"
					? await actionMutation.mutateAsync({
							path: { realmId, unitId: unit.unitId },
							body: submission.body,
						})
					: await reviewMutation.mutateAsync({
							path: { realmId, unitId: unit.unitId },
							body: submission.body,
						});
			if (queueCache)
				updateRealmModerationQueueCache(
					queryClient,
					realmId,
					queueCache.query,
					queueCache.filter,
					queueCache.reportFilter,
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
		if (!annotationValid || !rulesValid) return;
		if (command === "remove") {
			setRemoveConfirmationOpen(true);
			return;
		}
		void applyGovernance();
	}

	return (
		<>
			<Sheet
				onOpenChange={({ open }) => {
					if (!open && !mutationPending) onOpenChange(false);
				}}
				open
			>
				<SheetContent className="sm:max-w-2xl" placement="right" showCloseButton={!mutationPending}>
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
							<Field required>
								<FieldLabel>{t.realms.moderationAction}</FieldLabel>
								<NativeSelect
									onChange={(event) =>
										setCommandSelection(
											toRealmModerationCommand(event.currentTarget.value, unit.allowedCommands),
										)
									}
									value={command}
								>
									{unit.allowedCommands.map((value) => (
										<NativeSelectOption key={value} value={value}>
											{t.realms.governanceActions[value]}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Field>

							{rulesRequired ? (
								<>
									{destinationItems.length > 1 ? (
										<Field>
											<FieldLabel>{t.reports.realm}</FieldLabel>
											<ContentRuleSourceSelect
												destinations={destinationItems}
												labels={{
													ariaLabel: t.reports.realm,
													choose: t.reports.chooseRealm,
													scopeLabels: t.reports.myReports.scopes,
												}}
												onValueChange={updateRuleSource}
												value={activeDestination?.id}
											/>
										</Field>
									) : null}
									<Field required>
										<FieldLabel>{t.reports.rule}</FieldLabel>
										{destinations.isPending ? <Skeleton className="h-28 rounded-xl" /> : null}
										{destinations.error ? <RequestFailure error={destinations.error} /> : null}
										<ContentRuleMultiSelect
											destination={activeDestination}
											labels={{
												ariaLabel: t.reports.rule,
												choose: t.reports.chooseRule,
												clear: t.reports.clearRules,
												selectedCount: t.reports.selectedRuleCount,
											}}
											onClear={() => setSelectedRuleKeys([])}
											onRuleCheckedChange={updateRuleCheckedState}
											selectedKeys={activeSelectedRuleKeys}
											totalSelectedCount={currentSelectedRuleKeys.length}
										/>
										{destinations.data && !destinations.data.items.length ? (
											<FieldDescription>{t.reports.noRules}</FieldDescription>
										) : null}
										<FieldDescription>{t.reports.ruleLimit}</FieldDescription>
									</Field>
								</>
							) : null}

							<Field className="w-auto" orientation="horizontal">
								<Checkbox
									checked={annotationRequested}
									disabled={command === "note"}
									onCheckedChange={({ checked }) => setIncludeAnnotation(checked === true)}
								/>
								<FieldLabel className="font-normal">{t.realms.includeAnnotation}</FieldLabel>
							</Field>

							{annotationRequested ? (
								<div className="grid gap-4 rounded-lg border bg-muted/20 p-4">
									<div className="grid gap-4 sm:grid-cols-2">
										<Field required>
											<FieldLabel>{t.realms.annotationRole}</FieldLabel>
											<NativeSelect
												onChange={(event) =>
													setAnnotationRole(
														event.currentTarget.value === "public_notice"
															? "public_notice"
															: "internal_note",
													)
												}
												value={annotationRole}
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
												onChange={(event) => {
													const value = event.currentTarget.value;
													if (isContentLanguage(value)) setAnnotationLanguage(value);
												}}
												value={annotationLanguage}
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
									<p className="text-muted-foreground text-xs">{t.realms.annotationPostHint}</p>
								</div>
							) : null}
							<RequestFailure error={actionMutation.error ?? reviewMutation.error} />
						</form>

						<div className="grid gap-3 border-t pt-5">
							<h3 className="font-heading font-bold">{t.reports.heading}</h3>
							{reports.isPending ? <Skeleton className="h-32 rounded-xl" /> : null}
							{reports.isError ? <RequestFailure error={reports.error} /> : null}
							{reportItems.length ? (
								<div className="grid gap-3">
									{reportItems.map((item) => (
										<RealmReportItem key={item.id} realmId={realmId} report={item} />
									))}
									{reports.hasNextPage ? (
										<Button
											disabled={reports.isFetchingNextPage}
											isLoading={reports.isFetchingNextPage}
											onClick={() => void reports.fetchNextPage()}
											type="button"
											variant="outline"
										>
											{t.reports.myReports.loadMore}
										</Button>
									) : null}
								</div>
							) : reports.isSuccess ? (
								<p className="text-muted-foreground text-sm">{t.reports.empty}</p>
							) : null}
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
										<RealmModerationHistoryItem item={item} key={item.id} ruleTitles={ruleTitles} />
									))}
								</div>
							) : (
								<p className="text-muted-foreground text-sm">{t.realms.noModerationHistory}</p>
							)}
						</div>
					</SheetBody>
					<SheetFooter>
						<Button
							disabled={mutationPending}
							onClick={() => onOpenChange(false)}
							type="button"
							variant="outline"
						>
							{t.realms.closeModeration}
						</Button>
						<Button
							disabled={!annotationValid || !rulesValid}
							form={formId}
							isLoading={mutationPending}
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
					if (!mutationPending) setRemoveConfirmationOpen(open);
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
						<AlertDialogCancel disabled={mutationPending}>
							{t.realms.cancelModeration}
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={mutationPending}
							onClick={() => {
								setRemoveConfirmationOpen(false);
								void applyGovernance();
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

function RealmReportItem({
	realmId,
	report,
}: {
	readonly realmId: string;
	readonly report: RealmUnitReport;
}) {
	const { t, locale } = useTranslation(["reports"]);
	const referral = report.referrals.find(
		(item) => item.scope === "realm" && item.realmId === realmId,
	);
	return (
		<article className="grid gap-3 rounded-lg border p-4 text-sm">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<p className="font-medium">{report.rules.map((rule) => rule.title).join(" · ")}</p>
				<time className="text-muted-foreground text-xs" dateTime={report.createdAt}>
					{t.reports.reportedAt({
						date: formatDateTime(report.createdAt, locale.current),
					})}
				</time>
			</div>
			<div className="grid gap-1 text-muted-foreground text-xs">
				{referral ? (
					<p>
						{t.reports.caseState}: {t.reports.caseStates[referral.caseState]}
					</p>
				) : null}
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

function RealmModerationHistoryItem({
	item,
	ruleTitles,
}: {
	readonly item: RealmModerationHistoryAction;
	readonly ruleTitles: ReadonlyMap<string, string>;
}) {
	const { t, locale } = useTranslation(["locale", "realms", "reports"]);
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
				{item.rules.length ? (
					<p>
						{t.reports.rule}:{" "}
						{item.rules
							.map(
								(rule) =>
									ruleTitles.get(
										contentRuleSelectionKey(rule.sourceRealmId, rule.revisionId, rule.ruleId),
									) ?? rule.ruleId,
							)
							.join(" · ")}
					</p>
				) : null}
				{item.previousState && item.resultingState ? (
					<p>
						{t.realms.stateTransition}:{" "}
						{t.realms.moderationTransition({
							from: t.realms.moderationStates[item.previousState],
							to: t.realms.moderationStates[item.resultingState],
						})}
					</p>
				) : null}
				{item.previousPostTargetingLocked !== null && item.resultingPostTargetingLocked !== null ? (
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
