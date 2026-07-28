"use client";

import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
	Progress,
	Skeleton,
	cn,
} from "@rezics/ui";
import { ArrowRight, History } from "lucide-react";
import Link from "next/link";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { progressRecordFromEditableState } from "../model/progress-state";
import { unitProgressHref } from "../routing/progress-routes";
import { useUnitProgress } from "./unit-progress-provider";

export function UnitProgressSummaryCard({ className }: { readonly className?: string }) {
	const progress = useUnitProgress();
	const { t } = useTranslation(["engagement", "ui"]);
	const copy = t.engagement.progressByType[progress.domain.type];

	if (progress.state.kind === "signed-out") return null;
	if (progress.state.kind === "loading")
		return (
			<Card appearance="outlined" className={className}>
				<CardHeader>
					<Skeleton className="h-5 w-32" />
					<Skeleton className="h-4 w-24" />
				</CardHeader>
				<CardContent className="grid gap-3">
					<Skeleton className="h-2 w-full" />
					<Skeleton className="h-9 w-full" />
				</CardContent>
			</Card>
		);
	if (progress.state.kind === "error")
		return (
			<Card appearance="outlined" className={className}>
				<CardHeader>
					<CardTitle>{copy.summaryTitle}</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-3">
					<RequestFailure error={progress.state.error} fallback={t.ui.retryLater} />
					<Button
						className="w-fit"
						onClick={progress.retryProgress}
						size="sm"
						variant="outline"
					>
						{t.engagement.retryProgress}
					</Button>
				</CardContent>
			</Card>
		);

	const record =
		progress.state.kind === "untracked"
			? null
			: progressRecordFromEditableState(progress.state);
	const percentage = Math.round((record?.progress ?? 0) * 100);
	const href = unitProgressHref(progress.domain.type, progress.domain.unitId);

	return (
		<Card appearance="outlined" className={cn("overflow-hidden", className)}>
			<CardHeader>
				<CardTitle>{copy.summaryTitle}</CardTitle>
				<CardDescription>
					{record ? copy.statuses[record.status] : t.engagement.progressNotRecorded}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4">
				<Progress
					aria-label={copy.progressLabel}
					aria-valuetext={t.engagement.progressPercent({ percent: percentage })}
					value={percentage}
				/>
				<div className="grid grid-cols-2 gap-3">
					<div className="grid gap-1">
						<span className="text-muted-foreground text-xs">{copy.progressLabel}</span>
						<strong className="font-heading text-xl tabular-nums">
							{t.engagement.progressPercent({ percent: percentage })}
						</strong>
					</div>
					<div className="grid gap-1">
						<span className="text-muted-foreground text-xs">{copy.completedCount}</span>
						<strong className="font-heading text-xl tabular-nums">
							{record?.completedCount ?? 0}
						</strong>
					</div>
				</div>
			</CardContent>
			<CardFooter>
				<Button asChild className="w-full justify-between" size="sm" variant="outline">
					<Link href={href}>
						<span className="inline-flex items-center gap-2">
							<History aria-hidden data-icon="inline-start" />
							{t.engagement.viewProgressHistory}
						</span>
						<ArrowRight aria-hidden data-icon="inline-end" />
					</Link>
				</Button>
			</CardFooter>
		</Card>
	);
}
