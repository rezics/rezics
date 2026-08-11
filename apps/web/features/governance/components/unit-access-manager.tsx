"use client";

import {
	type GetApiGovernanceUnitByUnitIdAccessStatus200,
	type GetApiGovernanceUnitByUnitIdOwnershipCandidatesStatus200,
	getApiGovernanceUnitByUnitIdOwnershipCandidates,
	getApiGovernanceUnitByUnitIdOwnershipCandidatesQueryKey,
	getApiGovernanceUnitByUnitIdAccessQueryKey,
	useGetApiGovernanceUnitByUnitIdAccess,
	useGetApiGovernanceUnitByUnitIdAccessCandidates,
	usePostApiGovernanceUnitByUnitIdOwnershipRelinquishment,
	usePutApiGovernanceUnitByUnitIdAccess,
	usePutApiGovernanceUnitByUnitIdOwnership,
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
	CardDescription,
	CardHeader,
	CardTitle,
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
	PermissionMatrix,
	type PermissionMatrixLabels,
	type PermissionMatrixResource,
	QueryFailure,
	QueryPending,
	Sheet,
	SheetBody,
	SheetContent,
	SheetFooter,
	SheetHeader,
} from "@rezics/ui";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
	ArrowLeftIcon,
	KeyRoundIcon,
	PlusIcon,
	SearchIcon,
	UserRoundCogIcon,
	UsersRoundIcon,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { GovernanceRulePicker } from "./governance-rule-picker";
import type { GovernanceRuleReference } from "../model/governance-rule-selection";

type AccessSnapshot = GetApiGovernanceUnitByUnitIdAccessStatus200;
type AccessSubject = AccessSnapshot["subjects"][number];
type Permission = AccessSnapshot["permissions"][number];
type Subject = AccessSubject["subject"];
type EditableMode = "grant" | "restrict";
type MatrixValue = `${Permission}:${EditableMode}`;
type SubjectFilter = "all" | "profile" | "realm";
type OwnershipCandidate = GetApiGovernanceUnitByUnitIdOwnershipCandidatesStatus200["items"][number];
const AccessScopeOptions = [
	{ id: "root", scope: [] },
	{ id: "creditAttributions", scope: ["credit-attributions"] },
	{ id: "subjectAssociations", scope: ["subject-associations"] },
	{ id: "creditTargets", scope: ["associations", "credit"] },
	{ id: "subjectTargets", scope: ["associations", "subject"] },
] as const;
type AccessScopeId = (typeof AccessScopeOptions)[number]["id"];

function subjectKey(subject: Subject) {
	switch (subject.kind) {
		case "profile":
			return `profile:${subject.profileId}`;
		case "realm":
			return `realm:${subject.realmId}:${subject.relation}`;
		case "authenticated":
			return "authenticated";
	}
}

function matrixValue(permission: Permission, mode: EditableMode): MatrixValue {
	return `${permission}:${mode}`;
}

function accessValues(subject: Pick<AccessSubject, "grants" | "restrictions">) {
	return new Set<MatrixValue>([
		...subject.grants.map((permission) => matrixValue(permission, "grant")),
		...subject.restrictions.map((permission) => matrixValue(permission, "restrict")),
	]);
}

function displayLabel(
	subject: AccessSubject,
	labels: {
		readonly authenticated: string;
		readonly currentRealmMembers: string;
		readonly realmMembers: (input: { realm: string }) => string;
		readonly realmAccessManagers: (input: { realm: string }) => string;
	},
	target?: { readonly unitId: string; readonly unitKind: string },
) {
	if (subject.subject.kind === "authenticated") return labels.authenticated;
	if (subject.subject.kind === "profile") return subject.label ?? subjectKey(subject.subject);
	if (
		target?.unitKind === "realm" &&
		target.unitId === subject.subject.realmId &&
		subject.subject.relation === "member"
	)
		return labels.currentRealmMembers;
	const realm = subject.label ?? subject.subject.realmId;
	return subject.subject.relation === "member"
		? labels.realmMembers({ realm })
		: labels.realmAccessManagers({ realm });
}

