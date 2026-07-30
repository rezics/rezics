"use client";

import {
	useDeleteApiProgressByUnitIdEntriesByEntryId,
	useGetApiUnitsByTypeByUnitId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock3, History, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useState } from "react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogBody,
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
	PageHeading,
	Progress,
	QueryFailure,
	QueryPending,
	RadioGroup,
	RadioGroupItem,
	RadioGroupLabel,
	cn,
} from "@rezics/ui";
import { useQueryState } from "nuqs";
import { RequireSession } from "@/features/auth/require-session";
import { postHref } from "@/features/posts/url";
import { isUnitDetailUnitFor } from "@/features/units/model/unit-detail-unit";
import { unitDetailHref } from "@/features/units/routing/unit-detail-routes";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useLocalizationFallbackToast } from "@/i18n/use-localization-fallback-toast";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import { selectLocalization } from "@/lib/localization";
import { ProgressEntryDialog } from "../components/progress-entry-dialog";
import { ProgressEventDescription } from "../components/progress-event-description";
import { ProgressImportDialog } from "../components/progress-import-dialog";
import { UnitProgressDialog } from "../components/unit-progress-dialog";
import { UnitProgressProvider, useUnitProgress } from "../components/unit-progress-provider";
import { useProgressEntries } from "../data/progress-entries";
import { invalidateProgressQueries } from "../data/progress-cache";
import { formatProgressEntryDate, type ProgressEntry } from "../model/progress-entry";
import type { ProgressTrackableUnitType } from "../model/progress-record";
import { progressRecordFromEditableState } from "../model/progress-state";
import {
	AllProgressHistoryStatuses,
	ProgressHistoryFilters,
	progressEntryReviewHref,
	progressHistoryFilterParser,
	toProgressHistoryFilter,
} from "../routing/progress-routes";

export function UnitProgressPage({
	type,
	unitId,
}: {
	readonly type: ProgressTrackableUnitType;
	readonly unitId: string;
}) {
	return (
		<RequireSession>
			<UnitProgressProvider domain={{ type, unitId }}>
				<UnitProgressPageContent type={type} unitId={unitId} />
			</UnitProgressProvider>
		</RequireSession>
	);
}

