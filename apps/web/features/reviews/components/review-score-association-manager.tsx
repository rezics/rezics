"use client";

import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from "@dnd-kit/core";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	getApiScoresByTargetIdQueryKey,
	getApiScoresByTargetIdViewerQueryKey,
	type GetApiReviewsByReviewIdStatus200,
	type GetApiScoresByTargetIdViewerStatus200,
	useGetApiScoresByTargetIdViewer,
	usePutApiPostsByPostIdScores,
	usePutApiScoresByTargetId,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Field,
	FieldLabel,
	QueryFailure,
	QueryPending,
	Rating,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, GripVertical, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";

import { useReviewManagement } from "@/features/posts/components/post-management-workspace";
import { RealmScoreContextLink } from "@/features/realms/components/realm-score-context-link";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";
import { invalidateReviews } from "../data/review-cache";
import {
	appendReviewScoreDrafts,
	createReviewScoreDrafts,
	createReviewScoreRealmOptions,
	MaximumReviewScoreAssociations,
	moveReviewScoreDraft,
	reviewScoreDraftsAreValid,
	type ReviewScoreDraft,
	type ReviewScoreRealmOption,
	type StoredReviewScoreDraft,
} from "../model/review-score-association";
import { starValueToUnitScore, type UnitScore } from "../model/score-value";
import { ReviewScoreRealmMultiPicker } from "./review-score-realm-multi-picker";

type Review = GetApiReviewsByReviewIdStatus200;
type ViewerScore = GetApiScoresByTargetIdViewerStatus200["items"][number];

export function ReviewScoreAssociationManager() {
	const { item: review } = useReviewManagement();
	const localizationLanguages = useLocalizationLanguages();
	const viewerScores = useGetApiScoresByTargetIdViewer({
		path: { targetId: review.targetId },
		query: { localizationLanguages },
	});

	if (viewerScores.isError)
		return <QueryFailure error={viewerScores.error} retry={() => void viewerScores.refetch()} />;
	if (!viewerScores.data) return <QueryPending />;

	return (
		<LoadedReviewScoreAssociationManager
			key={`${review.id}:${review.scores
				.map(({ scoreId, value }) => `${scoreId}:${value}`)
				.join("|")}`}
			review={review}
			viewerScores={viewerScores.data.items}
		/>
	);
}

