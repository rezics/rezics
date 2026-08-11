"use client";

import {
	getApiRealmsByRealmIdPinsQueryKey,
	type GetApiRealmsByRealmIdPinsStatus200,
	useDeleteApiRealmsByRealmIdPinsByUnitId,
	usePostApiRealmsByRealmIdPinsMove,
	usePutApiRealmsByRealmIdPinsByUnitId,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Checkbox,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	EntityPicker,
	type EntityPickerValue,
	Field,
	FieldGroup,
	FieldLabel,
	NativeSelect,
	NativeSelectOption,
	Skeleton,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { MoveIcon, Trash2Icon } from "lucide-react";
import { useState, type FormEvent } from "react";

import { FeedItemCard } from "@/features/content-feed/components/feed-item-card";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { joinRealmPinsWithContent } from "../model/realm-pin-items";
import { invalidateRealmDetails } from "../query";

type RealmPinsData = GetApiRealmsByRealmIdPinsStatus200;
type RealmPin = RealmPinsData["items"][number];
type RealmPinContent = RealmPinsData["contentItems"][number];
type RealmPinKind = RealmPin["kind"];
type RealmPinEntry = Readonly<{
	pin: RealmPin;
	content: RealmPinContent | undefined;
}>;
type MovePlacementKind = "start" | "end" | "after";

const RealmPinKinds = ["pinned", "highlight"] as const satisfies readonly RealmPinKind[];

function isRealmPinKind(value: string): value is RealmPinKind {
	return value === "pinned" || value === "highlight";
}

function isMovePlacementKind(value: string): value is MovePlacementKind {
	return value === "start" || value === "end" || value === "after";
}

export function RealmPinsManager({
	data,
	pending: queryPending,
	error,
	realmId,
}: {
	readonly data: RealmPinsData | undefined;
	readonly pending: boolean;
	readonly error: Parameters<typeof RequestFailure>[0]["error"];
	readonly realmId: string;
}) {
	const { t } = useTranslation(["realms", "state", "ui"]);
	const queryClient = useQueryClient();
	const localizationLanguages = useLocalizationLanguages();
	const add = usePutApiRealmsByRealmIdPinsByUnitId();
	const move = usePostApiRealmsByRealmIdPinsMove();
	const remove = useDeleteApiRealmsByRealmIdPinsByUnitId();
	const [target, setTarget] = useState<EntityPickerValue>();
	const [targetKind, setTargetKind] = useState<RealmPinKind>("pinned");
	const [selectedIdsByKind, setSelectedIdsByKind] = useState<
		Record<RealmPinKind, ReadonlySet<string>>
	>(() => ({
		pinned: new Set(),
		highlight: new Set(),
	}));
	const [movingKind, setMovingKind] = useState<RealmPinKind>();
	const [destinationKind, setDestinationKind] = useState<RealmPinKind>("pinned");
	const [placementKind, setPlacementKind] = useState<MovePlacementKind>("end");
	const [destinationUnitId, setDestinationUnitId] = useState("");

	const entries: readonly RealmPinEntry[] = joinRealmPinsWithContent(
		data?.items ?? [],
		data?.contentItems ?? [],
	);
	const entriesByKind: Record<RealmPinKind, readonly RealmPinEntry[]> = {
		pinned: entries.filter(({ pin }) => pin.kind === "pinned"),
		highlight: entries.filter(({ pin }) => pin.kind === "highlight"),
	};
	const mutationPending = add.isPending || move.isPending || remove.isPending;
	const movingIds = movingKind ? selectedIdsByKind[movingKind] : undefined;
	const destinationEntries = entriesByKind[destinationKind].filter(
		({ pin }) => !movingIds?.has(pin.unitId),
	);
	const destinationRequired = placementKind === "after";

	function titleFor(entry: RealmPinEntry): string {
		return entry.content?.title?.trim() || (entry.content ? t.ui.unnamed : t.state.error);
	}

	async function refresh() {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: getApiRealmsByRealmIdPinsQueryKey({
					path: { realmId },
					query: { localizationLanguages },
				}),
			}),
			invalidateRealmDetails(queryClient, realmId),
		]);
	}

	async function addPin(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!target) return;
		const targetId = target.id;
		try {
			await add.mutateAsync({
				path: { realmId, unitId: targetId },
				body: { kind: targetKind },
			});
			setSelectedIdsByKind((current) => {
				const pinned = new Set(current.pinned);
				const highlight = new Set(current.highlight);
				pinned.delete(targetId);
				highlight.delete(targetId);
				return { pinned, highlight };
			});
			setTarget(undefined);
			await refresh();
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	async function removePin(pin: RealmPin) {
		try {
			await remove.mutateAsync({
				path: { realmId, unitId: pin.unitId },
				query: { kind: pin.kind },
			});
			setSelectedIdsByKind((current) => {
				const selected = new Set(current[pin.kind]);
				selected.delete(pin.unitId);
				return { ...current, [pin.kind]: selected };
			});
			await refresh();
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	async function submitMove() {
		const sourceKind = movingKind;
		if (!sourceKind) return;
		const selectedIds = selectedIdsByKind[sourceKind];
		if (!selectedIds.size) return;
		const placement =
			placementKind === "after"
				? { kind: "after" as const, unitId: destinationUnitId }
				: { kind: placementKind };
		try {
			await move.mutateAsync({
				path: { realmId },
				body: {
					unitIds: [...selectedIds],
					destinationKind,
					placement,
				},
			});
			setSelectedIdsByKind((current) => ({
				...current,
				[sourceKind]: new Set(),
			}));
			closeMoveDialog();
			await refresh();
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	function toggleSelection(kind: RealmPinKind, unitId: string, checked: boolean) {
		setSelectedIdsByKind((current) => {
			const selected = new Set(current[kind]);
			if (checked) selected.add(unitId);
			else selected.delete(unitId);
			return { ...current, [kind]: selected };
		});
	}

	function openMoveDialog(kind: RealmPinKind) {
		setMovingKind(kind);
		setDestinationKind(kind);
		setPlacementKind("end");
		setDestinationUnitId("");
	}

	function closeMoveDialog() {
		setMovingKind(undefined);
		setPlacementKind("end");
		setDestinationUnitId("");
	}

	return (
		<section className="grid gap-6">
			<form
				className="grid gap-4 rounded-2xl border border-border-weak p-4"
				onSubmit={(event) => void addPin(event)}
			>
				<FieldGroup>
					<Field required>
						<FieldLabel>{t.realms.pinTarget}</FieldLabel>
						<EntityPicker
							ariaLabel={t.realms.pinTarget}
							index="units"
							onChange={setTarget}
							onClear={() => setTarget(undefined)}
							placeholder={t.ui.pickerPlaceholders.unit}
							value={target}
						/>
					</Field>
					<Field>
						<FieldLabel>{t.realms.pinKind}</FieldLabel>
						<NativeSelect
							onChange={(event) => {
								const kind = event.currentTarget.value;
								if (isRealmPinKind(kind)) setTargetKind(kind);
							}}
							value={targetKind}
						>
							{RealmPinKinds.map((kind) => (
								<NativeSelectOption key={kind} value={kind}>
									{t.realms.pinKinds[kind]}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
				</FieldGroup>
				<Button
					className="w-fit"
					disabled={!target}
					isLoading={add.isPending}
					type="submit"
					variant="solid"
				>
					{t.realms.pinManager.add}
				</Button>
			</form>
			<RequestFailure error={add.error ?? move.error ?? remove.error} fallback={t.ui.retryLater} />
			{queryPending ? (
				<Skeleton className="h-40 rounded-xl" />
			) : error ? (
				<RequestFailure error={error} />
			) : (
				<div className="grid gap-6">
					{RealmPinKinds.map((kind) => {
						const groupEntries = entriesByKind[kind];
						const selectedIds = selectedIdsByKind[kind];
						const kindLabel = t.realms.pinKinds[kind];
						const headingId = `realm-pin-group-${realmId}-${kind}`;
						return (
							<section aria-labelledby={headingId} className="grid gap-4" key={kind}>
								<div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-weak bg-surface-raised p-3">
									<h2 className="me-auto font-heading font-semibold" id={headingId}>
										{t.realms.pinManager.groupTitle({
											kind: kindLabel,
											count: groupEntries.length,
										})}
									</h2>
									<Button
										disabled={
											mutationPending ||
											!groupEntries.length ||
											selectedIds.size === groupEntries.length
										}
										onClick={() =>
											setSelectedIdsByKind((current) => ({
												...current,
												[kind]: new Set(groupEntries.map(({ pin }) => pin.unitId)),
											}))
										}
										size="sm"
										variant="outline"
									>
										{t.realms.pinManager.selectAll}
									</Button>
									<Button
										disabled={mutationPending || !selectedIds.size}
										onClick={() =>
											setSelectedIdsByKind((current) => ({
												...current,
												[kind]: new Set(),
											}))
										}
										size="sm"
										variant="quiet"
									>
										{t.realms.pinManager.clearSelection}
									</Button>
									<span className="text-muted-foreground text-sm">
										{t.realms.pinManager.selectedCount({
											count: selectedIds.size,
										})}
									</span>
									<Button
										disabled={mutationPending || !selectedIds.size}
										onClick={() => openMoveDialog(kind)}
										size="sm"
										variant="outline"
									>
										<MoveIcon aria-hidden />
										{t.realms.pinManager.move}
									</Button>
								</div>
								{groupEntries.length ? (
									<div className="grid gap-4">
										{groupEntries.map((entry) => {
											const title = titleFor(entry);
											return (
												<div className="grid gap-2" key={entry.pin.unitId}>
													<div className="flex items-center gap-3 rounded-xl border border-border-weak bg-surface-raised p-3">
														<Checkbox
															aria-label={t.realms.pinManager.selectItem({
																title,
															})}
															checked={selectedIds.has(entry.pin.unitId)}
															disabled={mutationPending}
															onCheckedChange={({ checked }) =>
																toggleSelection(kind, entry.pin.unitId, checked === true)
															}
														/>
														<span className="min-w-0 flex-1 truncate font-medium text-sm">
															{title}
														</span>
														<Button
															aria-label={t.realms.pinManager.removeItem({
																title,
															})}
															disabled={mutationPending}
															isLoading={
																remove.isPending &&
																remove.variables.path.unitId === entry.pin.unitId
															}
															onClick={() => void removePin(entry.pin)}
															size="icon-sm"
															variant="destructive"
														>
															<Trash2Icon aria-hidden />
														</Button>
													</div>
													{entry.content ? (
														<FeedItemCard item={entry.content} />
													) : (
														<p className="rounded-xl border border-border-weak p-4 text-muted-foreground text-sm">
															{t.state.error}
														</p>
													)}
												</div>
											);
										})}
									</div>
								) : (
									<p className="text-muted-foreground text-sm">{t.realms.pinManager.empty}</p>
								)}
							</section>
						);
					})}
				</div>
			)}
			<Dialog
				onOpenChange={({ open }) => {
					if (!open) closeMoveDialog();
				}}
				open={movingKind !== undefined}
			>
				<DialogContent showCloseButton={!move.isPending} size="sm">
					<DialogHeader
						description={t.realms.pinManager.moveDescription}
						title={t.realms.pinManager.moveTitle}
					/>
					<DialogBody>
						<FieldGroup>
							<Field>
								<FieldLabel>{t.realms.pinManager.destinationKind}</FieldLabel>
								<NativeSelect
									disabled={move.isPending}
									onChange={(event) => {
										const kind = event.currentTarget.value;
										if (!isRealmPinKind(kind)) return;
										setDestinationKind(kind);
										setPlacementKind("end");
										setDestinationUnitId("");
									}}
									value={destinationKind}
								>
									{RealmPinKinds.map((kind) => (
										<NativeSelectOption key={kind} value={kind}>
											{t.realms.pinKinds[kind]}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Field>
							<Field>
								<FieldLabel>{t.realms.pinManager.destination}</FieldLabel>
								<NativeSelect
									disabled={move.isPending}
									onChange={(event) => {
										const placement = event.currentTarget.value;
										if (!isMovePlacementKind(placement)) return;
										setPlacementKind(placement);
										setDestinationUnitId("");
									}}
									value={placementKind}
								>
									<NativeSelectOption value="start">
										{t.realms.pinManager.moveToStart}
									</NativeSelectOption>
									<NativeSelectOption value="end">
										{t.realms.pinManager.moveToEnd}
									</NativeSelectOption>
									<NativeSelectOption value="after">
										{t.realms.pinManager.moveAfter}
									</NativeSelectOption>
								</NativeSelect>
							</Field>
							{destinationRequired ? (
								<Field required>
									<FieldLabel>{t.realms.pinManager.afterItem}</FieldLabel>
									<NativeSelect
										disabled={move.isPending}
										onChange={(event) => setDestinationUnitId(event.currentTarget.value)}
										value={destinationUnitId}
									>
										<NativeSelectOption value="">
											{t.realms.pinManager.chooseDestination}
										</NativeSelectOption>
										{destinationEntries.map((entry) => (
											<NativeSelectOption key={entry.pin.unitId} value={entry.pin.unitId}>
												{titleFor(entry)}
											</NativeSelectOption>
										))}
									</NativeSelect>
								</Field>
							) : null}
						</FieldGroup>
						<RequestFailure error={move.error} fallback={t.ui.retryLater} />
					</DialogBody>
					<DialogFooter>
						<Button disabled={move.isPending} onClick={closeMoveDialog} variant="outline">
							{t.realms.pinManager.cancel}
						</Button>
						<Button
							disabled={!movingIds?.size || (destinationRequired && !destinationUnitId)}
							isLoading={move.isPending}
							onClick={() => void submitMove()}
							variant="solid"
						>
							{t.realms.pinManager.applyMove}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</section>
	);
}