export function UnitAccessManager({
	unitId,
	includeEntityTargetScopes = false,
}: {
	unitId: string;
	includeEntityTargetScopes?: boolean;
}) {
	const { t } = useTranslation(["governance"]);
	const [scopeId, setScopeId] = useState<AccessScopeId>("root");
	const scope = AccessScopeOptions.find((candidate) => candidate.id === scopeId)?.scope ?? [];
	const scopeOptions = includeEntityTargetScopes
		? AccessScopeOptions
		: AccessScopeOptions.filter(
				(option) => option.id !== "creditTargets" && option.id !== "subjectTargets",
			);
	return (
		<div className="grid gap-6">
			<Field>
				<FieldLabel>{t.governance.access.scopeSelectorLabel}</FieldLabel>
				<NativeSelect
					onChange={(event) => setScopeId(event.currentTarget.value as AccessScopeId)}
					value={scopeId}
				>
					{scopeOptions.map((option) => (
						<NativeSelectOption key={option.id} value={option.id}>
							{t.governance.access.scopeOptions[option.id]}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
			<ScopedUnitAccessManager key={scopeId} scope={scope} unitId={unitId} />
		</div>
	);
}

function ScopedUnitAccessManager({ unitId, scope }: { unitId: string; scope: readonly string[] }) {
	const query = useGetApiGovernanceUnitByUnitIdAccess({
		path: { unitId },
		query: { scope: [...scope] },
	});

	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	return <SubjectAccessTable scope={scope} snapshot={query.data} unitId={unitId} />;
}

function usePermissionMatrix(
	permissions: readonly Permission[],
	inherited: ReadonlySet<Permission>,
	modes: readonly EditableMode[],
) {
	const { t } = useTranslation(["governance"]);
	const resources = useMemo<PermissionMatrixResource<MatrixValue>[]>(
		() =>
			permissions.map((permission) => {
				const category = permission.startsWith("realm.")
					? t.governance.access.permissionCategories.realm
					: permission.startsWith("entity.")
						? t.governance.access.permissionCategories.entity
						: t.governance.access.permissionCategories.unit;
				return {
					id: permission,
					category,
					label: t.governance.access.permissions[permission],
					description: inherited.has(permission)
						? t.governance.access.inheritedDescription
						: undefined,
					keywords: [permission],
					actions: modes.map((mode) => ({
						value: matrixValue(permission, mode),
						label:
							mode === "grant"
								? t.governance.access.matrix.grant
								: t.governance.access.matrix.restrict,
						tone: mode === "restrict" ? ("destructive" as const) : ("default" as const),
					})),
				};
			}),
		[inherited, modes, permissions, t],
	);
	const labels: PermissionMatrixLabels = {
		templates: t.governance.access.matrix.templates,
		permissions: t.governance.access.matrix.permissions,
		searchPlaceholder: t.governance.access.matrix.searchPlaceholder,
		clear: t.governance.access.matrix.clear,
		selected: (selected, total) => t.governance.access.matrix.selected({ selected, total }),
		categorySelected: (selected) => t.governance.access.matrix.categorySelected({ selected }),
		required: t.governance.access.matrix.required,
		empty: t.governance.access.matrix.empty,
	};
	return { resources, labels };
}

function SubjectAccessTable({
	unitId,
	scope,
	snapshot,
}: {
	unitId: string;
	scope: readonly string[];
	snapshot: AccessSnapshot;
}) {
	const { t } = useTranslation(["governance"]);
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase());
	const [filter, setFilter] = useState<SubjectFilter>("all");
	const [addOpen, setAddOpen] = useState(false);
	const [transferOpen, setTransferOpen] = useState(false);
	const [relinquishOpen, setRelinquishOpen] = useState(false);
	const [selected, setSelected] = useState<AccessSubject | null>(null);
	const subjectLabels = useMemo(
		() => ({
			authenticated: t.governance.access.authenticatedLabel,
			currentRealmMembers: t.governance.access.currentRealmMembersLabel,
			realmMembers: t.governance.access.realmMembersLabel,
			realmAccessManagers: t.governance.access.realmAccessManagersLabel,
		}),
		[t],
	);
	const subjects = useMemo(() => {
		const byKey = new Map(
			snapshot.subjects.map((subject) => [subjectKey(subject.subject), subject]),
		);
		const authenticated = byKey.get("authenticated") ?? {
			subject: { kind: "authenticated" as const },
			label: null,
			grants: [],
			restrictions: [],
			inherited: [],
			expiresAt: null,
		};
		byKey.delete("authenticated");
		const targetMembersKey = `realm:${snapshot.unitId}:member`;
		const targetMembers = snapshot.unitKind === "realm" ? byKey.get(targetMembersKey) : undefined;
		byKey.delete(targetMembersKey);
		const targetMembersMatches =
			Boolean(targetMembers) &&
			(filter === "all" || filter === "realm") &&
			(!deferredSearch ||
				t.governance.access.currentRealmMembersLabel.toLocaleLowerCase().includes(deferredSearch));
		const authenticatedMatches =
			filter === "all" &&
			(!deferredSearch ||
				t.governance.access.authenticatedLabel.toLocaleLowerCase().includes(deferredSearch));
		return [
			...(targetMembersMatches && targetMembers ? [targetMembers] : []),
			...(authenticatedMatches ? [authenticated] : []),
			...[...byKey.values()].filter((subject) => {
				if (filter !== "all" && subject.subject.kind !== filter) return false;
				if (!deferredSearch) return true;
				return displayLabel(subject, subjectLabels, snapshot)
					.toLocaleLowerCase()
					.includes(deferredSearch);
			}),
		];
	}, [deferredSearch, filter, snapshot, subjectLabels, t]);
	const scrollRef = useRef<HTMLDivElement>(null);
	const virtualizer = useVirtualizer({
		count: subjects.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => 64,
		overscan: 8,
	});

	return (
		<Card appearance="outlined" className="overflow-hidden">
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<CardTitle>{t.governance.access.subjectsTitle}</CardTitle>
						<CardDescription>{t.governance.access.subjectsDescription}</CardDescription>
					</div>
					<div className="flex flex-wrap gap-2">
						{scope.length === 0 && snapshot.canTransferOwnership ? (
							<Button onClick={() => setTransferOpen(true)} type="button" variant="outline">
								<UserRoundCogIcon />
								{t.governance.access.transferOwnership}
							</Button>
						) : null}
						{scope.length === 0 && snapshot.canRelinquishOwnership ? (
							<Button onClick={() => setRelinquishOpen(true)} type="button" variant="outline">
								{t.governance.access.relinquishOwnership}
							</Button>
						) : null}
						<Button onClick={() => setAddOpen(true)} type="button">
							<PlusIcon />
							{t.governance.access.addSubject}
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div className="flex flex-col gap-3 sm:flex-row">
					<div className="relative min-w-0 flex-1">
						<SearchIcon
							aria-hidden="true"
							className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							className="ps-9"
							onChange={(event) => setSearch(event.currentTarget.value)}
							placeholder={t.governance.access.searchSubjects}
							type="search"
							value={search}
						/>
					</div>
					<div className="flex flex-wrap gap-2" aria-label={t.governance.access.filterLabel}>
						{(["all", "profile", "realm"] as const).map((kind) => (
							<Button
								aria-pressed={filter === kind}
								key={kind}
								onClick={() => setFilter(kind)}
								size="sm"
								type="button"
								variant={filter === kind ? "secondary" : "outline"}
							>
								{t.governance.access.filters[kind]}
							</Button>
						))}
					</div>
				</div>

				<div className="overflow-hidden rounded-xl border" role="table">
					<div
						className="grid grid-cols-[minmax(0,1fr)_7rem_7rem] gap-3 border-b bg-muted/32 px-4 py-3 font-medium text-muted-foreground text-sm"
						role="row"
					>
						<span role="columnheader">{t.governance.access.table.subject}</span>
						<span role="columnheader">{t.governance.access.table.kind}</span>
						<span className="text-end" role="columnheader">
							{t.governance.access.table.rules}
						</span>
					</div>
					<div className="max-h-[30rem] overflow-auto" ref={scrollRef} role="rowgroup">
						{subjects.length ? (
							<div className="relative" style={{ height: virtualizer.getTotalSize() }}>
								{virtualizer.getVirtualItems().map((virtualRow) => {
									const subject = subjects[virtualRow.index];
									if (!subject) return null;
									const isOwner =
										subject.subject.kind === "profile" &&
										snapshot.owner?.profileId === subject.subject.profileId;
									const label = displayLabel(subject, subjectLabels, snapshot);
									const isBuiltInAudience =
										subject.subject.kind === "authenticated" ||
										(subject.subject.kind === "realm" &&
											subject.subject.realmId === snapshot.unitId &&
											subject.subject.relation === "member");
									return (
										<button
											className="absolute inset-x-0 grid grid-cols-[minmax(0,1fr)_7rem_7rem] items-center gap-3 border-b px-4 text-start transition-colors hover:bg-muted/48 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
											key={subjectKey(subject.subject)}
											disabled={isOwner}
											onClick={() => setSelected(subject)}
											role="row"
											style={{
												height: virtualRow.size,
												transform: `translateY(${virtualRow.start}px)`,
											}}
											type="button"
										>
											<span className="flex min-w-0 items-center gap-3" role="cell">
												<span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted">
													{subject.subject.kind === "profile" ? (
														<KeyRoundIcon className="size-4" />
													) : (
														<UsersRoundIcon className="size-4" />
													)}
												</span>
												<span className="truncate font-medium">{label}</span>
												{isOwner ? (
													<Badge variant="secondary">{t.governance.access.owner}</Badge>
												) : null}
												{isBuiltInAudience ? (
													<Badge variant="outline">{t.governance.access.builtInAudience}</Badge>
												) : null}
											</span>
											<span className="text-muted-foreground text-sm" role="cell">
												{subject.subject.kind === "realm"
													? t.governance.access.subjectRelations[subject.subject.relation]
													: t.governance.access.subjectKinds[subject.subject.kind]}
											</span>
											<span className="text-end text-muted-foreground text-sm" role="cell">
												{t.governance.access.table.ruleCount({
													count: subject.grants.length + subject.restrictions.length,
												})}
											</span>
										</button>
									);
								})}
							</div>
						) : (
							<p className="p-10 text-center text-muted-foreground text-sm">
								{t.governance.access.table.empty}
							</p>
						)}
					</div>
				</div>
			</CardContent>

			<AddSubjectDialog
				existing={new Set(snapshot.subjects.map(({ subject }) => subjectKey(subject)))}
				onOpenChange={setAddOpen}
				onSelect={(subject) => {
					setSelected(subject);
					setAddOpen(false);
				}}
				open={addOpen}
				unitId={unitId}
			/>
			{snapshot.owner ? (
				<>
					<OwnershipTransferDialogs
						onOpenChange={setTransferOpen}
						open={transferOpen}
						scope={scope}
						snapshot={snapshot}
						unitId={unitId}
					/>
					<OwnershipRelinquishmentDialog
						onOpenChange={setRelinquishOpen}
						open={relinquishOpen}
						scope={scope}
						snapshot={snapshot}
						unitId={unitId}
					/>
				</>
			) : null}
			{selected ? (
				<SubjectAccessSheet
					key={subjectKey(selected.subject)}
					onOpenChange={(open) => {
						if (!open) setSelected(null);
					}}
					permissions={snapshot.permissions}
					authenticatedPermissions={snapshot.authenticatedGrantablePermissions}
					scope={scope}
					subject={selected}
					target={{ unitId: snapshot.unitId, unitKind: snapshot.unitKind }}
					unitId={unitId}
				/>
			) : null}
		</Card>
	);
}

function candidateLabel(candidate: OwnershipCandidate) {
	return candidate.label ?? candidate.slug ?? candidate.profileId;
}

function OwnershipTransferDialogs({
	unitId,
	scope,
	snapshot,
	open,
	onOpenChange,
}: {
	readonly unitId: string;
	readonly scope: readonly string[];
	readonly snapshot: AccessSnapshot;
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
}) {
	const { t } = useTranslation(["governance"]);
	const queryClient = useQueryClient();
	const owner = snapshot.owner;
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search.trim());
	const [selected, setSelected] = useState<OwnershipCandidate | null>(null);
	const [confirmationOpen, setConfirmationOpen] = useState(false);
	const baseQuery = useMemo(
		() => ({
			limit: 50,
			...(deferredSearch ? { query: deferredSearch } : {}),
		}),
		[deferredSearch],
	);
	const candidates = useInfiniteQuery({
		queryKey: getApiGovernanceUnitByUnitIdOwnershipCandidatesQueryKey({
			path: { unitId },
			query: baseQuery,
		}),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiGovernanceUnitByUnitIdOwnershipCandidates({
				path: { unitId },
				query: { ...baseQuery, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
		enabled: open,
	});
	const items = candidates.data?.pages.flatMap((page) => page.items) ?? [];
	const scrollRef = useRef<HTMLDivElement>(null);
	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => 60,
		overscan: 8,
	});
	const virtualRows = virtualizer.getVirtualItems();
	const lastVirtualIndex = virtualRows.at(-1)?.index;
	useEffect(() => {
		if (
			lastVirtualIndex !== undefined &&
			lastVirtualIndex >= items.length - 6 &&
			candidates.hasNextPage &&
			!candidates.isFetchingNextPage
		)
			void candidates.fetchNextPage();
	}, [
		candidates.fetchNextPage,
		candidates.hasNextPage,
		candidates.isFetchingNextPage,
		items.length,
		lastVirtualIndex,
	]);
	const transfer = usePutApiGovernanceUnitByUnitIdOwnership();

	async function confirmTransfer() {
		if (!owner || !selected || transfer.isPending) return;
		try {
			await transfer.mutateAsync({
				path: { unitId },
				body: {
					expectedOwnerProfileId: owner.profileId,
					targetProfileId: selected.profileId,
				},
			});
			await queryClient.invalidateQueries({
				queryKey: getApiGovernanceUnitByUnitIdAccessQueryKey({
					path: { unitId },
					query: { scope: [...scope] },
				}),
			});
			setConfirmationOpen(false);
			setSelected(null);
			onOpenChange(false);
		} catch {
			// The typed mutation state renders the request failure below.
		}
	}

	return (
		<>
			<Dialog
				onOpenChange={({ open: next }) => {
					if (!transfer.isPending) onOpenChange(next);
				}}
				open={open}
			>
				<DialogContent size="lg">
					<DialogHeader
						description={t.governance.access.transferOwnershipDescription}
						title={t.governance.access.transferOwnership}
					/>
					<DialogBody className="grid gap-4">
						<div className="relative">
							<SearchIcon
								aria-hidden
								className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								aria-label={t.governance.access.searchOwnershipCandidates}
								className="ps-9"
								onChange={(event) => setSearch(event.currentTarget.value)}
								placeholder={t.governance.access.searchOwnershipCandidates}
								type="search"
								value={search}
							/>
						</div>
						{candidates.isError ? (
							<QueryFailure error={candidates.error} retry={() => void candidates.refetch()} />
						) : candidates.isPending ? (
							<QueryPending />
						) : items.length ? (
							<div
								aria-label={t.governance.access.ownershipCandidates}
								className="h-80 overflow-auto rounded-xl border"
								ref={scrollRef}
								role="listbox"
							>
								<div className="relative" style={{ height: virtualizer.getTotalSize() }}>
									{virtualRows.map((virtualRow) => {
										const candidate = items[virtualRow.index];
										if (!candidate) return null;
										return (
											<button
												aria-selected="false"
												className="absolute inset-x-0 flex items-center justify-between gap-4 border-b px-4 text-start hover:bg-muted/48 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
												key={candidate.profileId}
												onClick={() => {
													setSelected(candidate);
													onOpenChange(false);
													setConfirmationOpen(true);
												}}
												role="option"
												style={{
													height: virtualRow.size,
													transform: `translateY(${virtualRow.start}px)`,
												}}
												type="button"
											>
												<span className="min-w-0">
													<span className="block truncate font-medium">
														{candidateLabel(candidate)}
													</span>
													<span className="block truncate text-muted-foreground text-xs">
														{candidate.slug ? `@${candidate.slug}` : candidate.profileId}
													</span>
												</span>
												<span className="text-muted-foreground text-sm">
													{t.governance.access.selectOwnershipCandidate}
												</span>
											</button>
										);
									})}
								</div>
							</div>
						) : (
							<p className="rounded-xl border p-8 text-center text-muted-foreground text-sm">
								{t.governance.access.noOwnershipCandidates}
							</p>
						)}
					</DialogBody>
				</DialogContent>
			</Dialog>

			<Dialog
				onOpenChange={({ open: next }) => {
					if (!transfer.isPending) setConfirmationOpen(next);
				}}
				open={confirmationOpen}
			>
				<DialogContent size="md">
					<DialogHeader
						description={
							selected
								? t.governance.access.confirmTransferDescription({
										unit: snapshot.unitTitle ?? t.governance.access.untitledOwnershipUnit,
										profile: candidateLabel(selected),
									})
								: undefined
						}
						title={t.governance.access.confirmTransferTitle}
					/>
					<DialogBody className="grid gap-4">
						<p className="rounded-lg bg-destructive/8 p-4 text-sm">
							{t.governance.access.transferOwnershipWarning}
						</p>
						<RequestFailure error={transfer.error} />
					</DialogBody>
					<DialogFooter>
						<Button
							disabled={transfer.isPending}
							onClick={() => {
								setConfirmationOpen(false);
								onOpenChange(true);
							}}
							type="button"
							variant="outline"
						>
							<ArrowLeftIcon />
							{t.governance.access.backToOwnershipCandidates}
						</Button>
						<Button
							isLoading={transfer.isPending}
							onClick={() => void confirmTransfer()}
							type="button"
							variant="destructive"
						>
							{t.governance.access.confirmTransfer}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function OwnershipRelinquishmentDialog({
	unitId,
	scope,
	snapshot,
	open,
	onOpenChange,
}: {
	readonly unitId: string;
	readonly scope: readonly string[];
	readonly snapshot: AccessSnapshot;
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
}) {
	const { t } = useTranslation(["governance"]);
	const queryClient = useQueryClient();
	const owner = snapshot.owner;
	const relinquish = usePostApiGovernanceUnitByUnitIdOwnershipRelinquishment();

	async function confirm() {
		if (!owner) return;
		try {
			await relinquish.mutateAsync({
				path: { unitId },
				body: { expectedOwnerProfileId: owner.profileId },
			});
			await queryClient.invalidateQueries({
				queryKey: getApiGovernanceUnitByUnitIdAccessQueryKey({
					path: { unitId },
					query: { scope: [...scope] },
				}),
			});
			onOpenChange(false);
		} catch {
			// The typed mutation state renders the request failure below.
		}
	}

	return (
		<AlertDialog
			onOpenChange={({ open: next }) => {
				if (!relinquish.isPending) onOpenChange(next);
			}}
			open={open}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t.governance.access.relinquishOwnershipTitle}</AlertDialogTitle>
					<AlertDialogDescription>
						{t.governance.access.relinquishOwnershipDescription}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<RequestFailure error={relinquish.error} />
				<AlertDialogFooter>
					<AlertDialogCancel disabled={relinquish.isPending}>
						{t.governance.access.cancel}
					</AlertDialogCancel>
					<AlertDialogAction
						isLoading={relinquish.isPending}
						onClick={() => void confirm()}
						variant="destructive"
					>
						{t.governance.access.confirmRelinquishment}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function AddSubjectDialog({
	unitId,
	open,
	onOpenChange,
	onSelect,
	existing,
}: {
	unitId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelect: (subject: AccessSubject) => void;
	existing: ReadonlySet<string>;
}) {
	const { t } = useTranslation(["governance"]);
	const [kind, setKind] = useState<"profile" | "realm">("profile");
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search.trim());
	const query = useGetApiGovernanceUnitByUnitIdAccessCandidates(
		{
			path: { unitId },
			query: { kind, query: deferredSearch || undefined, limit: 30 },
		},
		{ query: { enabled: open } },
	);

	return (
		<Dialog onOpenChange={({ open: next }) => onOpenChange(next)} open={open}>
			<DialogContent size="lg">
				<DialogHeader
					description={t.governance.access.addSubjectDescription}
					title={t.governance.access.addSubject}
				/>
				<DialogBody className="grid gap-4">
					<div className="flex gap-2">
						{(["profile", "realm"] as const).map((candidateKind) => (
							<Button
								aria-pressed={kind === candidateKind}
								key={candidateKind}
								onClick={() => setKind(candidateKind)}
								size="sm"
								type="button"
								variant={kind === candidateKind ? "secondary" : "outline"}
							>
								{t.governance.access.subjectKinds[candidateKind]}
							</Button>
						))}
					</div>
					<div className="relative">
						<SearchIcon
							aria-hidden="true"
							className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							className="ps-9"
							onChange={(event) => setSearch(event.currentTarget.value)}
							placeholder={t.governance.access.searchCandidates}
							type="search"
							value={search}
						/>
					</div>
					{query.isPending ? <QueryPending /> : null}
					{query.isError ? (
						<QueryFailure error={query.error} retry={() => void query.refetch()} />
					) : null}
					{query.data ? (
						<div className="divide-y overflow-hidden rounded-xl border">
							{query.data.items.length ? (
								query.data.items.map((candidate) => {
									const key = subjectKey(candidate.subject);
									const isExisting = existing.has(key);
									return (
										<button
											className="flex w-full items-center justify-between gap-4 p-3 text-start hover:bg-muted/48 disabled:cursor-not-allowed disabled:opacity-50"
											disabled={isExisting}
											key={key}
											onClick={() =>
												onSelect({
													...candidate,
													grants: [],
													restrictions: [],
													inherited: [],
													expiresAt: null,
												})
											}
											type="button"
										>
											<span className="truncate font-medium">{candidate.label ?? key}</span>
											{isExisting ? (
												<Badge variant="outline">{t.governance.access.alreadyAdded}</Badge>
											) : null}
										</button>
									);
								})
							) : (
								<p className="p-8 text-center text-muted-foreground text-sm">
									{t.governance.access.noCandidates}
								</p>
							)}
						</div>
					) : null}
				</DialogBody>
			</DialogContent>
		</Dialog>
	);
}

function SubjectAccessSheet({
	unitId,
	permissions,
	authenticatedPermissions,
	scope,
	subject,
	target,
	onOpenChange,
}: {
	unitId: string;
	permissions: readonly Permission[];
	authenticatedPermissions: readonly Permission[];
	scope: readonly string[];
	subject: AccessSubject;
	target: { readonly unitId: string; readonly unitKind: string };
	onOpenChange: (open: boolean) => void;
}) {
	const { t } = useTranslation(["governance"]);
	const queryClient = useQueryClient();
	const [value, setValue] = useState<ReadonlySet<MatrixValue>>(() => accessValues(subject));
	const [rules, setRules] = useState<GovernanceRuleReference[]>([]);
	const mutation = usePutApiGovernanceUnitByUnitIdAccess();
	const isAuthenticated = subject.subject.kind === "authenticated";
	const editablePermissions = isAuthenticated ? authenticatedPermissions : permissions;
	const { resources, labels } = usePermissionMatrix(
		editablePermissions,
		new Set(subject.inherited),
		isAuthenticated ? ["grant"] : ["grant", "restrict"],
	);
	const label = displayLabel(
		subject,
		{
			authenticated: t.governance.access.authenticatedLabel,
			currentRealmMembers: t.governance.access.currentRealmMembersLabel,
			realmMembers: t.governance.access.realmMembersLabel,
			realmAccessManagers: t.governance.access.realmAccessManagersLabel,
		},
		target,
	);
	const grants = editablePermissions.filter((permission) =>
		value.has(matrixValue(permission, "grant")),
	);
	const restrictions = isAuthenticated
		? []
		: editablePermissions.filter((permission) => value.has(matrixValue(permission, "restrict")));
	const restrictionPolicyTouched = restrictions.length > 0 || subject.restrictions.length > 0;

	async function save() {
		if (restrictionPolicyTouched && rules.length === 0) return;
		try {
			const snapshot = await mutation.mutateAsync({
				path: { unitId },
				body: restrictionPolicyTouched
					? {
							subject: subject.subject,
							grants,
							restrictions,
							rules,
							scope: [...scope],
						}
					: {
							subject: subject.subject,
							grants,
							restrictions,
							scope: [...scope],
						},
			});
			queryClient.setQueryData(
				getApiGovernanceUnitByUnitIdAccessQueryKey({
					path: { unitId },
					query: { scope: [...scope] },
				}),
				snapshot,
			);
			onOpenChange(false);
		} catch {
			// The typed mutation state renders the request failure below.
		}
	}

	return (
		<Sheet onOpenChange={({ open }) => onOpenChange(open)} open>
			<SheetContent className="sm:max-w-2xl" placement="right">
				<SheetHeader
					description={t.governance.access.editorDescription}
					title={t.governance.access.editorTitle({ subject: label })}
				/>
				<SheetBody>
					<PermissionMatrix
						labels={labels}
						onValueChange={setValue}
						resources={resources}
						singlePerResource
						value={value}
					/>
					{restrictionPolicyTouched ? (
						<GovernanceRulePicker
							authority={{ kind: "unit", id: unitId }}
							onValueChange={setRules}
							value={rules}
						/>
					) : null}
					<RequestFailure error={mutation.error} />
				</SheetBody>
				<SheetFooter>
					<Button onClick={() => onOpenChange(false)} type="button" variant="outline">
						{t.governance.access.cancel}
					</Button>
					<Button
						disabled={mutation.isPending || (restrictionPolicyTouched && rules.length === 0)}
						onClick={() => void save()}
						type="button"
					>
						{mutation.isPending ? t.governance.access.saving : t.governance.access.save}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
