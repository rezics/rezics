"use client";

import {
	GetApiGovernancePlatformUnitsState,
	PostApiGovernancePlatformUnitsByUnitIdOwnershipOverrideRequestReasonCodeEnum,
	PostApiGovernancePlatformUnitsByUnitIdDeleteRequestReasonCodeEnum,
	getApiGovernancePlatformUnits,
	getApiGovernancePlatformUnitsQueryKey,
	getApiGovernancePlatformUnitsByUnitIdOwnershipCandidates,
	getApiGovernancePlatformUnitsByUnitIdOwnershipCandidatesQueryKey,
	type GetApiGovernancePlatformUnitsByUnitIdOwnershipCandidatesStatus200,
	type GetApiGovernancePlatformUnitsState as UnitListState,
	type GetApiGovernancePlatformUnitsStatus200,
	type PostApiGovernancePlatformUnitsByUnitIdOwnershipOverrideRequestReasonCodeEnum as OwnershipGovernanceReasonCode,
	type PostApiGovernancePlatformUnitsByUnitIdDeleteRequestReasonCodeEnum as GovernanceReasonCode,
	usePostApiGovernancePlatformUnitsByUnitIdDelete,
	usePostApiGovernancePlatformUnitsByUnitIdOwnershipOverride,
	usePostApiGovernancePlatformUnitsByUnitIdRestore,
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
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArchiveRestore, Search, Trash2, UserRoundCog } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useConsoleWorkspace } from "../components/console-workspace";

type PlatformUnit = GetApiGovernancePlatformUnitsStatus200["items"][number];
type OwnershipCandidate =
	GetApiGovernancePlatformUnitsByUnitIdOwnershipCandidatesStatus200["items"][number];
type LifecycleCommand = "delete" | "restore";

const UnitListStates = Object.values(GetApiGovernancePlatformUnitsState);
const GovernanceReasonCodes = Object.values(
	PostApiGovernancePlatformUnitsByUnitIdDeleteRequestReasonCodeEnum,
);
const OwnershipGovernanceReasonCodes = Object.values(
	PostApiGovernancePlatformUnitsByUnitIdOwnershipOverrideRequestReasonCodeEnum,
);

