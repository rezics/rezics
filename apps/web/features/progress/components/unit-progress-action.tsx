"use client";

import type { Translation } from "@rezics/i18n";
import { Button, ButtonGroup, cn } from "@rezics/ui";
import { CheckCircle2, ChevronDown, Gauge, Play, RefreshCw, RotateCcw } from "lucide-react";

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
			<ButtonGroup className={cn("w-full", className)}>
				<SignInButton
					className={cn("min-h-10 min-w-0 flex-1", buttonClassName)}
					size="sm"
					variant="outline"
				>
					<Gauge aria-hidden data-icon="inline-start" />
					{copy.recordAction}
				</SignInButton>
				<SignInButton
					aria-label={copy.title}
					className="min-h-10 w-10"
					size="icon-md"
					variant="outline"
				>
					<ChevronDown aria-hidden />
				</SignInButton>
			</ButtonGroup>
		);

	if (state.kind === "loading")
		return (
			<ButtonGroup className={cn("w-full", className)}>
				<Button
					className={cn("min-h-10 min-w-0 flex-1", buttonClassName)}
					isLoading
					size="sm"
					variant="outline"
				>
					{copy.recordAction}
				</Button>
				<Button
					aria-label={copy.title}
					className="min-h-10 w-10"
					disabled
					size="icon-md"
					variant="outline"
				>
					<ChevronDown aria-hidden />
				</Button>
			</ButtonGroup>
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
	const variant = state.record?.status === "active" ? "secondary" : "outline";

	return (
		<div className={cn("grid justify-items-start gap-1", className)}>
			<ButtonGroup className="w-full">
				<Button
					className={cn("min-h-10 min-w-0 flex-1 overflow-hidden", buttonClassName)}
					disabled={isCompleting}
					isLoading={isSaving}
					onClick={() => {
						if (activate) void activate();
						else openEditor();
					}}
					size="sm"
					variant={variant}
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
				<Button
					aria-haspopup="dialog"
					aria-label={copy.title}
					className="min-h-10 w-10"
					disabled={isCompleting || isSaving}
					onClick={openEditor}
					size="icon-md"
					variant={variant}
				>
					<ChevronDown aria-hidden />
				</Button>
			</ButtonGroup>
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
