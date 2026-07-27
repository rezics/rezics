"use client";

import {
	type GetApiGovernanceUnitByUnitIdAccessStatus200,
	getApiGovernanceUnitByUnitIdAccessQueryKey,
	useGetApiGovernanceUnitByUnitIdAccess,
	useGetApiGovernanceUnitByUnitIdAccessCandidates,
	usePutApiGovernanceUnitByUnitIdAccess,
} from "@rezics/openapi-tanstack-query";
import {
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
	DialogHeader,
	Input,
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
import { KeyRoundIcon, PlusIcon, SearchIcon, UsersRoundIcon } from "lucide-react";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";

type AccessSnapshot = GetApiGovernanceUnitByUnitIdAccessStatus200;
type AccessSubject = AccessSnapshot["subjects"][number];
type Permission = AccessSnapshot["permissions"][number];
type Subject = AccessSubject["subject"];
type EditableMode = "grant" | "restrict";
type MatrixValue = `${Permission}:${EditableMode}`;
type SubjectFilter = "all" | "profile" | "realm";
const AuthenticatedPermissions = new Set<Permission>([
	"unit.read",
	"unit.update",
	"realm.contribute",
	"entity.association.credit.request",
	"entity.association.credit.direct",
	"entity.association.subject.request",
	"entity.association.subject.direct",
]);

function subjectKey(subject: Subject) {
	switch (subject.kind) {
		case "profile":
			return `profile:${subject.profileId}`;
		case "realm":
			return `realm:${subject.realmId}`;
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

function displayLabel(subject: AccessSubject, authenticatedLabel: string) {
	if (subject.subject.kind === "authenticated") return authenticatedLabel;
	return subject.label ?? subjectKey(subject.subject);
}

export function UnitAccessManager({ unitId }: { unitId: string }) {
	const { t } = useTranslation(["governance"]);
	const query = useGetApiGovernanceUnitByUnitIdAccess({ path: { unitId } });

	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	const authenticated = query.data.subjects.find(
		(subject) => subject.subject.kind === "authenticated",
	) ?? {
		subject: { kind: "authenticated" as const },
		label: t.governance.access.authenticatedLabel,
		grants: [],
		restrictions: [],
		inherited: [],
		expiresAt: null,
	};

	return (
		<div className="grid gap-6">
			<Card appearance="outlined">
				<CardHeader>
					<CardTitle>{t.governance.access.publicTitle}</CardTitle>
					<CardDescription>{t.governance.access.publicDescription}</CardDescription>
				</CardHeader>
				<CardContent>
					<InlineSubjectEditor
						permissions={query.data.permissions.filter((permission) =>
							AuthenticatedPermissions.has(permission),
						)}
						subject={authenticated}
						unitId={unitId}
					/>
				</CardContent>
			</Card>

			<SubjectAccessTable snapshot={query.data} unitId={unitId} />
		</div>
	);
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

function InlineSubjectEditor({
	unitId,
	permissions,
	subject,
}: {
	unitId: string;
	permissions: readonly Permission[];
	subject: AccessSubject;
}) {
	const { t } = useTranslation(["governance"]);
	const queryClient = useQueryClient();
	const [value, setValue] = useState<ReadonlySet<MatrixValue>>(() => accessValues(subject));
	const { resources, labels } = usePermissionMatrix(permissions, new Set(subject.inherited), [
		"grant",
	]);
	const mutation = usePutApiGovernanceUnitByUnitIdAccess();

	async function save() {
		try {
			const snapshot = await mutation.mutateAsync({
				path: { unitId },
				body: {
					subject: subject.subject,
					grants: permissions.filter((permission) =>
						value.has(matrixValue(permission, "grant")),
					),
					restrictions: [],
					scope: [],
				},
			});
			queryClient.setQueryData(
				getApiGovernanceUnitByUnitIdAccessQueryKey({ path: { unitId } }),
				snapshot,
			);
		} catch {
			// The typed mutation state renders the request failure below.
		}
	}

	return (
		<div className="grid gap-4">
			<PermissionMatrix
				labels={labels}
				onValueChange={setValue}
				resources={resources}
				singlePerResource
				value={value}
			/>
			<div className="flex justify-end">
				<Button disabled={mutation.isPending} onClick={() => void save()} type="button">
					{mutation.isPending ? t.governance.access.saving : t.governance.access.save}
				</Button>
			</div>
			<RequestFailure error={mutation.error} />
		</div>
	);
}

function SubjectAccessTable({ unitId, snapshot }: { unitId: string; snapshot: AccessSnapshot }) {
	const { t } = useTranslation(["governance"]);
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase());
	const [filter, setFilter] = useState<SubjectFilter>("all");
	const [addOpen, setAddOpen] = useState(false);
	const [selected, setSelected] = useState<AccessSubject | null>(null);
	const subjects = useMemo(
		() =>
			snapshot.subjects.filter((subject) => {
				if (subject.subject.kind === "authenticated") return false;
				if (filter !== "all" && subject.subject.kind !== filter) return false;
				if (!deferredSearch) return true;
				return displayLabel(subject, t.governance.access.authenticatedLabel)
					.toLocaleLowerCase()
					.includes(deferredSearch);
			}),
		[deferredSearch, filter, snapshot.subjects, t],
	);
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
					<Button onClick={() => setAddOpen(true)} type="button">
						<PlusIcon />
						{t.governance.access.addSubject}
					</Button>
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
					<div
						className="flex flex-wrap gap-2"
						aria-label={t.governance.access.filterLabel}
					>
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
							<div
								className="relative"
								style={{ height: virtualizer.getTotalSize() }}
							>
								{virtualizer.getVirtualItems().map((virtualRow) => {
									const subject = subjects[virtualRow.index];
									if (!subject) return null;
									const isOwner =
										subject.subject.kind === "profile" &&
										snapshot.owner?.profileId === subject.subject.profileId;
									const label = displayLabel(
										subject,
										t.governance.access.authenticatedLabel,
									);
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
											<span
												className="flex min-w-0 items-center gap-3"
												role="cell"
											>
												<span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted">
													{subject.subject.kind === "profile" ? (
														<KeyRoundIcon className="size-4" />
													) : (
														<UsersRoundIcon className="size-4" />
													)}
												</span>
												<span className="truncate font-medium">
													{label}
												</span>
												{isOwner ? (
													<Badge variant="secondary">
														{t.governance.access.owner}
													</Badge>
												) : null}
											</span>
											<span
												className="text-muted-foreground text-sm"
												role="cell"
											>
												{
													t.governance.access.subjectKinds[
														subject.subject.kind
													]
												}
											</span>
											<span
												className="text-end text-muted-foreground text-sm"
												role="cell"
											>
												{t.governance.access.table.ruleCount({
													count:
														subject.grants.length +
														subject.restrictions.length,
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
			{selected ? (
				<SubjectAccessSheet
					key={subjectKey(selected.subject)}
					onOpenChange={(open) => {
						if (!open) setSelected(null);
					}}
					permissions={snapshot.permissions}
					subject={selected}
					unitId={unitId}
				/>
			) : null}
		</Card>
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
											<span className="truncate font-medium">
												{candidate.label ?? key}
											</span>
											{isExisting ? (
												<Badge variant="outline">
													{t.governance.access.alreadyAdded}
												</Badge>
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
	subject,
	onOpenChange,
}: {
	unitId: string;
	permissions: readonly Permission[];
	subject: AccessSubject;
	onOpenChange: (open: boolean) => void;
}) {
	const { t } = useTranslation(["governance"]);
	const queryClient = useQueryClient();
	const [value, setValue] = useState<ReadonlySet<MatrixValue>>(() => accessValues(subject));
	const mutation = usePutApiGovernanceUnitByUnitIdAccess();
	const { resources, labels } = usePermissionMatrix(permissions, new Set(subject.inherited), [
		"grant",
		"restrict",
	]);
	const label = displayLabel(subject, t.governance.access.authenticatedLabel);

	async function save() {
		try {
			const snapshot = await mutation.mutateAsync({
				path: { unitId },
				body: {
					subject: subject.subject,
					grants: permissions.filter((permission) =>
						value.has(matrixValue(permission, "grant")),
					),
					restrictions: permissions.filter((permission) =>
						value.has(matrixValue(permission, "restrict")),
					),
					scope: [],
				},
			});
			queryClient.setQueryData(
				getApiGovernanceUnitByUnitIdAccessQueryKey({ path: { unitId } }),
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
					<RequestFailure error={mutation.error} />
				</SheetBody>
				<SheetFooter>
					<Button onClick={() => onOpenChange(false)} type="button" variant="outline">
						{t.governance.access.cancel}
					</Button>
					<Button disabled={mutation.isPending} onClick={() => void save()} type="button">
						{mutation.isPending ? t.governance.access.saving : t.governance.access.save}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