function LoadedReviewScoreAssociationManager({
	review,
	viewerScores,
}: {
	readonly review: Review;
	readonly viewerScores: readonly ViewerScore[];
}) {
	const { t } = useTranslation(["engagement", "errors", "ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const queryClient = useQueryClient();
	const replace = usePutApiPostsByPostIdScores();
	const upsertScore = usePutApiScoresByTargetId();
	const [drafts, setDrafts] = useState<readonly ReviewScoreDraft[]>(() =>
		createReviewScoreDrafts(viewerScores, review.scores),
	);
	const [selectedRealmId, setSelectedRealmId] = useState<string | undefined>(
		() => drafts[0]?.realmId,
	);
	const [adding, setAdding] = useState(false);
	const [realmsToAdd, setRealmsToAdd] = useState<readonly ReviewScoreRealmOption[]>([]);
	const [invalid, setInvalid] = useState(false);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	const excludedRealmIds = useMemo(() => new Set(drafts.map(({ realmId }) => realmId)), [drafts]);
	const realmOptions = useMemo(
		() => createReviewScoreRealmOptions(viewerScores, excludedRealmIds),
		[excludedRealmIds, viewerScores],
	);
	const selected = drafts.find(({ realmId }) => realmId === selectedRealmId);
	const remainingCapacity = MaximumReviewScoreAssociations - drafts.length;
	const pending = replace.isPending || upsertScore.isPending;

	function handleDragEnd(event: DragEndEvent) {
		const realmId = String(event.active.id);
		const overRealmId = event.over ? String(event.over.id) : undefined;
		if (!overRealmId || overRealmId === realmId) return;
		const targetIndex = drafts.findIndex((item) => item.realmId === overRealmId);
		if (targetIndex < 0) return;
		setDrafts(moveReviewScoreDraft(drafts, realmId, targetIndex));
	}

	function updateScoreValue(realmId: string, value: UnitScore) {
		setDrafts((current) =>
			current.map((draft) => (draft.realmId === realmId ? { ...draft, value } : draft)),
		);
		setInvalid(false);
	}

	function removeScore(realmId: string) {
		setDrafts((current) => {
			const removedIndex = current.findIndex((item) => item.realmId === realmId);
			const next = current.filter((item) => item.realmId !== realmId);
			if (selectedRealmId === realmId) {
				const nextSelected = next[Math.min(Math.max(removedIndex, 0), next.length - 1)];
				setSelectedRealmId(nextSelected?.realmId);
			}
			return next;
		});
		setInvalid(false);
	}

	function addSelectedRealms() {
		const next = appendReviewScoreDrafts(drafts, realmsToAdd);
		const firstAdded = next.find(({ realmId }) => !excludedRealmIds.has(realmId));
		setDrafts(next);
		if (firstAdded) setSelectedRealmId(firstAdded.realmId);
		setRealmsToAdd([]);
		setAdding(false);
		setInvalid(false);
	}

	async function save() {
		if (!reviewScoreDraftsAreValid(drafts)) {
			setInvalid(true);
			return;
		}
		setInvalid(false);
		replace.reset();
		upsertScore.reset();
		const changedRealmIds: string[] = [];
		try {
			const stored: StoredReviewScoreDraft[] = [];
			for (const draft of drafts) {
				if (draft.state === "stored" && draft.value === draft.persistedValue) {
					stored.push(draft);
					continue;
				}
				const result = await upsertScore.mutateAsync({
					path: { targetId: review.targetId },
					body: { realmId: draft.realmId, score: draft.value },
				});
				changedRealmIds.push(draft.realmId);
				stored.push({
					state: "stored",
					scoreId: result.scoreId,
					realmId: draft.realmId,
					realmLabel: draft.realmLabel,
					value: draft.value,
					persistedValue: draft.value,
				});
			}
			await replace.mutateAsync({
				path: { postId: review.id },
				body: stored.map(({ scoreId }) => ({ scoreId })),
			});
			setDrafts(stored);
			await Promise.all([
				invalidateReviews(queryClient, review.id, review.targetId),
				queryClient.invalidateQueries({
					queryKey: getApiScoresByTargetIdViewerQueryKey({
						path: { targetId: review.targetId },
						query: { localizationLanguages },
					}),
				}),
				...changedRealmIds.map((realmId) =>
					queryClient.invalidateQueries({
						queryKey: getApiScoresByTargetIdQueryKey({
							path: { targetId: review.targetId },
							query: { realmId },
						}),
					}),
				),
			]);
		} catch {
			// The typed mutation states supply the visible API error.
		}
	}

	return (
		<Card appearance="outlined">
			<CardHeader>
				<CardTitle>{t.engagement.scoreAssociation}</CardTitle>
				<CardDescription>{t.engagement.scoreAssociationDescription}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-5">
				<DndContext
					accessibility={{
						screenReaderInstructions: {
							draggable: t.engagement.scoreOrderInstructions,
						},
						announcements: {
							onDragStart({ active }) {
								const item = drafts.find(({ realmId }) => realmId === String(active.id));
								return item?.realmLabel;
							},
							onDragOver({ over }) {
								if (!over) return;
								const item = drafts.find(({ realmId }) => realmId === String(over.id));
								return item?.realmLabel;
							},
							onDragEnd({ active, over }) {
								if (!over) return;
								const item = drafts.find(({ realmId }) => realmId === String(active.id));
								const targetIndex = drafts.findIndex(({ realmId }) => realmId === String(over.id));
								return item && targetIndex >= 0
									? t.engagement.scoreMoved({
											realm: item.realmLabel,
											position: targetIndex + 1,
											count: drafts.length,
										})
									: undefined;
							},
							onDragCancel() {
								return t.engagement.scoreOrderCancelled;
							},
						},
					}}
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
					sensors={sensors}
				>
					<SortableContext
						items={drafts.map(({ realmId }) => realmId)}
						strategy={verticalListSortingStrategy}
					>
						<ul className="grid gap-2">
							{drafts.map((draft, index) => (
								<SortableReviewScore
									draft={draft}
									disabled={pending}
									index={index}
									key={draft.realmId}
									onMove={(targetIndex) =>
										setDrafts(moveReviewScoreDraft(drafts, draft.realmId, targetIndex))
									}
									onRemove={() => removeScore(draft.realmId)}
									onSelect={() => setSelectedRealmId(draft.realmId)}
									selected={draft.realmId === selectedRealmId}
									total={drafts.length}
								/>
							))}
							<li>
								<button
									className="flex min-h-16 w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-muted-foreground outline-none transition-colors hover:border-brand hover:text-brand focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-64"
									disabled={remainingCapacity === 0 || pending}
									onClick={() => setAdding((value) => !value)}
									type="button"
								>
									<Plus aria-hidden />
									{t.engagement.addScoreRealms}
								</button>
							</li>
						</ul>
					</SortableContext>
				</DndContext>

				{adding ? (
					<div className="grid gap-3 rounded-xl border bg-muted/24 p-4">
						<div>
							<p className="font-medium text-sm">{t.engagement.selectScoreRealms}</p>
							<p className="mt-1 text-muted-foreground text-sm">
								{t.engagement.scoreAssociationLimit({
									count: remainingCapacity,
								})}
							</p>
						</div>
						<ReviewScoreRealmMultiPicker
							excludedRealmIds={excludedRealmIds}
							maximum={remainingCapacity}
							onChange={setRealmsToAdd}
							options={realmOptions}
							selected={realmsToAdd}
						/>
						<div className="flex justify-end gap-2">
							<Button
								onClick={() => {
									setAdding(false);
									setRealmsToAdd([]);
								}}
								size="sm"
								type="button"
								variant="quiet"
							>
								{t.engagement.cancel}
							</Button>
							<Button
								disabled={realmsToAdd.length === 0}
								onClick={addSelectedRealms}
								size="sm"
								type="button"
								variant="solid"
							>
								{t.engagement.addSelectedScores}
							</Button>
						</div>
					</div>
				) : null}

				{selected ? (
					<div className="grid gap-4 rounded-xl border bg-muted/16 p-4">
						<Field>
							<FieldLabel>
								{t.engagement.scoreValueForRealm({
									realm: selected.realmLabel,
								})}
							</FieldLabel>
							<div className="flex flex-wrap items-center gap-3">
								<Rating
									allowHalf
									aria-label={t.engagement.scoreValueForRealm({
										realm: selected.realmLabel,
									})}
									className="**:data-[slot=rating-item-indicator]:size-8"
									count={5}
									disabled={pending}
									onValueChange={({ value }) => {
										const score = starValueToUnitScore(value);
										if (score !== undefined) updateScoreValue(selected.realmId, score);
									}}
									value={selected.value === undefined ? 0 : selected.value / 2}
								/>
								<span className="font-medium text-sm">
									{selected.value === undefined
										? t.engagement.scoreRequired
										: t.engagement.scoreOutOfTen({
												score: String(selected.value),
											})}
								</span>
							</div>
						</Field>
						<RealmScoreContextLink realmId={selected.realmId} />
					</div>
				) : (
					<p className="text-muted-foreground text-sm">{t.engagement.noAssociatedScores}</p>
				)}

				{invalid ? (
					<p className="text-destructive text-sm" role="alert">
						{t.engagement.completeScoreValues}
					</p>
				) : null}
				<RequestFailure error={upsertScore.error ?? replace.error} fallback={t.ui.retryLater} />
				<Button
					className="w-fit"
					disabled={adding}
					isLoading={pending}
					onClick={() => void save()}
					type="button"
					variant="solid"
				>
					{t.engagement.saveScoreAssociation}
				</Button>
			</CardContent>
		</Card>
	);
}

function SortableReviewScore({
	draft,
	disabled,
	index,
	onMove,
	onRemove,
	onSelect,
	selected,
	total,
}: {
	readonly draft: ReviewScoreDraft;
	readonly disabled: boolean;
	readonly index: number;
	readonly onMove: (targetIndex: number) => void;
	readonly onRemove: () => void;
	readonly onSelect: () => void;
	readonly selected: boolean;
	readonly total: number;
}) {
	const { t } = useTranslation("engagement");
	const sortable = useSortable({ id: draft.realmId, disabled });
	return (
		<li
			className={`rounded-xl border bg-background p-2 shadow-xs transition-colors ${
				selected ? "border-brand ring-1 ring-brand/30" : ""
			}`}
			ref={sortable.setNodeRef}
			style={{
				transform: CSS.Transform.toString(sortable.transform),
				transition: sortable.transition,
			}}
		>
			<div className="flex items-center gap-2">
				<Button
					aria-label={t.dragScore({
						realm: draft.realmLabel,
					})}
					disabled={disabled}
					ref={sortable.setActivatorNodeRef}
					size="icon-sm"
					type="button"
					variant="quiet"
					{...sortable.attributes}
					{...sortable.listeners}
				>
					<GripVertical aria-hidden />
				</Button>
				<button
					aria-pressed={selected}
					className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring"
					onClick={onSelect}
					type="button"
				>
					<span className="min-w-0 flex-1 truncate font-medium">{draft.realmLabel}</span>
					<Rating
						allowHalf
						aria-hidden
						className="pointer-events-none hidden text-muted-foreground **:data-[highlighted]:text-warning **:data-[slot=rating-item-indicator]:size-4 sm:block"
						count={5}
						readOnly
						value={draft.value === undefined ? 0 : draft.value / 2}
					/>
					<span
						className={
							draft.value === undefined
								? "text-destructive text-sm"
								: "text-muted-foreground text-sm"
						}
					>
						{draft.value === undefined
							? t.scoreRequired
							: t.scoreOutOfTen({
									score: String(draft.value),
								})}
					</span>
				</button>
				<div className="flex items-center gap-1">
					<Button
						aria-label={t.moveScoreUp({
							realm: draft.realmLabel,
						})}
						disabled={disabled || index === 0}
						onClick={() => onMove(index - 1)}
						size="icon-sm"
						type="button"
						variant="quiet"
					>
						<ArrowUp aria-hidden />
					</Button>
					<Button
						aria-label={t.moveScoreDown({
							realm: draft.realmLabel,
						})}
						disabled={disabled || index === total - 1}
						onClick={() => onMove(index + 1)}
						size="icon-sm"
						type="button"
						variant="quiet"
					>
						<ArrowDown aria-hidden />
					</Button>
					<Button
						aria-label={t.removeScoreRealm({
							realm: draft.realmLabel,
						})}
						disabled={disabled}
						onClick={onRemove}
						size="icon-sm"
						type="button"
						variant="quiet"
					>
						<X aria-hidden />
					</Button>
				</div>
			</div>
		</li>
	);
}