export function ConsoleUnitsPage() {
	const { locale, t } = useTranslation(["console", "errors", "realms"]);
	const { canReadUnits, canDeleteUnits, canRestoreUnits, canOverrideUnitOwnership } =
		useConsoleWorkspace();
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search.trim());
	const [state, setState] = useState<UnitListState>("active");
	const [selectedUnitId, setSelectedUnitId] = useState("");
	const [command, setCommand] = useState<LifecycleCommand | null>(null);
	const [reasonCode, setReasonCode] = useState<GovernanceReasonCode>("administrative");
	const [note, setNote] = useState("");
	const [confirmationUnitId, setConfirmationUnitId] = useState("");
	const baseQuery = useMemo(
		() => ({
			state,
			limit: 50,
			...(deferredSearch ? { query: deferredSearch } : {}),
		}),
		[deferredSearch, state],
	);
	const units = useInfiniteQuery({
		queryKey: getApiGovernancePlatformUnitsQueryKey({ query: baseQuery }),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiGovernancePlatformUnits({
				query: { ...baseQuery, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
		enabled: canReadUnits,
	});
	const items = units.data?.pages.flatMap((page) => page.items) ?? [];
	const selected = items.find((item) => item.id === selectedUnitId) ?? items[0];
	const scrollRef = useRef<HTMLDivElement>(null);
	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => 78,
		overscan: 8,
	});
	const virtualRows = virtualizer.getVirtualItems();
	const lastVirtualIndex = virtualRows.at(-1)?.index;
	useEffect(() => {
		if (
			lastVirtualIndex !== undefined &&
			lastVirtualIndex >= items.length - 6 &&
			units.hasNextPage &&
			!units.isFetchingNextPage
		)
			void units.fetchNextPage();
	}, [
		items.length,
		lastVirtualIndex,
		units.fetchNextPage,
		units.hasNextPage,
		units.isFetchingNextPage,
	]);
	const remove = usePostApiGovernancePlatformUnitsByUnitIdDelete();
	const restore = usePostApiGovernancePlatformUnitsByUnitIdRestore();
	const pending = remove.isPending || restore.isPending;
	const mutationError = command === "restore" ? restore.error : remove.error;

	if (!canReadUnits) return <p className="text-destructive text-sm">{t.errors.forbidden}</p>;
	if (units.isPending) return <QueryPending />;
	if (units.isError) return <QueryFailure error={units.error} retry={() => void units.refetch()} />;

	function openCommand(nextCommand: LifecycleCommand) {
		setCommand(nextCommand);
		setReasonCode("administrative");
		setNote("");
		setConfirmationUnitId("");
	}

	async function applyCommand() {
		if (!selected || !command || confirmationUnitId !== selected.id || pending) return;
		const body = {
			expectedUpdatedAt: selected.updatedAt,
			confirmationUnitId,
			reasonCode,
			...(note.trim() ? { note: note.trim() } : {}),
		};
		try {
			if (command === "delete") await remove.mutateAsync({ path: { unitId: selected.id }, body });
			else await restore.mutateAsync({ path: { unitId: selected.id }, body });
			await queryClient.invalidateQueries({
				queryKey: getApiGovernancePlatformUnitsQueryKey({ query: baseQuery }),
			});
			setCommand(null);
		} catch {
			// The typed mutation state renders the request failure below.
		}
	}

	return (
		<section className="flex h-full min-h-0 flex-col">
			<header className="border-border/70 border-b px-4 py-4 md:px-6">
				<h1 className="font-semibold text-xl tracking-tight">{t.console.sections.units.label}</h1>
				<p className="mt-1 text-muted-foreground text-sm">{t.console.sections.units.description}</p>
			</header>
			<div className="grid min-h-0 flex-1 lg:grid-cols-[24rem_minmax(0,1fr)]">
				<div className="flex min-h-0 flex-col border-border/70 lg:border-e">
					<div className="grid gap-3 border-border/70 border-b p-3">
						<label className="relative">
							<Search
								aria-hidden
								className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								aria-label={t.console.units.searchLabel}
								className="ps-9"
								onChange={(event) => setSearch(event.currentTarget.value)}
								placeholder={t.console.units.searchPlaceholder}
								type="search"
								value={search}
							/>
						</label>
						<Field>
							<FieldLabel>{t.console.units.stateFilter}</FieldLabel>
							<NativeSelect
								onChange={(event) => {
									const next = UnitListStates.find(
										(candidate) => candidate === event.currentTarget.value,
									);
									if (next) setState(next);
								}}
								value={state}
							>
								{UnitListStates.map((value) => (
									<NativeSelectOption key={value} value={value}>
										{t.console.units.states[value]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
					</div>
					<div
						aria-label={t.console.units.listLabel}
						className="min-h-0 flex-1 overflow-auto"
						ref={scrollRef}
						role="listbox"
					>
						{items.length ? (
							<div className="relative" style={{ height: virtualizer.getTotalSize() }}>
								{virtualRows.map((virtualRow) => {
									const item = items[virtualRow.index];
									if (!item) return null;
									const isSelected = selected?.id === item.id;
									return (
										<button
											aria-selected={isSelected}
											className={cn(
												"absolute inset-x-0 grid gap-1 border-b px-4 py-3 text-start hover:bg-muted/48 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
												isSelected && "bg-primary/8",
											)}
											key={item.id}
											onClick={() => setSelectedUnitId(item.id)}
											role="option"
											style={{
												height: virtualRow.size,
												transform: `translateY(${virtualRow.start}px)`,
											}}
											type="button"
										>
											<span className="truncate font-medium">
												{item.title ?? t.console.units.untitled}
											</span>
											<span className="flex min-w-0 items-center gap-2 text-muted-foreground text-xs">
												<code>{item.kind}</code>
												<span aria-hidden>·</span>
												<span className="truncate">{item.id}</span>
											</span>
										</button>
									);
								})}
							</div>
						) : (
							<p className="p-10 text-center text-muted-foreground text-sm">
								{t.console.units.empty}
							</p>
						)}
					</div>
				</div>

				<div className="min-h-0 overflow-y-auto p-4 md:p-6">
					{selected ? (
						<div className="mx-auto grid max-w-3xl gap-6">
							<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
								<div className="min-w-0">
									<h2 className="truncate font-semibold text-2xl">
										{selected.title ?? t.console.units.untitled}
									</h2>
									<p className="mt-1 break-all text-muted-foreground text-sm">{selected.id}</p>
								</div>
								<div className="flex flex-wrap gap-2">
									<Badge variant="outline">{t.console.units.statuses[selected.status]}</Badge>
									<Badge variant={selected.deletedAt ? "destructive" : "secondary"}>
										{selected.deletedAt ? t.console.units.deleted : t.console.units.active}
									</Badge>
									{selected.protected ? (
										<Badge variant="outline">{t.console.units.protected}</Badge>
									) : null}
								</div>
							</div>
							<dl className="grid gap-4 rounded-xl border p-5 sm:grid-cols-2">
								<div>
									<dt className="text-muted-foreground text-sm">{t.console.units.kind}</dt>
									<dd className="mt-1 font-medium">
										<code>{selected.kind}</code>
									</dd>
								</div>
								<div>
									<dt className="text-muted-foreground text-sm">{t.console.units.owner}</dt>
									<dd className="mt-1 font-medium">
										{selected.owner?.label ?? selected.owner?.profileId ?? t.console.units.noOwner}
									</dd>
								</div>
								<div>
									<dt className="text-muted-foreground text-sm">{t.console.units.updatedAt}</dt>
									<dd className="mt-1">
										{new Intl.DateTimeFormat(locale.target, {
											dateStyle: "medium",
											timeStyle: "short",
										}).format(new Date(selected.updatedAt))}
									</dd>
								</div>
								{selected.deletedAt ? (
									<div>
										<dt className="text-muted-foreground text-sm">{t.console.units.deletedAt}</dt>
										<dd className="mt-1">
											{new Intl.DateTimeFormat(locale.target, {
												dateStyle: "medium",
												timeStyle: "short",
											}).format(new Date(selected.deletedAt))}
										</dd>
									</div>
								) : null}
							</dl>
							<div className="flex flex-wrap gap-3">
								{canOverrideUnitOwnership ? <OwnershipOverrideControl item={selected} /> : null}
								{selected.deletedAt ? (
									canRestoreUnits ? (
										<Button onClick={() => openCommand("restore")} type="button">
											<ArchiveRestore />
											{t.console.units.restore}
										</Button>
									) : null
								) : canDeleteUnits ? (
									<Button
										disabled={selected.protected}
										onClick={() => openCommand("delete")}
										type="button"
										variant="destructive"
									>
										<Trash2 />
										{t.console.units.softDelete}
									</Button>
								) : null}
							</div>
							{selected.protected ? (
								<p className="text-muted-foreground text-sm">
									{t.console.units.protectedDescription}
								</p>
							) : null}
						</div>
					) : (
						<div className="grid min-h-80 place-items-center text-center">
							<div>
								<h2 className="font-semibold text-lg">{t.console.units.selectUnit}</h2>
								<p className="mt-1 text-muted-foreground text-sm">
									{t.console.units.selectUnitDescription}
								</p>
							</div>
						</div>
					)}
				</div>
			</div>

			<LifecycleCommandDialog
				command={command}
				confirmationUnitId={confirmationUnitId}
				item={selected}
				mutationError={mutationError}
				note={note}
				onApply={() => void applyCommand()}
				onCommandChange={setCommand}
				onConfirmationUnitIdChange={setConfirmationUnitId}
				onNoteChange={setNote}
				onReasonCodeChange={setReasonCode}
				pending={pending}
				reasonCode={reasonCode}
			/>
		</section>
	);
}

function OwnershipOverrideControl({ item }: { readonly item: PlatformUnit }) {
	const { t } = useTranslation(["console", "realms"]);
	const queryClient = useQueryClient();
	const [step, setStep] = useState<"picker" | "confirmation" | null>(null);
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search.trim());
	const [candidate, setCandidate] = useState<OwnershipCandidate | null>(null);
	const [reasonCode, setReasonCode] = useState<OwnershipGovernanceReasonCode>("administrative");
	const [note, setNote] = useState("");
	const [confirmationUnitId, setConfirmationUnitId] = useState("");
	const candidateQuery = useMemo(
		() => ({
			limit: 50,
			...(deferredSearch ? { query: deferredSearch } : {}),
		}),
		[deferredSearch],
	);
	const candidates = useInfiniteQuery({
		queryKey: getApiGovernancePlatformUnitsByUnitIdOwnershipCandidatesQueryKey({
			path: { unitId: item.id },
			query: candidateQuery,
		}),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiGovernancePlatformUnitsByUnitIdOwnershipCandidates({
				path: { unitId: item.id },
				query: {
					...candidateQuery,
					...(pageParam ? { cursor: pageParam } : {}),
				},
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
		enabled: step === "picker",
	});
	const items = candidates.data?.pages.flatMap((page) => page.items) ?? [];
	const candidateScrollRef = useRef<HTMLDivElement>(null);
	const candidateVirtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => candidateScrollRef.current,
		estimateSize: () => 68,
		overscan: 8,
	});
	const candidateRows = candidateVirtualizer.getVirtualItems();
	const lastCandidateIndex = candidateRows.at(-1)?.index;
	useEffect(() => {
		if (
			lastCandidateIndex !== undefined &&
			lastCandidateIndex >= items.length - 6 &&
			candidates.hasNextPage &&
			!candidates.isFetchingNextPage
		)
			void candidates.fetchNextPage();
	}, [
		candidates.fetchNextPage,
		candidates.hasNextPage,
		candidates.isFetchingNextPage,
		items.length,
		lastCandidateIndex,
	]);
	const overrideOwnership = usePostApiGovernancePlatformUnitsByUnitIdOwnershipOverride();
	const currentOwner = item.owner?.label ?? item.owner?.profileId ?? t.console.units.noOwner;
	const candidateName =
		candidate?.label ?? candidate?.slug ?? candidate?.profileId ?? t.console.units.unnamedProfile;
	const confirmationValid = confirmationUnitId === item.id && candidate !== null;

	function openPicker() {
		setSearch("");
		setCandidate(null);
		setReasonCode("administrative");
		setNote("");
		setConfirmationUnitId("");
		overrideOwnership.reset();
		setStep("picker");
	}

	function selectCandidate(next: OwnershipCandidate) {
		setCandidate(next);
		setStep("confirmation");
	}

	async function applyOverride() {
		if (!candidate || !confirmationValid || overrideOwnership.isPending) return;
		try {
			await overrideOwnership.mutateAsync({
				path: { unitId: item.id },
				body: {
					expectedOwnerProfileId: item.owner?.profileId ?? null,
					targetProfileId: candidate.profileId,
					confirmationUnitId,
					reasonCode,
					...(note.trim() ? { note: note.trim() } : {}),
				},
			});
			await queryClient.invalidateQueries({
				queryKey: getApiGovernancePlatformUnitsQueryKey(),
			});
			setStep(null);
		} catch {
			// The typed mutation state renders the request failure below.
		}
	}

	return (
		<>
			<Button onClick={openPicker} type="button" variant="outline">
				<UserRoundCog />
				{t.console.units.overrideOwnership}
			</Button>
			<Dialog
				onOpenChange={({ open }) => {
					if (!open && step === "picker") setStep(null);
				}}
				open={step === "picker"}
			>
				<DialogContent size="lg">
					<DialogHeader
						description={t.console.units.ownershipPickerDescription}
						title={t.console.units.ownershipPickerTitle}
					/>
					<DialogBody className="grid min-h-0 gap-4">
						<label className="relative">
							<Search
								aria-hidden
								className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								aria-label={t.console.units.ownershipSearchLabel}
								autoFocus
								className="ps-9"
								onChange={(event) => setSearch(event.currentTarget.value)}
								placeholder={t.console.units.ownershipSearchPlaceholder}
								type="search"
								value={search}
							/>
						</label>
						<div
							aria-label={t.console.units.ownershipCandidateListLabel}
							className="h-80 overflow-auto rounded-lg border"
							ref={candidateScrollRef}
							role="listbox"
						>
							{candidates.isPending ? (
								<QueryPending />
							) : candidates.isError ? (
								<QueryFailure error={candidates.error} retry={() => void candidates.refetch()} />
							) : items.length ? (
								<div className="relative" style={{ height: candidateVirtualizer.getTotalSize() }}>
									{candidateRows.map((virtualRow) => {
										const entry = items[virtualRow.index];
										if (!entry) return null;
										const label =
											entry.label ??
											entry.slug ??
											entry.profileId ??
											t.console.units.unnamedProfile;
										return (
											<button
												aria-label={t.console.units.ownershipCandidateSelect({
													profile: label,
												})}
												className="absolute inset-x-0 grid gap-1 border-b px-4 py-3 text-start hover:bg-muted/48 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
												key={entry.profileId}
												onClick={() => selectCandidate(entry)}
												role="option"
												style={{
													height: virtualRow.size,
													transform: `translateY(${virtualRow.start}px)`,
												}}
												type="button"
											>
												<span className="truncate font-medium">{label}</span>
												<span className="truncate text-muted-foreground text-xs">
													{entry.slug ? `@${entry.slug} · ` : ""}
													{entry.profileId}
												</span>
											</button>
										);
									})}
								</div>
							) : (
								<p className="p-10 text-center text-muted-foreground text-sm">
									{t.console.units.ownershipCandidatesEmpty}
								</p>
							)}
						</div>
					</DialogBody>
					<DialogFooter>
						<Button onClick={() => setStep(null)} type="button" variant="outline">
							{t.console.cancel}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<Dialog
				onOpenChange={({ open }) => {
					if (!open && !overrideOwnership.isPending && step === "confirmation") setStep(null);
				}}
				open={step === "confirmation"}
			>
				<DialogContent size="lg">
					<DialogHeader
						description={t.console.units.ownershipConfirmationDescription({
							currentOwner,
							newOwner: candidateName,
						})}
						title={t.console.units.ownershipConfirmationTitle}
					/>
					<DialogBody className="grid gap-5">
						<dl className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
							<div>
								<dt className="text-muted-foreground text-sm">{t.console.units.owner}</dt>
								<dd className="mt-1 break-all font-medium">{currentOwner}</dd>
							</div>
							<div>
								<dt className="text-muted-foreground text-sm">{t.console.units.newOwner}</dt>
								<dd className="mt-1 break-all font-medium">{candidateName}</dd>
							</div>
						</dl>
						<Field required>
							<FieldLabel>{t.console.units.reason}</FieldLabel>
							<NativeSelect
								onChange={(event) => {
									const next = OwnershipGovernanceReasonCodes.find(
										(value) => value === event.currentTarget.value,
									);
									if (next) setReasonCode(next);
								}}
								value={reasonCode}
							>
								{OwnershipGovernanceReasonCodes.map((value) => (
									<NativeSelectOption key={value} value={value}>
										{t.realms.governanceReasons[value]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel>{t.console.units.internalNote}</FieldLabel>
							<Textarea
								maxLength={2000}
								onChange={(event) => setNote(event.currentTarget.value)}
								placeholder={t.console.units.notePlaceholder}
								value={note}
							/>
						</Field>
						<Field required>
							<FieldLabel>{t.console.units.confirmationLabel}</FieldLabel>
							<p className="mb-2 break-all text-muted-foreground text-sm">
								{t.console.units.confirmationInstruction({ unitId: item.id })}
							</p>
							<Input
								autoComplete="off"
								onChange={(event) => setConfirmationUnitId(event.currentTarget.value.trim())}
								spellCheck={false}
								value={confirmationUnitId}
							/>
						</Field>
						<RequestFailure error={overrideOwnership.error} />
					</DialogBody>
					<DialogFooter>
						<Button
							disabled={overrideOwnership.isPending}
							onClick={() => setStep("picker")}
							type="button"
							variant="outline"
						>
							{t.console.units.backToCandidates}
						</Button>
						<Button
							disabled={!confirmationValid}
							isLoading={overrideOwnership.isPending}
							onClick={() => void applyOverride()}
							type="button"
							variant="destructive"
						>
							{t.console.units.confirmOwnershipOverride}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function LifecycleCommandDialog({
	command,
	item,
	reasonCode,
	note,
	confirmationUnitId,
	pending,
	mutationError,
	onCommandChange,
	onReasonCodeChange,
	onNoteChange,
	onConfirmationUnitIdChange,
	onApply,
}: {
	readonly command: LifecycleCommand | null;
	readonly item: PlatformUnit | undefined;
	readonly reasonCode: GovernanceReasonCode;
	readonly note: string;
	readonly confirmationUnitId: string;
	readonly pending: boolean;
	readonly mutationError: unknown;
	readonly onCommandChange: (command: LifecycleCommand | null) => void;
	readonly onReasonCodeChange: (reasonCode: GovernanceReasonCode) => void;
	readonly onNoteChange: (note: string) => void;
	readonly onConfirmationUnitIdChange: (unitId: string) => void;
	readonly onApply: () => void;
}) {
	const { t } = useTranslation(["console", "realms"]);
	const valid = Boolean(item && confirmationUnitId === item.id);
	return (
		<Dialog
			onOpenChange={({ open }) => {
				if (!open && !pending) onCommandChange(null);
			}}
			open={command !== null}
		>
			<DialogContent size="lg">
				<DialogHeader
					description={
						command === "restore"
							? t.console.units.restoreDescription
							: t.console.units.softDeleteDescription
					}
					title={
						command === "restore" ? t.console.units.restoreTitle : t.console.units.softDeleteTitle
					}
				/>
				<DialogBody className="grid gap-5">
					<Field required>
						<FieldLabel>{t.console.units.reason}</FieldLabel>
						<NativeSelect
							onChange={(event) => {
								const next = GovernanceReasonCodes.find(
									(candidate) => candidate === event.currentTarget.value,
								);
								if (next) onReasonCodeChange(next);
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
						<FieldLabel>{t.console.units.internalNote}</FieldLabel>
						<Textarea
							maxLength={2000}
							onChange={(event) => onNoteChange(event.currentTarget.value)}
							placeholder={t.console.units.notePlaceholder}
							value={note}
						/>
					</Field>
					<Field required>
						<FieldLabel>{t.console.units.confirmationLabel}</FieldLabel>
						<p className="mb-2 break-all text-muted-foreground text-sm">
							{t.console.units.confirmationInstruction({ unitId: item?.id ?? "" })}
						</p>
						<Input
							autoComplete="off"
							onChange={(event) => onConfirmationUnitIdChange(event.currentTarget.value.trim())}
							spellCheck={false}
							value={confirmationUnitId}
						/>
					</Field>
					<RequestFailure error={mutationError} />
				</DialogBody>
				<DialogFooter>
					<Button
						disabled={pending}
						onClick={() => onCommandChange(null)}
						type="button"
						variant="outline"
					>
						{t.console.cancel}
					</Button>
					<Button
						disabled={!valid}
						isLoading={pending}
						onClick={onApply}
						type="button"
						variant={command === "delete" ? "destructive" : "solid"}
					>
						{command === "restore"
							? t.console.units.confirmRestore
							: t.console.units.confirmSoftDelete}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
