"use client";

import type { Translation } from "@rezics/i18n";
import {
	Badge,
	Button,
	Card,
	CardContent,
	DataList,
	DataListItem,
	DataListItemLabel,
	DataListItemValue,
	Skeleton,
} from "@rezics/ui";
import { PencilLine, RefreshCw } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useUnitProgress } from "./unit-progress-provider";
import { UnitProgressDisplay } from "./unit-progress-display";
import type { UnitProgressDomain, UnitProgressRecord } from "../model/progress-record";

export function UnitProgressSummaryCard() {
	const {
		chapters,
		completionFeedbackCount,
		domain,
		isCompleting,
		openEditor,
		retryProgress,
		state,
	} = useUnitProgress();
	const { t } = useTranslation(["actions", "engagement", "state", "ui"]);
	const copy = t.engagement.progressByType[domain.type];

	if (state.kind === "signed-out") return null;

	return (
		<section className="grid gap-3">
			<h2 className="font-heading text-xl font-bold">{copy.summaryTitle}</h2>
			<Card appearance="outlined">
				<CardContent className="grid gap-4 p-5">
					{state.kind === "loading" ? (
						<>
							<Skeleton className="h-6 w-24" />
							<Skeleton className="h-2 w-full" />
							<Skeleton className="h-9 w-full" />
						</>
					) : state.kind === "error" ? (
						<div className="grid justify-items-start gap-3">
							<RequestFailure error={state.error} fallback={t.ui.retryLater} />
							<Button onClick={retryProgress} size="sm" variant="outline">
								<RefreshCw aria-hidden data-icon="inline-start" />
								{t.actions.retry}
							</Button>
						</div>
					) : (
						<ProgressSummary
							chapters={chapters}
							completionFeedbackCount={completionFeedbackCount}
							domain={domain}
							isCompleting={isCompleting}
							onEdit={openEditor}
							record={state.record}
							t={t}
						/>
					)}
				</CardContent>
			</Card>
		</section>
	);
}

function ProgressSummary({
	chapters,
	completionFeedbackCount,
	domain,
	isCompleting,
	onEdit,
	record,
	t,
}: {
	readonly chapters: readonly { readonly id: string; readonly title: string }[];
	readonly completionFeedbackCount: number | undefined;
	readonly domain: UnitProgressDomain;
	readonly isCompleting: boolean;
	readonly onEdit: () => void;
	readonly record: UnitProgressRecord | null;
	readonly t: Pick<Translation, "engagement">;
}) {
	const copy = t.engagement.progressByType[domain.type];
	const percentage = Math.round((record?.progress ?? 0) * 100);
	const chapter = chapters.find(
		(candidate) => candidate.id === record?.lastContentStructureNodeId,
	);
	const actionLabel = record ? copy.updateAction : copy.recordAction;

	return (
		<>
			<div className="flex items-center justify-between gap-3">
				<span className="text-sm font-medium">{copy.status}</span>
				<Badge variant={record ? "secondary" : "outline"}>
					{record ? copy.statuses[record.status] : t.engagement.progressNotRecorded}
				</Badge>
			</div>

			{record && domain.type !== "software" ? (
				<UnitProgressDisplay
					label={progressLabel(t, domain.type)}
					percentage={percentage}
				/>
			) : null}

			{record ? (
				<DataList>
					<DataListItem>
						<DataListItemLabel>{copy.completedCount}</DataListItemLabel>
						<DataListItemValue
							className={
								completionFeedbackCount === undefined && !isCompleting
									? "tabular-nums"
									: "animate-in slide-in-from-bottom-2 fade-in tabular-nums duration-300 motion-reduce:animate-none"
							}
							key={record.completedCount}
						>
							{record.completedCount}
						</DataListItemValue>
					</DataListItem>
					{domain.type === "book" && chapter ? (
						<DataListItem>
							<DataListItemLabel>
								{t.engagement.progressByType.book.lastChapter}
							</DataListItemLabel>
							<DataListItemValue className="min-w-0 break-words text-end">
								{chapter.title}
							</DataListItemValue>
						</DataListItem>
					) : null}
					{domain.type !== "book" ? (
						<DataListItem>
							<DataListItemLabel>
								{totalMinutesLabel(t, domain.type)}
							</DataListItemLabel>
							<DataListItemValue className="tabular-nums">
								{Math.round(record.totalTimeMs / 60_000)}
							</DataListItemValue>
						</DataListItem>
					) : null}
				</DataList>
			) : null}

			<Button className="min-h-11 w-full" onClick={onEdit} variant="outline">
				<PencilLine aria-hidden data-icon="inline-start" />
				{actionLabel}
			</Button>
		</>
	);
}

function progressLabel(t: Pick<Translation, "engagement">, type: "book" | "media"): string {
	return type === "book"
		? t.engagement.progressByType.book.progress
		: t.engagement.progressByType.media.progress;
}

function totalMinutesLabel(t: Pick<Translation, "engagement">, type: "media" | "software"): string {
	return type === "media"
		? t.engagement.progressByType.media.totalMinutes
		: t.engagement.progressByType.software.totalMinutes;
}
