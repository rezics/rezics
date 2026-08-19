"use client";

import { createBlockKey, createPortableTextDocument } from "@rezics/block";
import {
	GetApiReportsPlatformCasesState,
	getApiGovernanceContentReviewCasesQueryKey,
	getApiReportsPlatformCases,
	getApiReportsPlatformCasesQueryKey,
	getApiReportsReviewCasesByCaseId,
	getApiReportsReviewCasesByCaseIdQueryKey,
	type GetApiReportsPlatformCasesQuery,
	type GetApiReportsPlatformCasesState as PlatformCaseState,
	type GetApiReportsPlatformCasesStatus200,
	type PostApiGovernanceContentGovernanceActionsBody,
	useGetApiReportsUnitsByUnitIdDestinations,
	usePatchApiGovernanceContentReviewCasesByCaseId,
	usePostApiGovernanceContentGovernanceActions,
} from "@rezics/openapi-tanstack-query";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Field,
	FieldDescription,
	FieldLabel,
	ManagementWorkspaceSectionHeader,
	NativeSelect,
	NativeSelectOption,
	QueryFailure,
	QueryPending,
	Textarea,
	toast,
} from "@rezics/ui";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { DraftContentLanguageField } from "@/features/content-languages/components/draft-content-language-field";
import { useDraftContentLanguage } from "@/features/content-languages/hooks/use-draft-content-language";
import {
	getGovernanceRuleSource,
	getGovernanceRuleKeys,
	getGovernanceRuleReferences,
	retainAvailableGovernanceRuleSelection,
	updateGovernanceRuleSelection,
} from "@/features/governance/model/governance-rule-selection";
import { GovernanceRuleMultiSelect } from "@/features/governance/components/governance-rule-picker";
import { publicUnitHref } from "@/features/units/routing/public-unit-route";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { useConsoleWorkspace } from "../components/console-workspace";

type PlatformReportCase = GetApiReportsPlatformCasesStatus200["items"][number];
type PlatformCommand =
	| "approve"
	| "remove"
	| "restore"
	| "lock_post_targeting"
	| "unlock_post_targeting"
	| "invalidate_license"
	| "restore_license"
	| "dismiss"
	| "note";
type ConfirmedCommand = Extract<PlatformCommand, "remove" | "invalidate_license">;

const CaseStates = Object.values(GetApiReportsPlatformCasesState);
function platformGovernanceActionRequiresRules(
	command: PlatformCommand,
): command is Extract<
	PlatformCommand,
	| "approve"
	| "remove"
	| "restore"
	| "lock_post_targeting"
	| "unlock_post_targeting"
	| "invalidate_license"
> {
	return (
		command === "approve" ||
		command === "remove" ||
		command === "restore" ||
		command === "lock_post_targeting" ||
		command === "unlock_post_targeting" ||
		command === "invalidate_license"
	);
}

function isPlatformCommand(value: string): value is PlatformCommand {
	return [
		"approve",
		"remove",
		"restore",
		"lock_post_targeting",
		"unlock_post_targeting",
		"invalidate_license",
		"restore_license",
		"dismiss",
		"note",
	].includes(value);
}

function selectCommand(value: string, allowed: readonly string[]): PlatformCommand {
	if (isPlatformCommand(value) && allowed.includes(value)) return value;
	const first = allowed.find(isPlatformCommand);
	return first ?? "note";
}

function createNoteDocument(text: string) {
	return createPortableTextDocument([
		{
			_type: "block" as const,
			_key: createBlockKey(),
			style: "normal",
			markDefs: [],
			children: [
				{
					_type: "span" as const,
					_key: createBlockKey(),
					text,
					marks: [],
				},
			],
		},
	]);
}

