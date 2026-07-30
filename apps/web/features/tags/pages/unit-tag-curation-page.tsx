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
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	getApiUnitsByTypeByUnitIdTagsQueryKey,
	type GetApiUnitsByTypeByUnitIdStatus200,
	usePatchApiUnitsByTypeByUnitIdTagsByTagId,
} from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, GripVertical, Pin, PinOff, Plus } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useState } from "react";

import { useUnitManagement } from "@/features/units/components/unit-management-workspace";
import { UnitSectionHeader } from "@/features/units/components/unit-section-header";
import { invalidateUnitDetail } from "@/features/units/unit-cache";
import { isWorkUnitType, type WorkUnitType } from "@/features/units/unit-types";
import { isUnitDetailUnitType } from "@/features/units/model/unit-detail-section";
import { unitTagsHref } from "@/features/units/routing/unit-detail-routes";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import {
	nextFeaturedUnitTagPosition,
	partitionUnitTagCuration,
	positionForFeaturedUnitTagMove,
	type FeaturedUnitTag,
	type RankedUnitTag,
} from "../model/unit-tag-curation";

type UnitTag = GetApiUnitsByTypeByUnitIdStatus200["tags"][number];
type FeaturedTag = FeaturedUnitTag<UnitTag>;
type RankedTag = RankedUnitTag<UnitTag>;

function tagTitle(tag: UnitTag, unnamedTag: string): string {
	return tag.title ?? unnamedTag;
}

export function UnitTagCurationPage() {
	const { t } = useTranslation(["tags"]);
	const { type, unit } = useUnitManagement();
	const [announcement, setAnnouncement] = useState("");
	const groups = partitionUnitTagCuration(unit.tags);
	const curationVersion = unit.tags.map((tag) => `${tag.tagId}:${tag.updatedAt}`).join("|");
	if (!isWorkUnitType(type)) return null;
	return (
		<section className="grid gap-8">
			<UnitSectionHeader
				description={t.tags.management.description}
				title={t.tags.management.title}
			/>
			{isUnitDetailUnitType(type) ? (
				<Card appearance="outlined" className="max-w-3xl">
					<CardHeader>
						<CardTitle>{t.tags.management.addSectionTitle}</CardTitle>
						<CardDescription>{t.tags.management.addSectionDescription}</CardDescription>
					</CardHeader>
					<CardContent>
						<Button asChild variant="solid">
							<Link href={unitTagsHref(type, unit.id)}>
								<Plus aria-hidden />
								{t.tags.management.addSectionAction}
							</Link>
						</Button>
					</CardContent>
				</Card>
			) : null}
			{unit.capabilities.canCurateTags ? (
				<UnitTagCurationEditor
					featured={groups.featured}
					key={curationVersion}
					onAnnounce={setAnnouncement}
					ranked={groups.ranked}
					type={type}
					unitId={unit.id}
				/>
			) : null}
			<p aria-live="polite" className="sr-only">
				{announcement}
			</p>
		</section>
	);
}

