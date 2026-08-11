"use client";

import {
	GetApiGovernancePlatformUnitMergesState,
	PostApiGovernancePlatformUnitMergesRequestReasonCodeEnum,
	getApiGovernancePlatformUnitMerges,
	getApiGovernancePlatformUnitMergesQueryKey,
	type GetApiGovernancePlatformUnitMergesState as UnitMergeState,
	type GetApiGovernancePlatformUnitMergesStatus200,
	type PostApiGovernancePlatformUnitMergesPreflightStatus200,
	type PostApiGovernancePlatformUnitMergesRequestReasonCodeEnum as GovernanceReasonCode,
	usePostApiGovernancePlatformUnitMerges,
	usePostApiGovernancePlatformUnitMergesByRequestIdRetry,
	usePostApiGovernancePlatformUnitMergesByRequestIdReviews,
	usePostApiGovernancePlatformUnitMergesDirect,
	usePostApiGovernancePlatformUnitMergesPreflight,
} from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	Field,
	FieldLabel,
	Input,
	NativeSelect,
	NativeSelectOption,
	QueryFailure,
	QueryPending,
	Textarea,
	cn,
} from "@rezics/ui";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, GitMerge, RefreshCw, ShieldAlert, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useConsoleWorkspace } from "../components/console-workspace";

type UnitMergeRequest = GetApiGovernancePlatformUnitMergesStatus200["items"][number];
type StateFilter = "all" | UnitMergeState;
type ReviewDecision = "approve" | "reject";

const UnitMergeStates = Object.values(GetApiGovernancePlatformUnitMergesState);
const GovernanceReasonCodes = Object.values(
	PostApiGovernancePlatformUnitMergesRequestReasonCodeEnum,
);

function isStateFilter(value: string): value is StateFilter {
	return value === "all" || UnitMergeStates.some((candidate) => candidate === value);
}

function createIdempotencyKey(): string {
	return globalThis.crypto?.randomUUID?.() ?? `unit-merge-${Date.now()}-${Math.random()}`;
}

function unitHref(unit: UnitMergeRequest["sourceUnit"], kind: UnitMergeRequest["unitKind"]) {
	return kind === "entity" ? `/entities/${unit.id}` : `/units/${kind}/${unit.id}`;
}

function stateBadgeVariant(state: UnitMergeRequest["state"]) {
	if (state === "completed") return "success" as const;
	if (state === "failed" || state === "rejected") return "destructive" as const;
	if (state === "accepted" || state === "executing") return "warning" as const;
	return "secondary" as const;
}

