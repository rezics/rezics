"use client";

import {
	GetApiGovernancePlatformOwnershipClaimsState,
	PostApiGovernancePlatformOwnershipClaimsByClaimIdDecisionRequestReasonCodeEnum,
	getApiGovernancePlatformOwnershipClaims,
	getApiGovernancePlatformOwnershipClaimsQueryKey,
	type GetApiGovernancePlatformOwnershipClaimsState as OwnershipClaimState,
	type GetApiGovernancePlatformOwnershipClaimsStatus200,
	type PostApiGovernancePlatformOwnershipClaimsByClaimIdDecisionRequestDecisionEnum as OwnershipClaimDecision,
	type PostApiGovernancePlatformOwnershipClaimsByClaimIdDecisionRequestReasonCodeEnum as GovernanceReasonCode,
	usePostApiGovernancePlatformOwnershipClaimsByClaimIdDecision,
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
import { Check, ExternalLink, X } from "lucide-react";
import { useMemo, useState } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useConsoleWorkspace } from "../components/console-workspace";

type OwnershipClaim = GetApiGovernancePlatformOwnershipClaimsStatus200["items"][number];
type StateFilter = "all" | OwnershipClaimState;

const ClaimStates = Object.values(GetApiGovernancePlatformOwnershipClaimsState);
const GovernanceReasonCodes = Object.values(
	PostApiGovernancePlatformOwnershipClaimsByClaimIdDecisionRequestReasonCodeEnum,
);

function isStateFilter(value: string): value is StateFilter {
	return value === "all" || ClaimStates.some((candidate) => candidate === value);
}

function ownershipClaimUnitHref(claim: OwnershipClaim): string | null {
	if (claim.unitKind === "entity") return `/entities/${claim.unitId}`;
	if (claim.unitKind === "book" || claim.unitKind === "media" || claim.unitKind === "software")
		return `/units/${claim.unitKind}/${claim.unitId}`;
	return null;
}

