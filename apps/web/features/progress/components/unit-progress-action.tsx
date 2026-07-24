"use client";

import type { Translation } from "@rezics/i18n";
import { Button, cn } from "@rezics/ui";
import { CheckCircle2, Gauge, Play, RefreshCw, RotateCcw } from "lucide-react";

import { SignInButton } from "@/features/auth/auth-portal";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useUnitProgress } from "./unit-progress-provider";
import type { ProgressStatus, UnitProgressDomain } from "../model/progress-record";

export function UnitProgressAction({
	buttonClassName,
	className,
}: {
	readonly buttonClassName?: string;
	readonly className?: string;
} = {}) {
	const {
		completionFeedbackCount,
		domain,
		isCompleting,
		isSaving,
		openEditor,
		resumeProgress,
		retryProgress,
		saveError,
		startAgain,
		state,
	} = useUnitProgress();
	const { t } = useTranslation(["actions", "engagement", "ui"]);
	const copy = t.engagement.progressByType[domain.type];

	if (state.kind === "signed-out")
		return (
			<SignInButton
				className={cn("min-h-9", className, buttonClassName)}
				size="sm"
				variant="outline"
			>
				<Gauge aria-hidden data-icon="inline-start" />
				{copy.recordAction}
			</SignInButton>
		);

	if (state.kind === "loading")
		return (
			<Button
				className={cn("min-h-9", className, buttonClassName)}
				isLoading
				size="sm"
				variant="outline"
			>
				{copy.recordAction}
			</Button>
		);

	if (state.kind === "error")
		return (
			<div className={cn("grid justify-items-start gap-1", className)}>
				<Button
					className={cn("min-h-9", buttonClassName)}
					onClick={retryProgress}
					size="sm"
					variant="outline"
				>
					<RefreshCw aria-hidden data-icon="inline-start" />
					{t.actions.retry}
				</Button>
				<RequestFailure error={state.error} fallback={t.ui.retryLater} />
			</div>
		);

	const feedbackCount =
		completionFeedbackCount ?? (isCompleting ? state.record?.completedCount : undefined);
	const label =
		feedbackCount === undefined
			? progressActionLabel(t, domain.type, state.record?.status)
			: copy.completedFeedback({ count: feedbackCount });
	const Icon =
		feedbackCount !== undefined
			? CheckCircle2
			: state.record?.status === "completed"
				? RotateCcw
				: state.record?.status === "paused" || state.record?.status === "backlog"
					? Play
					: Gauge;
	const activate =
		state.record?.status === "paused" || state.record?.status === "backlog"
			? resumeProgress
			: state.record?.status === "completed" || state.record?.status === "dropped"
				? startAgain
				: undefined;

	return (
		<div className={cn("grid justify-items-start gap-1", className)}>
			<Button
				className={cn("min-h-9 overflow-hidden", buttonClassName)}
				disabled={isCompleting}
				isLoading={isSaving}
				onClick={() => {
					if (activate) void activate();
					else openEditor();
				}}
				size="sm"
				variant={state.record?.status === "active" ? "secondary" : "outline"}
			>
				<Icon
					aria-hidden
					className={
						feedbackCount === undefined
							? undefined
							: "animate-in zoom-in-75 fade-in duration-300 motion-reduce:animate-none"
					}
					data-icon="inline-start"
				/>
				<span
					className={
						feedbackCount === undefined
							? undefined
							: "animate-in slide-in-from-bottom-1 fade-in duration-300 motion-reduce:animate-none"
					}
					key={label}
				>
					{label}
				</span>
			</Button>
			<RequestFailure error={saveError} fallback={t.ui.retryLater} />
		</div>
	);
}

function progressActionLabel(
	t: Pick<Translation, "engagement">,
	type: UnitProgressDomain["type"],
	status: ProgressStatus | undefined,
): string {
	const copy = t.engagement.progressByType[type];
	switch (status) {
		case undefined:
			return copy.recordAction;
		case "backlog":
			return copy.startAction;
		case "active":
			return copy.updateAction;
		case "paused":
			return copy.resumeAction;
		case "completed":
			return copy.startAgainAction;
		case "dropped":
			return copy.restartAction;
	}
}