function UnitProgressPageContent({
	type,
	unitId,
}: {
	readonly type: ProgressTrackableUnitType;
	readonly unitId: string;
}) {
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiUnitsByTypeByUnitId({
		path: { type, unitId },
		query: { localizationLanguages },
	});
	useLocalizationFallbackToast({
		actualLanguage: query.data?.language ?? null,
		localizationLanguages,
		unitId,
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!isUnitDetailUnitFor(query.data, type))
		return (
			<QueryFailure
				error={new Error("Unit Unit type mismatch")}
				retry={() => void query.refetch()}
			/>
		);

	const localization = selectLocalization(
		query.data.localizations,
		query.data.language,
		query.data.language,
	);
	return <ProgressJournal title={localization?.title ?? undefined} />;
}

function ProgressJournal({ title }: { readonly title?: string }) {
	const progress = useUnitProgress();
	const [historyFilter, setHistoryFilter] = useQueryState("status", progressHistoryFilterParser);
	const entries = useProgressEntries(
		progress.domain.unitId,
		historyFilter === AllProgressHistoryStatuses ? undefined : historyFilter,
	);
	const { t } = useTranslation(["engagement", "ui"]);
	const [selectedId, setSelectedId] = useState<string>();
	const [editorOpen, setEditorOpen] = useState(false);
	const [editingEntry, setEditingEntry] = useState<ProgressEntry>();
	const [deletingEntry, setDeletingEntry] = useState<ProgressEntry>();
	const items = entries.data?.pages.flatMap((page) => page.items) ?? [];
	const selectedEntry = items.find((item) => item.id === selectedId) ?? items[0];

	return (
		<main className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 py-6 sm:px-6 sm:py-10">
			<Button asChild className="w-fit" variant="outline">
				<Link href={unitDetailHref(progress.domain.type, progress.domain.unitId)}>
					<ArrowLeft aria-hidden />
					{t.engagement.progressJournal.backToUnit}
				</Link>
			</Button>
			<PageHeading
				action={
					<div className="flex flex-wrap gap-2">
						<Button onClick={progress.openEditor} variant="solid">
							<Pencil aria-hidden data-icon="inline-start" />
							{t.engagement.progressJournal.updateNow}
						</Button>
						<Button
							onClick={() => {
								setEditingEntry(undefined);
								setEditorOpen(true);
							}}
							variant="outline"
						>
							<Plus aria-hidden data-icon="inline-start" />
							{t.engagement.progressJournal.addHistory}
						</Button>
						<ProgressImportDialog variant="quiet" />
					</div>
				}
				description={title ?? t.ui.unnamed}
				title={t.engagement.progressJournal.title}
			/>

			<CurrentProgressCard />

			<section aria-labelledby="progress-history-heading" className="grid gap-4">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h2
							className="font-heading text-xl font-bold"
							id="progress-history-heading"
						>
							{t.engagement.progressJournal.historyTitle}
						</h2>
						<p className="mt-1 text-muted-foreground text-sm">
							{t.engagement.progressJournal.description}
						</p>
					</div>
					<RadioGroup
						className="gap-2"
						onValueChange={({ value }) => {
							setSelectedId(undefined);
							void setHistoryFilter(toProgressHistoryFilter(value));
						}}
						value={historyFilter}
					>
						<RadioGroupLabel>
							{t.engagement.progressJournal.filterLabel}
						</RadioGroupLabel>
						<div className="flex flex-wrap gap-2">
							{ProgressHistoryFilters.map((status) => (
								<RadioGroupItem
									className="min-h-10 rounded-full border border-input px-3 py-1.5 data-[state=checked]:border-primary data-[state=checked]:bg-primary/8"
									key={status}
									value={status}
								>
									{t.engagement.progressJournal.filters[status]}
								</RadioGroupItem>
							))}
						</div>
					</RadioGroup>
				</div>
				{entries.isPending ? (
					<QueryPending />
				) : entries.isError ? (
					<QueryFailure error={entries.error} retry={() => void entries.refetch()} />
				) : items.length ? (
					<div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
						<div className="grid gap-3">
							{items.map((entry) => {
								const selected = entry.id === selectedEntry?.id;
								return (
									<div key={entry.id}>
										<ProgressTimelineItem
											entry={entry}
											onSelect={() => setSelectedId(entry.id)}
											selected={selected}
											type={progress.domain.type}
										/>
										{selected ? (
											<div className="mt-3 lg:hidden">
												<ProgressEntryDetails
													entry={entry}
													onDelete={() => setDeletingEntry(entry)}
													onEdit={() => {
														setEditingEntry(entry);
														setEditorOpen(true);
													}}
													type={progress.domain.type}
												/>
											</div>
										) : null}
									</div>
								);
							})}
							{entries.hasNextPage ? (
								<Button
									className="justify-self-center"
									isLoading={entries.isFetchingNextPage}
									onClick={() => void entries.fetchNextPage()}
									variant="outline"
								>
									{t.engagement.progressJournal.loadMore}
								</Button>
							) : null}
						</div>
						<div className="sticky top-6 hidden lg:block">
							{selectedEntry ? (
								<ProgressEntryDetails
									entry={selectedEntry}
									onDelete={() => setDeletingEntry(selectedEntry)}
									onEdit={() => {
										setEditingEntry(selectedEntry);
										setEditorOpen(true);
									}}
									type={progress.domain.type}
								/>
							) : null}
						</div>
					</div>
				) : (
					<Card appearance="outlined">
						<CardContent className="grid justify-items-center gap-3 px-6 py-12 text-center">
							<History aria-hidden className="size-8 text-muted-foreground" />
							<p className="font-medium">{t.engagement.progressJournal.noEntries}</p>
							<Button
								onClick={() => {
									setEditingEntry(undefined);
									setEditorOpen(true);
								}}
								variant="outline"
							>
								<Plus aria-hidden />
								{t.engagement.progressJournal.addHistory}
							</Button>
						</CardContent>
					</Card>
				)}
			</section>

			<UnitProgressDialog />
			<ProgressEntryDialog
				entry={editingEntry}
				onOpenChange={(open) => {
					setEditorOpen(open);
					if (!open) setEditingEntry(undefined);
				}}
				open={editorOpen}
			/>
			<DeleteProgressEntryDialog
				entry={deletingEntry}
				onOpenChange={(open) => {
					if (!open) setDeletingEntry(undefined);
				}}
			/>
		</main>
	);
}

function CurrentProgressCard() {
	const progress = useUnitProgress();
	const { t } = useTranslation(["engagement", "ui"]);
	const copy = t.engagement.progressByType[progress.domain.type];
	if (progress.state.kind === "loading") return <QueryPending />;
	if (progress.state.kind === "error")
		return <QueryFailure error={progress.state.error} retry={() => progress.retryProgress()} />;
	const record =
		progress.state.kind === "untracked" || progress.state.kind === "signed-out"
			? null
			: progressRecordFromEditableState(progress.state);
	const percent = Math.round((record?.progress ?? 0) * 100);
	return (
		<Card appearance="outlined">
			<CardHeader>
				<CardTitle>{copy.summaryTitle}</CardTitle>
				<CardDescription>
					{record ? copy.statuses[record.status] : t.engagement.progressNotRecorded}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
				<div className="grid gap-2">
					<Progress
						aria-label={copy.progressLabel}
						aria-valuetext={t.engagement.progressPercent({ percent })}
						value={percent}
					/>
					<span className="text-muted-foreground text-xs">{copy.progressLabel}</span>
				</div>
				<div className="grid gap-1">
					<span className="text-muted-foreground text-xs">{copy.progressLabel}</span>
					<strong className="font-heading text-xl tabular-nums">
						{t.engagement.progressPercent({ percent })}
					</strong>
				</div>
				<div className="grid gap-1">
					<span className="text-muted-foreground text-xs">{copy.completedCount}</span>
					<strong className="font-heading text-xl tabular-nums">
						{record?.completedCount ?? 0}
					</strong>
				</div>
			</CardContent>
		</Card>
	);
}

function ProgressTimelineItem({
	entry,
	onSelect,
	selected,
	type,
}: {
	readonly entry: ProgressEntry;
	readonly onSelect: () => void;
	readonly selected: boolean;
	readonly type: ProgressTrackableUnitType;
}) {
	const progress = useUnitProgress();
	const { locale, t } = useTranslation(["engagement"]);
	const date = formatProgressEntryDate(
		entry.occurredAt,
		entry.datePrecision,
		locale.current,
		t.engagement.progressJournal.unknownDate,
	);
	return (
		<button
			aria-pressed={selected}
			className={cn(
				"grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-xl border p-4 text-left transition-colors",
				selected
					? "border-primary bg-primary/6"
					: "border-border-weak bg-card hover:bg-muted/50",
			)}
			onClick={onSelect}
			type="button"
		>
			<span
				className={cn(
					"mt-0.5 flex size-8 items-center justify-center rounded-full",
					entry.entryKind === "completion"
						? "bg-primary text-primary-foreground"
						: "bg-muted text-muted-foreground",
				)}
			>
				{entry.entryKind === "completion" ? (
					<CheckCircle2 aria-hidden className="size-4" />
				) : (
					<Clock3 aria-hidden className="size-4" />
				)}
			</span>
			<span className="min-w-0">
				<span className="block font-medium text-sm">
					<ProgressEventDescription entry={entry} type={type} />
				</span>
				<span className="mt-1 block text-muted-foreground text-xs">{date}</span>
			</span>
			<span className="flex flex-col items-end gap-1">
				<Badge variant="secondary">
					{t.engagement.progressByType[type].statuses[entry.status]}
				</Badge>
				{entry.id === progress.currentEntryId ? (
					<span className="text-muted-foreground text-xs">
						{t.engagement.progressJournal.affectsCurrentShort}
					</span>
				) : null}
			</span>
		</button>
	);
}

function ProgressEntryDetails({
	entry,
	onDelete,
	onEdit,
	type,
}: {
	readonly entry: ProgressEntry;
	readonly onDelete: () => void;
	readonly onEdit: () => void;
	readonly type: ProgressTrackableUnitType;
}) {
	const progress = useUnitProgress();
	const { locale, t } = useTranslation(["engagement"]);
	const copy = t.engagement.progressJournal;
	const contentStructureNode =
		type === "software"
			? undefined
			: progress.contentStructureNodes.find(
					(candidate) => candidate.id === entry.lastContentStructureNodeId,
				);
	const contentStructureNodeLabel =
		type === "book"
			? t.engagement.progressByType.book.lastChapter
			: type === "media"
				? t.engagement.progressByType.media.currentItem
				: undefined;
	const date = formatProgressEntryDate(
		entry.occurredAt,
		entry.datePrecision,
		locale.current,
		copy.unknownDate,
	);
	const minutes = Math.round((toFiniteApiNumber(entry.totalTimeMs) ?? 0) / 60_000);
	return (
		<Card appearance="outlined">
			<CardHeader>
				<CardTitle>{copy.entryDetails}</CardTitle>
				<CardDescription>
					<ProgressEventDescription entry={entry} type={type} />
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-5">
				<dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
					<dt className="text-muted-foreground">{copy.occurredAt}</dt>
					<dd className="text-right">{date}</dd>
					<dt className="text-muted-foreground">{copy.status}</dt>
					<dd className="text-right">
						{t.engagement.progressByType[type].statuses[entry.status]}
					</dd>
					<dt className="text-muted-foreground">{copy.percentage}</dt>
					<dd className="text-right tabular-nums">
						{t.engagement.progressPercent({
							percent: Math.round(entry.progress * 100),
						})}
					</dd>
					{contentStructureNode && contentStructureNodeLabel ? (
						<>
							<dt className="text-muted-foreground">{contentStructureNodeLabel}</dt>
							<dd className="text-right">{contentStructureNode.title}</dd>
						</>
					) : null}
					{type === "book" ? null : (
						<>
							<dt className="text-muted-foreground">{copy.totalMinutes}</dt>
							<dd className="text-right tabular-nums">{minutes}</dd>
						</>
					)}
					<dt className="text-muted-foreground">{copy.entryKind}</dt>
					<dd className="text-right">{copy.kinds[entry.entryKind]}</dd>
					{entry.entryKind === "completion" ? (
						<>
							<dt className="text-muted-foreground">{copy.completionIncrement}</dt>
							<dd className="text-right">
								{toNonNegativeApiInteger(entry.completionDelta)}
							</dd>
						</>
					) : null}
				</dl>
				<div className="flex flex-wrap gap-2 border-t border-border-weak pt-4">
					{entry.reviewId ? (
						<Button asChild size="sm" variant="solid">
							<Link href={postHref(entry.reviewId)}>
								<Star aria-hidden />
								{copy.viewReview}
							</Link>
						</Button>
					) : (
						<Button asChild size="sm" variant="solid">
							<Link href={progressEntryReviewHref(type, entry.unitId, entry.id)}>
								<Star aria-hidden />
								{copy.writeReview}
							</Link>
						</Button>
					)}
					<Button onClick={onEdit} size="sm" variant="outline">
						<Pencil aria-hidden />
						{copy.editEntry}
					</Button>
					<Button
						className="text-destructive hover:text-destructive"
						onClick={onDelete}
						size="sm"
						variant="quiet"
					>
						<Trash2 aria-hidden />
						{copy.deleteEntry}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function DeleteProgressEntryDialog({
	entry,
	onOpenChange,
}: {
	readonly entry?: ProgressEntry;
	readonly onOpenChange: (open: boolean) => void;
}) {
	const progress = useUnitProgress();
	const queryClient = useQueryClient();
	const remove = useDeleteApiProgressByUnitIdEntriesByEntryId();
	const { t } = useTranslation(["engagement", "ui"]);
	async function confirm() {
		if (!entry) return;
		try {
			await remove.mutateAsync({
				path: { unitId: progress.domain.unitId, entryId: entry.id },
			});
			await invalidateProgressQueries(queryClient, progress.domain.unitId);
			onOpenChange(false);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	return (
		<AlertDialog
			onOpenChange={({ open }) => {
				if (!remove.isPending) onOpenChange(open);
			}}
			open={Boolean(entry)}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t.engagement.progressJournal.deleteEntry}</AlertDialogTitle>
				</AlertDialogHeader>
				<AlertDialogBody className="grid gap-3">
					<AlertDialogDescription>
						{t.engagement.progressJournal.deletePrompt}
					</AlertDialogDescription>
					<RequestFailure error={remove.error} fallback={t.ui.retryLater} />
				</AlertDialogBody>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={remove.isPending}>
						{t.engagement.cancel}
					</AlertDialogCancel>
					<AlertDialogAction
						isLoading={remove.isPending}
						onClick={() => void confirm()}
						variant="destructive"
					>
						{t.engagement.delete}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