export function ConsoleOwnershipClaimsPage() {
	const { locale, t } = useTranslation(["console", "errors", "realms"]);
	const { canReadOwnershipClaims, canDecideOwnershipClaims } = useConsoleWorkspace();
	const queryClient = useQueryClient();
	const [state, setState] = useState<StateFilter>("pending");
	const [selectedClaimId, setSelectedClaimId] = useState("");
	const [decision, setDecision] = useState<OwnershipClaimDecision | null>(null);
	const [reasonCode, setReasonCode] = useState<GovernanceReasonCode>("administrative");
	const [note, setNote] = useState("");
	const [confirmationClaimId, setConfirmationClaimId] = useState("");
	const baseQuery = useMemo(() => ({ limit: 50, ...(state === "all" ? {} : { state }) }), [state]);
	const claims = useInfiniteQuery({
		queryKey: getApiGovernancePlatformOwnershipClaimsQueryKey({ query: baseQuery }),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiGovernancePlatformOwnershipClaims({
				query: { ...baseQuery, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
		enabled: canReadOwnershipClaims,
	});
	const items = claims.data?.pages.flatMap((page) => page.items) ?? [];
	const selected = items.find((claim) => claim.id === selectedClaimId) ?? items[0] ?? null;
	const selectedUnitHref = selected ? ownershipClaimUnitHref(selected) : null;
	const decide = usePostApiGovernancePlatformOwnershipClaimsByClaimIdDecision();
	const formatter = useMemo(
		() =>
			new Intl.DateTimeFormat(locale.current, {
				dateStyle: "medium",
				timeStyle: "short",
			}),
		[locale.current],
	);

	if (!canReadOwnershipClaims)
		return <p className="text-destructive text-sm">{t.errors.forbidden}</p>;
	if (claims.isPending) return <QueryPending />;
	if (claims.isError)
		return <QueryFailure error={claims.error} retry={() => void claims.refetch()} />;

	function openDecision(nextDecision: OwnershipClaimDecision) {
		setDecision(nextDecision);
		setReasonCode("administrative");
		setNote("");
		setConfirmationClaimId("");
	}

	async function applyDecision() {
		if (!selected || !decision || confirmationClaimId !== selected.id || decide.isPending) return;
		try {
			await decide.mutateAsync({
				path: { claimId: selected.id },
				body: {
					decision,
					confirmationClaimId,
					reasonCode,
					...(note.trim() ? { note: note.trim() } : {}),
				},
			});
			await queryClient.invalidateQueries({
				queryKey: getApiGovernancePlatformOwnershipClaimsQueryKey(),
			});
			setDecision(null);
			setSelectedClaimId("");
		} catch {
			// The typed mutation state renders the localized API error below.
		}
	}

	return (
		<section className="mx-auto grid w-full max-w-6xl gap-6">
			<header>
				<h1 className="font-semibold text-xl tracking-tight">
					{t.console.sections.ownershipClaims.label}
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					{t.console.sections.ownershipClaims.description}
				</p>
			</header>

			<Field className="max-w-xs">
				<FieldLabel>{t.console.ownershipClaims.stateFilter}</FieldLabel>
				<NativeSelect
					onChange={(event) => {
						const value = event.currentTarget.value;
						if (isStateFilter(value)) setState(value);
					}}
					value={state}
				>
					<NativeSelectOption value="all">{t.console.ownershipClaims.allStates}</NativeSelectOption>
					{ClaimStates.map((value) => (
						<NativeSelectOption key={value} value={value}>
							{t.console.ownershipClaims.states[value]}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>

			<div className="grid gap-5 lg:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.4fr)]">
				<div
					aria-label={t.console.ownershipClaims.listLabel}
					className="overflow-hidden rounded-xl border"
					role="listbox"
				>
					{items.length ? (
						items.map((claim) => {
							const active = selected?.id === claim.id;
							return (
								<button
									aria-selected={active}
									className={cn(
										"grid w-full gap-1 border-b px-4 py-3 text-start last:border-b-0 hover:bg-muted/48 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
										active && "bg-primary/8",
									)}
									key={claim.id}
									onClick={() => setSelectedClaimId(claim.id)}
									role="option"
									type="button"
								>
									<span className="flex items-center justify-between gap-3">
										<span className="truncate font-medium">
											{claim.unitTitle ?? t.console.ownershipClaims.untitledUnit}
										</span>
										<Badge variant="secondary">
											{t.console.ownershipClaims.states[claim.state]}
										</Badge>
									</span>
									<span className="truncate text-muted-foreground text-xs">
										{claim.claimantLabel ?? t.console.ownershipClaims.unnamedClaimant}
									</span>
									<span className="text-muted-foreground text-xs">
										{formatter.format(new Date(claim.createdAt))}
									</span>
								</button>
							);
						})
					) : (
						<p className="p-10 text-center text-muted-foreground text-sm">
							{t.console.ownershipClaims.empty}
						</p>
					)}
					{claims.hasNextPage ? (
						<div className="border-t p-3">
							<Button
								className="w-full"
								isLoading={claims.isFetchingNextPage}
								onClick={() => void claims.fetchNextPage()}
								variant="outline"
							>
								{t.console.ownershipClaims.loadMore}
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
										{selected.unitTitle ?? t.console.ownershipClaims.untitledUnit}
									</h2>
									<p className="mt-1 text-muted-foreground text-sm">
										{selected.unitKind} · {selected.unitId}
									</p>
								</div>
								{selectedUnitHref ? (
									<Button asChild size="sm" variant="outline">
										<Link href={selectedUnitHref}>
											<ExternalLink aria-hidden />
											{t.console.ownershipClaims.openUnit}
										</Link>
									</Button>
								) : null}
							</div>
							<dl className="grid gap-4 sm:grid-cols-2">
								<div>
									<dt className="text-muted-foreground text-sm">
										{t.console.ownershipClaims.claimant}
									</dt>
									<dd className="mt-1 break-all font-medium">
										{selected.claimantLabel ?? t.console.ownershipClaims.unnamedClaimant}
									</dd>
									<dd className="break-all text-muted-foreground text-xs">
										{selected.claimantProfileId}
									</dd>
								</div>
								<div>
									<dt className="text-muted-foreground text-sm">
										{t.console.ownershipClaims.submittedAt}
									</dt>
									<dd className="mt-1 font-medium">
										{formatter.format(new Date(selected.createdAt))}
									</dd>
								</div>
							</dl>
							<div>
								<h3 className="text-muted-foreground text-sm">
									{t.console.ownershipClaims.details}
								</h3>
								<p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/35 p-4 text-sm">
									{selected.details}
								</p>
							</div>
							{selected.state === "pending" ? (
								canDecideOwnershipClaims ? (
									<div className="flex flex-wrap gap-2">
										<Button onClick={() => openDecision("approved")}>
											<Check aria-hidden />
											{t.console.ownershipClaims.approve}
										</Button>
										<Button onClick={() => openDecision("rejected")} variant="destructive">
											<X aria-hidden />
											{t.console.ownershipClaims.reject}
										</Button>
									</div>
								) : (
									<p className="text-muted-foreground text-sm">
										{t.console.ownershipClaims.readOnly}
									</p>
								)
							) : (
								<p className="text-muted-foreground text-sm">
									{t.console.ownershipClaims.resolved}
								</p>
							)}
						</div>
					) : (
						<div className="py-16 text-center">
							<h2 className="font-medium">{t.console.ownershipClaims.selectClaim}</h2>
							<p className="mt-1 text-muted-foreground text-sm">
								{t.console.ownershipClaims.selectClaimDescription}
							</p>
						</div>
					)}
				</div>
			</div>

			<Dialog
				onOpenChange={({ open }) => {
					if (!open && !decide.isPending) setDecision(null);
				}}
				open={decision !== null}
			>
				<DialogContent showCloseButton={!decide.isPending} size="sm">
					<DialogHeader
						description={
							decision === "approved"
								? t.console.ownershipClaims.approveDescription
								: t.console.ownershipClaims.rejectDescription
						}
						title={
							decision === "approved"
								? t.console.ownershipClaims.approveTitle
								: t.console.ownershipClaims.rejectTitle
						}
					/>
					<DialogBody className="grid gap-4">
						<Field required>
							<FieldLabel>{t.console.ownershipClaims.reason}</FieldLabel>
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
							<FieldLabel>{t.console.ownershipClaims.internalNote}</FieldLabel>
							<Textarea
								maxLength={2_000}
								onChange={(event) => setNote(event.currentTarget.value)}
								placeholder={t.console.ownershipClaims.notePlaceholder}
								value={note}
							/>
						</Field>
						<Field required>
							<FieldLabel>{t.console.ownershipClaims.confirmationLabel}</FieldLabel>
							<p className="mb-2 break-all text-muted-foreground text-sm">
								{selected
									? t.console.ownershipClaims.confirmationInstruction({
											claimId: selected.id,
										})
									: null}
							</p>
							<Input
								autoComplete="off"
								onChange={(event) => setConfirmationClaimId(event.currentTarget.value.trim())}
								spellCheck={false}
								value={confirmationClaimId}
							/>
						</Field>
						<RequestFailure error={decide.error} />
					</DialogBody>
					<DialogFooter>
						<Button disabled={decide.isPending} onClick={() => setDecision(null)} variant="outline">
							{t.console.cancel}
						</Button>
						<Button
							disabled={!selected || confirmationClaimId !== selected.id}
							isLoading={decide.isPending}
							onClick={() => void applyDecision()}
							variant={decision === "rejected" ? "destructive" : "solid"}
						>
							{decision === "approved"
								? t.console.ownershipClaims.confirmApprove
								: t.console.ownershipClaims.confirmReject}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</section>
	);
}