function UnitTagCurationEditor({
	type,
	unitId,
	featured,
	ranked,
	onAnnounce,
}: {
	readonly type: WorkUnitType;
	readonly unitId: string;
	readonly featured: readonly FeaturedTag[];
	readonly ranked: readonly RankedTag[];
	readonly onAnnounce: (message: string) => void;
}) {
	const { t } = useTranslation(["errors", "tags"]);
	const queryClient = useQueryClient();
	const [displayedFeatured, setDisplayedFeatured] = useState(featured);
	const expectedFeaturedTagIds = featured.map((tag) => tag.tagId);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	const refresh = async () => {
		await Promise.all([
			invalidateUnitDetail(queryClient, type, unitId),
			queryClient.invalidateQueries({
				queryKey: getApiUnitsByTypeByUnitIdTagsQueryKey({
					path: { type, unitId },
				}),
			}),
		]);
	};
	const mutation = usePatchApiUnitsByTypeByUnitIdTagsByTagId({
		mutation: {
			onSuccess: refresh,
			onError: refresh,
		},
	});

	async function feature(tag: RankedTag) {
		const position = nextFeaturedUnitTagPosition(featured);
		try {
			await mutation.mutateAsync({
				path: { type, unitId, tagId: tag.tagId },
				body: {
					pinned: true,
					position,
					updatedAt: tag.updatedAt,
					expectedFeaturedTagIds,
				},
			});
			onAnnounce(
				t.tags.management.featuredAnnouncement({
					tag: tagTitle(tag, t.tags.unnamedTag),
					position: featured.length + 1,
				}),
			);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	async function unfeature(tag: FeaturedTag) {
		try {
			await mutation.mutateAsync({
				path: { type, unitId, tagId: tag.tagId },
				body: {
					pinned: false,
					position: null,
					updatedAt: tag.updatedAt,
					expectedFeaturedTagIds,
				},
			});
			onAnnounce(
				t.tags.management.unfeaturedAnnouncement({
					tag: tagTitle(tag, t.tags.unnamedTag),
				}),
			);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	async function moveFeatured(tagId: string, targetIndex: number) {
		const move = positionForFeaturedUnitTagMove(featured, tagId, targetIndex);
		if (!move.ok) return;
		const sourceIndex = displayedFeatured.findIndex((tag) => tag.tagId === tagId);
		const tag = featured.find((candidate) => candidate.tagId === tagId);
		if (sourceIndex < 0 || !tag) return;
		setDisplayedFeatured(arrayMove([...displayedFeatured], sourceIndex, targetIndex));
		try {
			await mutation.mutateAsync({
				path: { type, unitId, tagId },
				body: {
					pinned: true,
					position: move.position,
					updatedAt: tag.updatedAt,
					expectedFeaturedTagIds,
				},
			});
			onAnnounce(
				t.tags.management.movedAnnouncement({
					tag: tagTitle(tag, t.tags.unnamedTag),
					position: targetIndex + 1,
				}),
			);
		} catch {
			setDisplayedFeatured(featured);
		}
	}

	function handleDragEnd(event: DragEndEvent) {
		if (!event.over) return;
		const tagId = String(event.active.id);
		const targetIndex = displayedFeatured.findIndex(
			(tag) => tag.tagId === String(event.over?.id),
		);
		if (targetIndex >= 0) void moveFeatured(tagId, targetIndex);
	}

	function featuredLabel(tagId: string | number): string {
		const tag = displayedFeatured.find((candidate) => candidate.tagId === String(tagId));
		return tag ? tagTitle(tag, t.tags.unnamedTag) : t.tags.unnamedTag;
	}

	return (
		<div className="grid max-w-3xl gap-8">
			<section className="grid gap-4" aria-labelledby="featured-tags-title">
				<div className="grid gap-1">
					<h2 className="text-lg font-semibold" id="featured-tags-title">
						{t.tags.management.featuredTitle}
					</h2>
					<p className="text-sm text-muted-foreground">
						{t.tags.management.featuredDescription}
					</p>
				</div>
				{displayedFeatured.length ? (
					<DndContext
						accessibility={{
							screenReaderInstructions: {
								draggable: t.tags.management.instructions,
							},
							announcements: {
								onDragStart: ({ active }) =>
									t.tags.management.pickedUp({
										tag: featuredLabel(active.id),
									}),
								onDragOver: ({ active, over }) => {
									if (!over) return;
									const position = displayedFeatured.findIndex(
										(tag) => tag.tagId === String(over.id),
									);
									if (position < 0) return;
									return t.tags.management.over({
										tag: featuredLabel(active.id),
										position: position + 1,
										count: displayedFeatured.length,
									});
								},
								onDragEnd: () => undefined,
								onDragCancel: ({ active }) =>
									t.tags.management.cancelled({
										tag: featuredLabel(active.id),
									}),
							},
						}}
						collisionDetection={closestCenter}
						onDragEnd={handleDragEnd}
						sensors={sensors}
					>
						<SortableContext
							items={displayedFeatured.map((tag) => tag.tagId)}
							strategy={verticalListSortingStrategy}
						>
							<ol className="grid gap-2">
								{displayedFeatured.map((tag, index) => (
									<SortableFeaturedTag
										busy={mutation.isPending}
										count={displayedFeatured.length}
										index={index}
										key={tag.tagId}
										onMove={(targetIndex) =>
											void moveFeatured(tag.tagId, targetIndex)
										}
										onUnfeature={() => void unfeature(tag)}
										tag={tag}
									/>
								))}
							</ol>
						</SortableContext>
					</DndContext>
				) : (
					<EmptyCard>{t.tags.management.noFeatured}</EmptyCard>
				)}
			</section>

			<section className="grid gap-4" aria-labelledby="ranked-tags-title">
				<div className="grid gap-1">
					<h2 className="text-lg font-semibold" id="ranked-tags-title">
						{t.tags.management.rankedTitle}
					</h2>
					<p className="text-sm text-muted-foreground">
						{t.tags.management.rankedDescription}
					</p>
				</div>
				{ranked.length ? (
					<ul className="grid gap-2">
						{ranked.map((tag) => (
							<RankedTagRow
								busy={mutation.isPending}
								featuring={
									mutation.isPending &&
									mutation.variables?.path.tagId === tag.tagId
								}
								key={tag.tagId}
								onFeature={() => void feature(tag)}
								tag={tag}
							/>
						))}
					</ul>
				) : (
					<EmptyCard>{t.tags.management.noRanked}</EmptyCard>
				)}
			</section>
			<RequestFailure error={mutation.error} fallback={t.errors.unknown} />
		</div>
	);
}

function SortableFeaturedTag({
	tag,
	index,
	count,
	busy,
	onMove,
	onUnfeature,
}: {
	readonly tag: FeaturedTag;
	readonly index: number;
	readonly count: number;
	readonly busy: boolean;
	readonly onMove: (targetIndex: number) => void;
	readonly onUnfeature: () => void;
}) {
	const { t } = useTranslation(["tags"]);
	const label = tagTitle(tag, t.tags.unnamedTag);
	const sortable = useSortable({ id: tag.tagId, disabled: busy });
	return (
		<li
			className={sortable.isDragging ? "relative z-10 opacity-80" : undefined}
			ref={sortable.setNodeRef}
			style={{
				transform: CSS.Transform.toString(sortable.transform),
				transition: sortable.transition,
			}}
		>
			<Card appearance="outlined" className="py-0">
				<CardContent className="flex min-w-0 flex-wrap items-center gap-2 p-3">
					<Button
						aria-label={t.tags.management.drag({ tag: label })}
						disabled={busy}
						ref={sortable.setActivatorNodeRef}
						size="icon-sm"
						type="button"
						variant="quiet"
						{...sortable.attributes}
						{...sortable.listeners}
					>
						<GripVertical aria-hidden />
					</Button>
					<div className="min-w-40 flex-1">
						<p className="truncate font-medium">{label}</p>
						<p className="text-xs text-muted-foreground">
							{t.tags.vote.summary({
								score: String(tag.score),
								count: String(tag.voteCount),
							})}
						</p>
					</div>
					<Badge variant="secondary">{t.tags.global.pinned}</Badge>
					<div className="flex items-center gap-1">
						<Button
							aria-label={t.tags.management.moveEarlier}
							disabled={busy || index === 0}
							onClick={() => onMove(index - 1)}
							size="icon-sm"
							type="button"
							variant="quiet"
						>
							<ArrowUp aria-hidden />
						</Button>
						<Button
							aria-label={t.tags.management.moveLater}
							disabled={busy || index === count - 1}
							onClick={() => onMove(index + 1)}
							size="icon-sm"
							type="button"
							variant="quiet"
						>
							<ArrowDown aria-hidden />
						</Button>
						<Button
							disabled={busy}
							onClick={onUnfeature}
							size="sm"
							type="button"
							variant="outline"
						>
							<PinOff aria-hidden />
							{t.tags.management.unfeature}
						</Button>
					</div>
				</CardContent>
			</Card>
		</li>
	);
}

function RankedTagRow({
	tag,
	busy,
	featuring,
	onFeature,
}: {
	readonly tag: RankedTag;
	readonly busy: boolean;
	readonly featuring: boolean;
	readonly onFeature: () => void;
}) {
	const { t } = useTranslation(["tags"]);
	return (
		<li>
			<Card appearance="outlined" className="py-0">
				<CardContent className="flex min-w-0 flex-wrap items-center gap-3 p-4">
					<div className="min-w-40 flex-1">
						<p className="truncate font-medium">{tagTitle(tag, t.tags.unnamedTag)}</p>
						<p className="text-xs text-muted-foreground">
							{t.tags.vote.summary({
								score: String(tag.score),
								count: String(tag.voteCount),
							})}
						</p>
					</div>
					<Button
						disabled={busy}
						isLoading={featuring}
						onClick={onFeature}
						size="sm"
						type="button"
						variant="outline"
					>
						<Pin aria-hidden />
						{t.tags.management.feature}
					</Button>
				</CardContent>
			</Card>
		</li>
	);
}

function EmptyCard({ children }: { readonly children: string }) {
	return (
		<Card appearance="outlined">
			<CardContent className="p-5 text-sm text-muted-foreground">{children}</CardContent>
		</Card>
	);
}