export function ConsoleUnitMergesPage() {
	const searchParams = useSearchParams();
	const initialSourceUnitId = searchParams.get("source")?.trim() ?? "";
	const { locale, t } = useTranslation(["console", "errors", "realms"]);
	const {
		canReadUnitMerges,
		canProposeUnitMerges,
		canReviewUnitMerges,
		canMergeUnitsDirectly,
		currentProfileId,
	} = useConsoleWorkspace();
	const queryClient = useQueryClient();
	const [state, setState] = useState<StateFilter>("pending_review");
	const [selectedRequestId, setSelectedRequestId] = useState("");
	const baseQuery = useMemo(() => ({ limit: 50, ...(state === "all" ? {} : { state }) }), [state]);
	const requests = useInfiniteQuery({
		queryKey: getApiGovernancePlatformUnitMergesQueryKey({ query: baseQuery }),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiGovernancePlatformUnitMerges({
				query: { ...baseQuery, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
		enabled: canReadUnitMerges,
	});
	const items = requests.data?.pages.flatMap((page) => page.items) ?? [];
	const selected = items.find((request) => request.id === selectedRequestId) ?? items[0] ?? null;
	const formatter = useMemo(
		() =>
			new Intl.DateTimeFormat(locale.current, {
				dateStyle: "medium",
				timeStyle: "short",
			}),
		[locale.current],
	);

	const [createOpen, setCreateOpen] = useState(Boolean(initialSourceUnitId));
	const [sourceUnitId, setSourceUnitId] = useState(initialSourceUnitId);
	const [targetUnitId, setTargetUnitId] = useState("");
	const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);
	const [reasonCode, setReasonCode] = useState<GovernanceReasonCode>("administrative");
	const [note, setNote] = useState("");
	const [confirmationSourceUnitId, setConfirmationSourceUnitId] = useState("");
	const [confirmationTargetUnitId, setConfirmationTargetUnitId] = useState("");
	const [overrideOfRequestId, setOverrideOfRequestId] = useState<string>();
	const preflight = usePostApiGovernancePlatformUnitMergesPreflight();
	const propose = usePostApiGovernancePlatformUnitMerges();
	const direct = usePostApiGovernancePlatformUnitMergesDirect();

	const [reviewDecision, setReviewDecision] = useState<ReviewDecision | null>(null);
	const [reviewNote, setReviewNote] = useState("");
	const [reviewConfirmation, setReviewConfirmation] = useState("");
	const review = usePostApiGovernancePlatformUnitMergesByRequestIdReviews();
	const retry = usePostApiGovernancePlatformUnitMergesByRequestIdRetry();

	if (!canReadUnitMerges) return <p className="text-destructive text-sm">{t.errors.forbidden}</p>;
	if (requests.isPending) return <QueryPending />;
	if (requests.isError)
		return <QueryFailure error={requests.error} retry={() => void requests.refetch()} />;

	function resetPreflight() {
		preflight.reset();
		propose.reset();
		direct.reset();
		setConfirmationSourceUnitId("");
		setConfirmationTargetUnitId("");
	}

	function openCreate() {
		setSourceUnitId("");
		setTargetUnitId("");
		setIdempotencyKey(createIdempotencyKey());
		setReasonCode("administrative");
		setNote("");
		setOverrideOfRequestId(undefined);
		resetPreflight();
		setCreateOpen(true);
	}

	function openDirectOverride(request: UnitMergeRequest) {
		setSourceUnitId(request.sourceUnit.id);
		setTargetUnitId(request.targetUnit.id);
		setIdempotencyKey(createIdempotencyKey());
		setReasonCode(request.reasonCode);
		setNote("");
		setOverrideOfRequestId(request.id);
		resetPreflight();
		setCreateOpen(true);
	}

	async function runPreflight() {
		if (!sourceUnitId || !targetUnitId || sourceUnitId === targetUnitId) return;
		try {
			await preflight.mutateAsync({ body: { sourceUnitId, targetUnitId } });
		} catch {
			// The typed mutation state renders the localized API error below.
		}
	}

	async function submitMerge(mode: "reviewed" | "privileged_direct") {
		const manifest = preflight.data?.manifest;
		if (
			!manifest ||
			confirmationSourceUnitId !== sourceUnitId ||
			confirmationTargetUnitId !== targetUnitId
		)
			return;
		const body = {
			sourceUnitId,
			targetUnitId,
			confirmationSourceUnitId,
			confirmationTargetUnitId,
			expectedSourceUpdatedAt: manifest.sourceUpdatedAt,
			expectedTargetUpdatedAt: manifest.targetUpdatedAt,
			idempotencyKey,
			reasonCode,
			...(note.trim() ? { note: note.trim() } : {}),
			...(mode === "privileged_direct" && overrideOfRequestId ? { overrideOfRequestId } : {}),
		};
		try {
			const created =
				mode === "privileged_direct"
					? await direct.mutateAsync({ body })
					: await propose.mutateAsync({ body });
			await queryClient.invalidateQueries({
				queryKey: getApiGovernancePlatformUnitMergesQueryKey(),
			});
			setState(mode === "reviewed" ? "pending_review" : "all");
			setSelectedRequestId(created.id);
			setCreateOpen(false);
		} catch {
			// The typed mutation state renders the localized API error below.
		}
	}

	function openReview(decision: ReviewDecision) {
		setReviewDecision(decision);
		setReviewNote("");
		setReviewConfirmation("");
		review.reset();
	}

	async function submitReview() {
		if (!selected || !reviewDecision || reviewConfirmation !== selected.id || review.isPending)
			return;
		try {
			const updated = await review.mutateAsync({
				path: { requestId: selected.id },
				body: {
					decision: reviewDecision,
					requestFingerprint: selected.manifest.fingerprint,
					...(reviewNote.trim() ? { note: reviewNote.trim() } : {}),
				},
			});
			await queryClient.invalidateQueries({
				queryKey: getApiGovernancePlatformUnitMergesQueryKey(),
			});
			if (updated.state !== "pending_review") setState("all");
			setSelectedRequestId(updated.id);
			setReviewDecision(null);
		} catch {
			// The typed mutation state renders the localized API error below.
		}
	}

	async function retryMerge() {
		if (!selected || retry.isPending) return;
		try {
			await retry.mutateAsync({ path: { requestId: selected.id } });
			await queryClient.invalidateQueries({
				queryKey: getApiGovernancePlatformUnitMergesQueryKey(),
			});
		} catch {
			// The typed mutation state renders the localized API error below.
		}
	}

	const pendingCreate = propose.isPending || direct.isPending;
	const preflightResult = preflight.data as
		| PostApiGovernancePlatformUnitMergesPreflightStatus200
		| undefined;
	const confirmationValid =
		confirmationSourceUnitId === sourceUnitId && confirmationTargetUnitId === targetUnitId;
	const canReviewSelected =
		selected?.state === "pending_review" &&
		selected.proposer.profileId !== currentProfileId &&
		!selected.reviews.some((item) => item.reviewerProfileId === currentProfileId);

	return (
		<section className="mx-auto grid w-full max-w-7xl gap-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 className="font-semibold text-xl tracking-tight">
						{t.console.sections.unitMerges.label}
					</h1>
					<p className="mt-1 max-w-3xl text-muted-foreground text-sm">
						{t.console.sections.unitMerges.description}
					</p>
				</div>
				{canProposeUnitMerges ? (
					<Button onClick={openCreate}>
						<GitMerge aria-hidden />
						{t.console.unitMerges.newMerge}
					</Button>
				) : null}
			</header>

			<Field className="max-w-xs">
				<FieldLabel>{t.console.unitMerges.stateFilter}</FieldLabel>
				<NativeSelect
					onChange={(event) => {
						const value = event.currentTarget.value;
						if (isStateFilter(value)) setState(value);
					}}
					value={state}
				>
					<NativeSelectOption value="all">{t.console.unitMerges.allStates}</NativeSelectOption>
					{UnitMergeStates.map((value) => (
						<NativeSelectOption key={value} value={value}>
							{t.console.unitMerges.states[value]}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>

			<div className="grid gap-5 lg:grid-cols-[minmax(19rem,0.85fr)_minmax(0,1.6fr)]">
				<div
					aria-label={t.console.unitMerges.listLabel}
					className="overflow-hidden rounded-xl border"
					role="listbox"
				>
					{items.length ? (
						items.map((request) => {
							const active = selected?.id === request.id;
							return (
								<button
									aria-selected={active}
									className={cn(
										"grid w-full gap-1 border-b px-4 py-3 text-start last:border-b-0 hover:bg-muted/48 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
										active && "bg-primary/8",
									)}
									key={request.id}
									onClick={() => setSelectedRequestId(request.id)}
									role="option"
									type="button"
								>
									<span className="flex items-center justify-between gap-3">
										<span className="truncate font-medium">
											{request.sourceUnit.title ?? t.console.unitMerges.untitled}
										</span>
										<Badge variant={stateBadgeVariant(request.state)}>
											{t.console.unitMerges.states[request.state]}
										</Badge>
									</span>
									<span className="truncate text-muted-foreground text-xs">
										→ {request.targetUnit.title ?? request.targetUnit.id}
									</span>
									<span className="text-muted-foreground text-xs">
										{formatter.format(new Date(request.createdAt))}
									</span>
								</button>
							);
						})
					) : (
						<p className="p-10 text-center text-muted-foreground text-sm">
							{t.console.unitMerges.empty}
						</p>
					)}
					{requests.hasNextPage ? (
						<div className="border-t p-3">
							<Button
								className="w-full"
								isLoading={requests.isFetchingNextPage}
								onClick={() => void requests.fetchNextPage()}
								variant="outline"
							>
								{t.console.unitMerges.loadMore}
							</Button>
						</div>
					) : null}
				</div>

				<div className="rounded-xl border p-5">
					{selected ? (
						<div className="grid gap-6">
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div>
									<h2 className="font-semibold text-lg">
										{selected.sourceUnit.title ?? t.console.unitMerges.untitled}
										<span className="mx-2 text-muted-foreground">→</span>
										{selected.targetUnit.title ?? t.console.unitMerges.untitled}
									</h2>
									<p className="mt-1 break-all text-muted-foreground text-xs">{selected.id}</p>
								</div>
								<Badge variant={stateBadgeVariant(selected.state)}>
									{t.console.unitMerges.states[selected.state]}
								</Badge>
							</div>

							<div className="grid gap-3 sm:grid-cols-2">
								{(["sourceUnit", "targetUnit"] as const).map((role) => {
									const item = selected[role];
									return (
										<div className="rounded-lg border p-4" key={role}>
											<p className="text-muted-foreground text-xs">
												{role === "sourceUnit"
													? t.console.unitMerges.source
													: t.console.unitMerges.target}
											</p>
											<p className="mt-1 font-medium">
												{item.title ?? t.console.unitMerges.untitled}
											</p>
											<p className="mt-1 break-all text-muted-foreground text-xs">{item.id}</p>
											<Button asChild className="mt-3" size="sm" variant="outline">
												<Link href={unitHref(item, selected.unitKind)}>
													<ExternalLink aria-hidden />
													{t.console.unitMerges.openUnit}
												</Link>
											</Button>
										</div>
									);
								})}
							</div>

							<dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								<div>
									<dt className="text-muted-foreground text-sm">{t.console.unitMerges.kind}</dt>
									<dd className="mt-1 font-medium">
										{t.console.unitMerges.kinds[selected.unitKind]}
									</dd>
								</div>
								<div>
									<dt className="text-muted-foreground text-sm">{t.console.unitMerges.mode}</dt>
									<dd className="mt-1 font-medium">{t.console.unitMerges.modes[selected.mode]}</dd>
								</div>
								<div>
									<dt className="text-muted-foreground text-sm">{t.console.unitMerges.proposer}</dt>
									<dd className="mt-1 font-medium">
										{selected.proposer.label ?? selected.proposer.profileId}
									</dd>
								</div>
							</dl>

							<div className="rounded-lg bg-muted/35 p-4">
								<p className="font-medium text-sm">
									{t.console.unitMerges.approvalProgress({
										count: Number(selected.approvals),
										required: Number(selected.policy.requiredApprovals),
									})}
								</p>
								<p className="mt-1 text-muted-foreground text-sm">
									{t.console.unitMerges.graphActions[selected.manifest.graphPlan.action]}
								</p>
								{selected.note ? (
									<p className="mt-3 whitespace-pre-wrap text-sm">{selected.note}</p>
								) : null}
							</div>

							{selected.operation ? (
								<div className="rounded-lg border p-4">
									<h3 className="font-medium">{t.console.unitMerges.operation}</h3>
									<p className="mt-1 text-muted-foreground text-sm">
										{t.console.unitMerges.operationStates[selected.operation.state]} ·{" "}
										{t.console.unitMerges.processedRows({
											count: Number(selected.operation.processedRows),
										})}
									</p>
									{selected.operation.lastErrorMessage ? (
										<p className="mt-2 text-destructive text-sm">
											{selected.operation.lastErrorMessage}
										</p>
									) : null}
								</div>
							) : null}

							<div>
								<h3 className="font-medium">{t.console.unitMerges.reviews}</h3>
								{selected.reviews.length ? (
									<ul className="mt-2 grid gap-2">
										{selected.reviews.map((item) => (
											<li className="rounded-lg border p-3 text-sm" key={item.reviewerProfileId}>
												<span className="font-medium">
													{item.reviewerLabel ?? item.reviewerProfileId}
												</span>{" "}
												· {t.console.unitMerges.decisions[item.decision]}
												{item.note ? (
													<p className="mt-1 whitespace-pre-wrap text-muted-foreground">
														{item.note}
													</p>
												) : null}
											</li>
										))}
									</ul>
								) : (
									<p className="mt-2 text-muted-foreground text-sm">
										{t.console.unitMerges.noReviews}
									</p>
								)}
							</div>

							<div className="flex flex-wrap gap-2">
								{canReviewUnitMerges && canReviewSelected ? (
									<>
										<Button onClick={() => openReview("approve")}>
											<Check aria-hidden />
											{t.console.unitMerges.approve}
										</Button>
										<Button onClick={() => openReview("reject")} variant="destructive">
											<X aria-hidden />
											{t.console.unitMerges.reject}
										</Button>
									</>
								) : null}
								{canMergeUnitsDirectly && selected.operation?.state === "failed" ? (
									<Button
										isLoading={retry.isPending}
										onClick={() => void retryMerge()}
										variant="outline"
									>
										<RefreshCw aria-hidden />
										{t.console.unitMerges.retry}
									</Button>
								) : null}
								{canMergeUnitsDirectly && selected.state === "rejected" ? (
									<Button onClick={() => openDirectOverride(selected)} variant="destructive">
										<GitMerge aria-hidden />
										{t.console.unitMerges.mergeDirectly}
									</Button>
								) : null}
							</div>
							<RequestFailure error={retry.error} />
						</div>
					) : (
						<div className="py-16 text-center">
							<h2 className="font-medium">{t.console.unitMerges.selectRequest}</h2>
							<p className="mt-1 text-muted-foreground text-sm">
								{t.console.unitMerges.selectRequestDescription}
							</p>
						</div>
					)}
				</div>
			</div>

			<Dialog
				onOpenChange={({ open }) => {
					if (!open && !pendingCreate && !preflight.isPending) setCreateOpen(false);
				}}
				open={createOpen}
			>
				<DialogContent showCloseButton={!pendingCreate} size="lg">
					<DialogHeader
						description={t.console.unitMerges.createDescription}
						title={t.console.unitMerges.createTitle}
					/>
					<DialogBody className="grid gap-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<Field required>
								<FieldLabel>{t.console.unitMerges.sourceId}</FieldLabel>
								<Input
									autoComplete="off"
									onChange={(event) => {
										setSourceUnitId(event.currentTarget.value.trim());
										setOverrideOfRequestId(undefined);
										resetPreflight();
									}}
									spellCheck={false}
									value={sourceUnitId}
								/>
							</Field>
							<Field required>
								<FieldLabel>{t.console.unitMerges.targetId}</FieldLabel>
								<Input
									autoComplete="off"
									onChange={(event) => {
										setTargetUnitId(event.currentTarget.value.trim());
										setOverrideOfRequestId(undefined);
										resetPreflight();
									}}
									spellCheck={false}
									value={targetUnitId}
								/>
							</Field>
						</div>
						<Button
							disabled={!sourceUnitId || !targetUnitId || sourceUnitId === targetUnitId}
							isLoading={preflight.isPending}
							onClick={() => void runPreflight()}
							variant="outline"
						>
							{t.console.unitMerges.preflight}
						</Button>
						{preflightResult ? (
							<div className="grid gap-3 rounded-lg border p-4 text-sm">
								<p className="font-medium">
									{preflightResult.sourceUnit.title ?? preflightResult.sourceUnit.id} →{" "}
									{preflightResult.targetUnit.title ?? preflightResult.targetUnit.id}
								</p>
								<p className="text-muted-foreground">
									{t.console.unitMerges.kinds[preflightResult.unitKind]} ·{" "}
									{t.console.unitMerges.graphActions[preflightResult.manifest.graphPlan.action]}
								</p>
								<div className="flex gap-2 rounded-md bg-destructive/8 p-3 text-destructive">
									<ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
									<p>{t.console.unitMerges.irreversibleWarning}</p>
								</div>
								<Field required>
									<FieldLabel>{t.console.unitMerges.reason}</FieldLabel>
									<NativeSelect
										onChange={(event) => {
											const next = GovernanceReasonCodes.find(
												(value) => value === event.currentTarget.value,
											);
											if (next) setReasonCode(next);
										}}
										value={reasonCode}
									>
										{GovernanceReasonCodes.map((value) => (
											<NativeSelectOption key={value} value={value}>
												{t.realms.governanceReasons[value]}
											</NativeSelectOption>
										))}
									</NativeSelect>
								</Field>
								<Field>
									<FieldLabel>{t.console.unitMerges.internalNote}</FieldLabel>
									<Textarea
										maxLength={2_000}
										onChange={(event) => setNote(event.currentTarget.value)}
										placeholder={t.console.unitMerges.notePlaceholder}
										value={note}
									/>
								</Field>
								<div className="grid gap-4 sm:grid-cols-2">
									<Field required>
										<FieldLabel>{t.console.unitMerges.confirmSource}</FieldLabel>
										<Input
											autoComplete="off"
											onChange={(event) =>
												setConfirmationSourceUnitId(event.currentTarget.value.trim())
											}
											spellCheck={false}
											value={confirmationSourceUnitId}
										/>
									</Field>
									<Field required>
										<FieldLabel>{t.console.unitMerges.confirmTarget}</FieldLabel>
										<Input
											autoComplete="off"
											onChange={(event) =>
												setConfirmationTargetUnitId(event.currentTarget.value.trim())
											}
											spellCheck={false}
											value={confirmationTargetUnitId}
										/>
									</Field>
								</div>
							</div>
						) : null}
						<RequestFailure error={preflight.error ?? propose.error ?? direct.error} />
					</DialogBody>
					<DialogFooter>
						<Button disabled={pendingCreate} onClick={() => setCreateOpen(false)} variant="outline">
							{t.console.cancel}
						</Button>
						{preflightResult && canProposeUnitMerges ? (
							<Button
								disabled={!confirmationValid}
								isLoading={propose.isPending}
								onClick={() => void submitMerge("reviewed")}
							>
								{t.console.unitMerges.submitForReview}
							</Button>
						) : null}
						{preflightResult && canMergeUnitsDirectly ? (
							<Button
								disabled={!confirmationValid}
								isLoading={direct.isPending}
								onClick={() => void submitMerge("privileged_direct")}
								variant="destructive"
							>
								{t.console.unitMerges.mergeDirectly}
							</Button>
						) : null}
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				onOpenChange={({ open }) => {
					if (!open && !review.isPending) setReviewDecision(null);
				}}
				open={reviewDecision !== null}
			>
				<DialogContent showCloseButton={!review.isPending} size="sm">
					<DialogHeader
						description={
							reviewDecision === "approve"
								? t.console.unitMerges.approveDescription
								: t.console.unitMerges.rejectDescription
						}
						title={
							reviewDecision === "approve"
								? t.console.unitMerges.approveTitle
								: t.console.unitMerges.rejectTitle
						}
					/>
					<DialogBody className="grid gap-4">
						<Field>
							<FieldLabel>{t.console.unitMerges.reviewNote}</FieldLabel>
							<Textarea
								maxLength={2_000}
								onChange={(event) => setReviewNote(event.currentTarget.value)}
								placeholder={t.console.unitMerges.reviewNotePlaceholder}
								value={reviewNote}
							/>
						</Field>
						<Field required>
							<FieldLabel>{t.console.unitMerges.confirmRequest}</FieldLabel>
							<p className="mb-2 break-all text-muted-foreground text-sm">{selected?.id}</p>
							<Input
								autoComplete="off"
								onChange={(event) => setReviewConfirmation(event.currentTarget.value.trim())}
								spellCheck={false}
								value={reviewConfirmation}
							/>
						</Field>
						<RequestFailure error={review.error} />
					</DialogBody>
					<DialogFooter>
						<Button
							disabled={review.isPending}
							onClick={() => setReviewDecision(null)}
							variant="outline"
						>
							{t.console.cancel}
						</Button>
						<Button
							disabled={!selected || reviewConfirmation !== selected.id}
							isLoading={review.isPending}
							onClick={() => void submitReview()}
							variant={reviewDecision === "reject" ? "destructive" : "solid"}
						>
							{reviewDecision === "approve"
								? t.console.unitMerges.confirmApprove
								: t.console.unitMerges.confirmReject}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</section>
	);
}