export function ConsoleModerationPage() {
	const { locale, t } = useTranslation(["console", "errors", "realms", "reports"]);
	const { canModerate } = useConsoleWorkspace();
	const localizationLanguages = useLocalizationLanguages();
	const queryClient = useQueryClient();
	const [state, setState] = useState<PlatformCaseState>();
	const [selectedCaseId, setSelectedCaseId] = useState("");
	const [commandSelection, setCommandSelection] = useState({
		caseId: "",
		value: "note" as PlatformCommand,
	});
	const [ruleSelection, setRuleSelection] = useState({
		caseId: "",
		keys: [] as string[],
	});
	const [note, setNote] = useState("");
	const noteLanguage = useDraftContentLanguage(note);
	const [confirmedCommand, setConfirmedCommand] = useState<ConfirmedCommand | null>(null);
	const [selectedGrantId, setSelectedGrantId] = useState("");

	const casesQuery = {
		state,
		localizationLanguages,
		limit: 50,
	} satisfies GetApiReportsPlatformCasesQuery;
	const cases = useInfiniteQuery({
		queryKey: getApiReportsPlatformCasesQueryKey({ query: casesQuery }),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiReportsPlatformCases({
				query: { ...casesQuery, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
		enabled: canModerate,
	});
	const caseItems = cases.data?.pages.flatMap((page) => page.items) ?? [];
	const selected = caseItems.find((item) => item.caseId === selectedCaseId) ?? caseItems[0];
	const command = selected
		? commandSelection.caseId === selected.caseId
			? selectCommand(commandSelection.value, selected.allowedCommands)
			: selectCommand("", selected.allowedCommands)
		: "note";

	const reports = useInfiniteQuery({
		queryKey: getApiReportsReviewCasesByCaseIdQueryKey({
			path: { caseId: selected?.caseId ?? "00000000-0000-7000-8000-000000000000" },
			query: { localizationLanguages, limit: 50 },
		}),
		queryFn: async ({ pageParam, signal }) => {
			if (!selected) throw new Error("A selected content review case is required");
			const { data } = await getApiReportsReviewCasesByCaseId({
				path: { caseId: selected.caseId },
				query: {
					localizationLanguages,
					limit: 50,
					...(pageParam ? { cursor: pageParam } : {}),
				},
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
		enabled: Boolean(selected),
	});
	const destinations = useGetApiReportsUnitsByUnitIdDestinations(
		{
			path: { unitId: selected?.unitId ?? "00000000-0000-7000-8000-000000000000" },
			query: { localizationLanguages },
		},
		{ query: { enabled: Boolean(selected) } },
	);
	const actionMutation = usePostApiGovernanceContentGovernanceActions();
	const caseMutation = usePatchApiGovernanceContentReviewCasesByCaseId();
	const mutationPending = actionMutation.isPending || caseMutation.isPending;
	const selectedRuleKeys =
		selected && ruleSelection.caseId === selected.caseId ? ruleSelection.keys : [];
	const destinationItems = destinations.data?.items ?? [];
	const currentSelectedRuleKeys = retainAvailableGovernanceRuleSelection(
		selectedRuleKeys,
		destinationItems,
	);
	const activeDestination = getGovernanceRuleSource(destinationItems);
	const activeSelectedRuleKeys = activeDestination
		? getGovernanceRuleKeys(activeDestination).filter((key) =>
				currentSelectedRuleKeys.includes(key),
			)
		: [];
	const selectedRules = getGovernanceRuleReferences(destinationItems, currentSelectedRuleKeys);
	const noteRequired = command === "note";
	const noteValid = !noteRequired || note.trim().length > 0;
	const rulesValid = !platformGovernanceActionRequiresRules(command) || selectedRules.length > 0;

	function updateRuleCheckedState(key: string, checked: boolean) {
		const availableRuleKeys = new Set(
			destinationItems.flatMap((destination) => getGovernanceRuleKeys(destination)),
		);
		if (!availableRuleKeys.has(key) || !selected) return;
		setRuleSelection((current) => ({
			caseId: selected.caseId,
			keys: updateGovernanceRuleSelection(
				retainAvailableGovernanceRuleSelection(
					current.caseId === selected.caseId ? current.keys : [],
					destinationItems,
				),
				key,
				checked,
			),
		}));
	}

	async function refreshCaseData(caseId: string) {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: getApiReportsPlatformCasesQueryKey() }),
			queryClient.invalidateQueries({
				queryKey: getApiReportsReviewCasesByCaseIdQueryKey({
					path: { caseId },
					query: { localizationLanguages, limit: 50 },
				}),
			}),
			queryClient.invalidateQueries({
				queryKey: getApiGovernanceContentReviewCasesQueryKey(),
			}),
		]);
	}

	async function applyGovernance() {
		if (!selected || mutationPending || !noteValid || !rulesValid) return;
		const normalizedNote = note.trim();
		const language = normalizedNote
			? await noteLanguage.resolveLanguage(normalizedNote)
			: undefined;
		const document = normalizedNote ? createNoteDocument(normalizedNote) : undefined;
		try {
			if (command === "note" || command === "dismiss") {
				if (command === "note" && (!language || !document)) return;
				await caseMutation.mutateAsync({
					path: { caseId: selected.caseId },
					body: {
						...(command === "dismiss" ? { state: "rejected" as const } : {}),
						...(language && document ? { internalNote: { language, content: document } } : {}),
					},
				});
			} else {
				const notes =
					language && document
						? [{ role: "internal_note" as const, language, content: document }]
						: undefined;
				const common = {
					caseId: selected.caseId,
					idempotencyKey: crypto.randomUUID(),
					...(notes ? { notes } : {}),
				};
				let body: PostApiGovernanceContentGovernanceActionsBody;
				const selectedGrant = selected.licenseGrants.find((grant) => grant.id === selectedGrantId);
				if (command === "invalidate_license") {
					if (!selectedGrant || selectedGrant.recognitionStatus !== "recognized") return;
					body = {
						...common,
						kind: "invalidate_license",
						licenseGrantId: selectedGrant.id,
						rules: selectedRules,
					};
				} else if (platformGovernanceActionRequiresRules(command)) {
					body = { ...common, kind: command, rules: selectedRules };
				} else if (command === "restore_license") {
					if (!selectedGrant || selectedGrant.recognitionStatus !== "invalidated") return;
					body = {
						...common,
						kind: "restore_license",
						reversesActionId: selectedGrant.invalidationActionId,
					};
				} else return;
				await actionMutation.mutateAsync({ body });
			}
			setNote("");
			setRuleSelection({ caseId: selected.caseId, keys: [] });
			noteLanguage.enableAutomaticDetection();
			toast.create({ title: t.console.moderation.succeeded, type: "success" });
			await refreshCaseData(selected.caseId);
		} catch {
			// Typed mutation state renders the localized request failure below.
		}
	}

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!noteValid || !rulesValid) return;
		if (command === "remove" || command === "invalidate_license") {
			setConfirmedCommand(command);
			return;
		}
		void applyGovernance();
	}

	if (!canModerate) return <p className="text-destructive text-sm">{t.errors.forbidden}</p>;
	if (cases.isPending) return <QueryPending />;
	if (cases.isError) return <QueryFailure error={cases.error} retry={() => void cases.refetch()} />;

	return (
		<section>
			<ManagementWorkspaceSectionHeader
				backHref="/console"
				backLabel={t.console.overview}
				description={t.console.sections.moderation.description}
				link={Link}
				title={t.console.sections.moderation.label}
			/>
			<Card appearance="outlined" className="mb-4">
				<CardContent className="flex flex-wrap items-end gap-3 p-3">
					<Field className="max-w-xs">
						<FieldLabel>{t.console.moderation.filterState}</FieldLabel>
						<NativeSelect
							onChange={(event) => {
								const value = event.currentTarget.value;
								setState(CaseStates.find((candidate) => candidate === value));
								setSelectedCaseId("");
							}}
							value={state ?? ""}
						>
							<NativeSelectOption value="">{t.console.moderation.allStates}</NativeSelectOption>
							{CaseStates.map((value) => (
								<NativeSelectOption key={value} value={value}>
									{t.reports.caseStates[value]}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
				</CardContent>
			</Card>
			<div className="grid gap-4 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.6fr)]">
				<CaseList
					hasMore={cases.hasNextPage}
					isLoadingMore={cases.isFetchingNextPage}
					items={caseItems}
					onLoadMore={() => void cases.fetchNextPage()}
					onSelect={setSelectedCaseId}
					selectedCaseId={selected?.caseId}
				/>
				{selected ? (
					<Card appearance="outlined">
						<CardHeader className="border-b">
							<CardTitle>{selected.title ?? t.console.moderation.untitled}</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-6 pt-5">
							<CaseSnapshot item={selected} />
							<div className="grid gap-3">
								<h3 className="font-heading font-bold">{t.console.moderation.reports}</h3>
								{reports.isPending ? <QueryPending /> : null}
								{reports.isError ? (
									<QueryFailure error={reports.error} retry={() => void reports.refetch()} />
								) : null}
								{reports.data?.pages
									.flatMap((page) => page.items)
									.map((report) => (
										<article className="grid gap-2 rounded-lg border p-4 text-sm" key={report.id}>
											<div className="flex flex-wrap justify-between gap-2">
												<p className="font-medium">
													{report.rules.map((rule) => rule.title).join(" · ")}
												</p>
												<time className="text-muted-foreground text-xs" dateTime={report.createdAt}>
													{t.reports.reportedAt({
														date: new Intl.DateTimeFormat(locale.current, {
															dateStyle: "medium",
															timeStyle: "short",
														}).format(new Date(report.createdAt)),
													})}
												</time>
											</div>
											{report.details ? (
												<p className="whitespace-pre-wrap rounded-md bg-muted/35 p-3">
													{report.details}
												</p>
											) : null}
										</article>
									))}
								{reports.hasNextPage ? (
									<Button
										disabled={reports.isFetchingNextPage}
										isLoading={reports.isFetchingNextPage}
										onClick={() => void reports.fetchNextPage()}
										variant="outline"
									>
										{t.reports.myReports.loadMore}
									</Button>
								) : null}
							</div>
							<form className="grid gap-4" onSubmit={submit}>
								<Field required>
									<FieldLabel>{t.console.moderation.action}</FieldLabel>
									<NativeSelect
										onChange={(event) =>
											setCommandSelection({
												caseId: selected.caseId,
												value: selectCommand(event.currentTarget.value, selected.allowedCommands),
											})
										}
										value={command}
									>
										{selected.allowedCommands.filter(isPlatformCommand).map((value) => (
											<NativeSelectOption key={value} value={value}>
												{t.realms.governanceActions[value]}
											</NativeSelectOption>
										))}
									</NativeSelect>
								</Field>
								{command === "invalidate_license" || command === "restore_license" ? (
									<Field required>
										<FieldLabel>{t.console.moderation.licenseGrant}</FieldLabel>
										<NativeSelect
											onChange={(event) => setSelectedGrantId(event.currentTarget.value)}
											value={selectedGrantId}
										>
											<NativeSelectOption value="">
												{t.console.moderation.chooseLicenseGrant}
											</NativeSelectOption>
											{selected.licenseGrants
												.filter((grant) =>
													command === "invalidate_license"
														? grant.recognitionStatus === "recognized"
														: grant.recognitionStatus === "invalidated",
												)
												.map((grant) => (
													<NativeSelectOption key={grant.id} value={grant.id}>
														{`${grant.licenseId} · ${grant.recognitionStatus}`}
													</NativeSelectOption>
												))}
										</NativeSelect>
									</Field>
								) : null}
								{platformGovernanceActionRequiresRules(command) ? (
									<Field required>
										<FieldLabel>{t.reports.rule}</FieldLabel>
										<div className="grid gap-3">
											<GovernanceRuleMultiSelect
												source={activeDestination}
												labels={{
													ariaLabel: t.reports.rule,
													choose: t.reports.chooseRule,
													clear: t.reports.clearRules,
													selectedCount: t.reports.selectedRuleCount,
												}}
												onClear={() =>
													setRuleSelection({
														caseId: selected.caseId,
														keys: [],
													})
												}
												onRuleCheckedChange={updateRuleCheckedState}
												selectedKeys={activeSelectedRuleKeys}
												totalSelectedCount={currentSelectedRuleKeys.length}
											/>
										</div>
										{destinations.data && !destinations.data.items.length ? (
											<FieldDescription>{t.reports.noRules}</FieldDescription>
										) : null}
										<FieldDescription>{t.reports.ruleLimit}</FieldDescription>
									</Field>
								) : null}
								<Field required={noteRequired}>
									<FieldLabel>{t.console.moderation.internalNote}</FieldLabel>
									<Textarea
										maxLength={5_000}
										onChange={(event) => setNote(event.currentTarget.value)}
										placeholder={t.console.moderation.notePlaceholder}
										rows={4}
										value={note}
									/>
								</Field>
								<DraftContentLanguageField controller={noteLanguage} />
								<RequestFailure
									error={actionMutation.error ?? caseMutation.error ?? destinations.error}
								/>
								<Button
									disabled={!noteValid || !rulesValid}
									isLoading={mutationPending}
									type="submit"
									variant={
										command === "remove" || command === "invalidate_license"
											? "destructive"
											: "solid"
									}
								>
									{t.console.moderation.submit}
								</Button>
							</form>
						</CardContent>
					</Card>
				) : (
					<Card appearance="outlined">
						<CardContent className="py-12 text-center text-muted-foreground text-sm">
							{t.console.moderation.empty}
						</CardContent>
					</Card>
				)}
			</div>
			<AlertDialog
				onOpenChange={({ open }) => {
					if (!mutationPending && !open) setConfirmedCommand(null);
				}}
				open={confirmedCommand !== null}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{confirmedCommand === "invalidate_license"
								? t.console.moderation.confirmLicenseInvalidationTitle
								: t.console.moderation.confirmRemovalTitle}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{confirmedCommand === "invalidate_license"
								? t.console.moderation.confirmLicenseInvalidationDescription({
										title: selected?.title ?? t.console.moderation.untitled,
									})
								: t.console.moderation.confirmRemovalDescription({
										title: selected?.title ?? t.console.moderation.untitled,
									})}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={mutationPending}>{t.console.cancel}</AlertDialogCancel>
						<AlertDialogAction
							disabled={mutationPending}
							onClick={() => {
								setConfirmedCommand(null);
								void applyGovernance();
							}}
							variant="destructive"
						>
							{confirmedCommand === "invalidate_license"
								? t.console.moderation.confirmLicenseInvalidation
								: t.console.moderation.confirmRemoval}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</section>
	);
}

function CaseList({
	hasMore,
	isLoadingMore,
	items,
	onLoadMore,
	onSelect,
	selectedCaseId,
}: {
	readonly hasMore: boolean;
	readonly isLoadingMore: boolean;
	readonly items: readonly PlatformReportCase[];
	readonly onLoadMore: () => void;
	readonly onSelect: (caseId: string) => void;
	readonly selectedCaseId?: string;
}) {
	const { t } = useTranslation(["console", "reports"]);
	return (
		<Card appearance="outlined">
			<CardHeader className="border-b">
				<CardTitle>{t.console.moderation.queue}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-1 p-2">
				{items.length ? (
					items.map((item) => (
						<Button
							aria-pressed={selectedCaseId === item.caseId}
							className="h-auto justify-between gap-3 px-3 py-3 text-start"
							key={item.caseId}
							onClick={() => onSelect(item.caseId)}
							type="button"
							variant={selectedCaseId === item.caseId ? "secondary" : "quiet"}
						>
							<span className="min-w-0">
								<span className="block truncate font-medium">
									{item.title ?? t.console.moderation.untitled}
								</span>
								<span className="block text-muted-foreground text-xs">
									{t.reports.caseStates[item.caseState]}
								</span>
							</span>
							<Badge variant={Number(item.reportCount) > 0 ? "warning" : "outline"}>
								{t.console.moderation.reportCount({
									count: Number(item.reportCount),
								})}
							</Badge>
						</Button>
					))
				) : (
					<p className="p-3 text-muted-foreground text-sm">{t.console.moderation.empty}</p>
				)}
				{hasMore ? (
					<Button
						disabled={isLoadingMore}
						isLoading={isLoadingMore}
						onClick={onLoadMore}
						variant="outline"
					>
						{t.reports.myReports.loadMore}
					</Button>
				) : null}
			</CardContent>
		</Card>
	);
}

function CaseSnapshot({ item }: { readonly item: PlatformReportCase }) {
	const { t } = useTranslation(["console", "reports"]);
	const href = publicUnitHref(item.unitKind, { id: item.unitId });
	return (
		<div className="grid gap-2 rounded-lg bg-muted/35 p-4 text-sm">
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant="secondary">
					{t.console.moderation.moderationStatuses[item.moderationStatus]}
				</Badge>
				<Badge variant={item.postTargetingLocked ? "warning" : "outline"}>
					{item.postTargetingLocked
						? t.console.moderation.targetingLocked
						: t.console.moderation.targetingUnlocked}
				</Badge>
				{item.licenseGrants.map((grant) => (
					<Badge
						key={grant.id}
						variant={grant.recognitionStatus === "invalidated" ? "warning" : "outline"}
					>
						{grant.recognitionStatus === "invalidated"
							? t.console.moderation.licenseGrantInvalidated
							: t.console.moderation.licenseGrantRecognized}
					</Badge>
				))}
				<Badge variant="outline">{t.reports.caseStates[item.caseState]}</Badge>
			</div>
			{href ? (
				<Link className="w-fit text-primary underline-offset-4 hover:underline" href={href}>
					{t.console.moderation.openContent}
				</Link>
			) : null}
		</div>
	);
}
