"use client";

import { Button, ButtonGroup, cn, type ButtonVariant } from "@rezics/ui";
import {
	CheckCircle2,
	ChevronDown,
	Gauge,
	Play,
	RefreshCw,
	RotateCcw,
	type LucideIcon,
} from "lucide-react";

import { SignInButton } from "@/features/auth/auth-portal";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import type { UnitProgressRecord } from "../model/progress-record";
import { progressContinuationHref } from "../model/progress-continuation";
import { useUnitProgress } from "./unit-progress-provider";

interface UnitProgressActionLayoutProps {
	readonly buttonClassName?: string;
	readonly className?: string;
}

interface UnitProgressActionProps extends UnitProgressActionLayoutProps {
	readonly metadataOnly: boolean;
}

export function UnitProgressAction({
	buttonClassName,
	className,
	metadataOnly,
}: UnitProgressActionProps) {
	const { state } = useUnitProgress();
	const props = { buttonClassName, className };

	switch (state.kind) {
		case "signed-out":
			return <SignedOutProgressAction {...props} />;
		case "loading":
			return <LoadingProgressAction {...props} />;
		case "error":
			return <FailedProgressAction {...props} error={state.error} />;
		case "untracked":
			return <UntrackedProgressAction {...props} />;
		case "backlog":
			return <BacklogProgressAction {...props} />;
		case "active":
			return <ActiveProgressAction {...props} metadataOnly={metadataOnly} record={state.record} />;
		case "paused":
			return <PausedProgressAction {...props} />;
		case "completed":
			return <CompletedProgressAction {...props} record={state.record} />;
		case "dropped":
			return <DroppedProgressAction {...props} />;
	}
}

function SignedOutProgressAction({ buttonClassName, className }: UnitProgressActionLayoutProps) {
	const { domain } = useUnitProgress();
	const { t } = useTranslation(["engagement"]);
	const copy = t.engagement.progressByType[domain.type];

	return (
		<ButtonGroup className={cn("w-full", className)}>
			<SignInButton
				className={cn("min-h-10 min-w-0 flex-1", buttonClassName)}
				size="sm"
				variant="brand"
			>
				<Gauge aria-hidden data-icon="inline-start" />
				{copy.statuses.backlog}
			</SignInButton>
			<SignInButton
				aria-label={copy.title}
				className="min-h-10 w-10"
				size="icon-md"
				variant="brand"
			>
				<ChevronDown aria-hidden />
			</SignInButton>
		</ButtonGroup>
	);
}

function LoadingProgressAction({ buttonClassName, className }: UnitProgressActionLayoutProps) {
	const { domain } = useUnitProgress();
	const { t } = useTranslation(["engagement"]);
	const copy = t.engagement.progressByType[domain.type];

	return (
		<ProgressSplitButton
			Icon={Gauge}
			ariaLabel={copy.title}
			buttonClassName={buttonClassName}
			className={className}
			disabled
			isLoading
			label={copy.statuses.backlog}
			onPrimaryAction={() => undefined}
			onSecondaryAction={() => undefined}
			variant="brand"
		/>
	);
}

function FailedProgressAction({
	buttonClassName,
	className,
	error,
}: UnitProgressActionLayoutProps & { readonly error: unknown }) {
	const { retryProgress } = useUnitProgress();
	const { t } = useTranslation(["actions", "ui"]);

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
			<RequestFailure error={error} fallback={t.ui.retryLater} />
		</div>
	);
}

function UntrackedProgressAction({ buttonClassName, className }: UnitProgressActionLayoutProps) {
	const { addToBacklog, domain, isSaving, openEditor, saveError } = useUnitProgress();
	const { t } = useTranslation(["engagement", "ui"]);
	const copy = t.engagement.progressByType[domain.type];

	return (
		<ProgressSplitButton
			Icon={Gauge}
			ariaLabel={copy.title}
			buttonClassName={buttonClassName}
			className={className}
			error={saveError}
			errorFallback={t.ui.retryLater}
			isLoading={isSaving}
			label={copy.statuses.backlog}
			onPrimaryAction={() => void addToBacklog()}
			onSecondaryAction={openEditor}
			variant="brand"
		/>
	);
}

function BacklogProgressAction({ buttonClassName, className }: UnitProgressActionLayoutProps) {
	const { domain, isSaving, openEditor, resumeProgress, saveError } = useUnitProgress();
	const { t } = useTranslation(["engagement", "ui"]);
	const copy = t.engagement.progressByType[domain.type];

	return (
		<ProgressSplitButton
			Icon={Play}
			ariaLabel={copy.title}
			buttonClassName={buttonClassName}
			className={className}
			error={saveError}
			errorFallback={t.ui.retryLater}
			isLoading={isSaving}
			label={copy.startAction}
			onPrimaryAction={() => void resumeProgress()}
			onSecondaryAction={openEditor}
			variant="outline"
		/>
	);
}

function ActiveProgressAction({
	buttonClassName,
	className,
	metadataOnly,
	record,
}: UnitProgressActionLayoutProps & {
	readonly metadataOnly: boolean;
	readonly record: UnitProgressRecord<"active">;
}) {
	const { domain, openEditor, saveError } = useUnitProgress();
	const { t } = useTranslation(["engagement", "ui"]);
	const copy = t.engagement.progressByType[domain.type];
	const router = useApplicationRouter();
	const continuationHref = progressContinuationHref(record.continuation);
	const continuesContent = !metadataOnly && (domain.type === "book" || domain.type === "media");

	return (
		<ProgressSplitButton
			Icon={continuesContent ? Play : Gauge}
			ariaLabel={copy.title}
			buttonClassName={buttonClassName}
			className={className}
			error={saveError}
			errorFallback={t.ui.retryLater}
			label={continuesContent ? t.engagement.continueAction : copy.updateAction}
			onPrimaryAction={() =>
				continuationHref && continuesContent ? router.push(continuationHref) : openEditor()
			}
			onSecondaryAction={openEditor}
			variant="secondary"
		/>
	);
}

function PausedProgressAction({ buttonClassName, className }: UnitProgressActionLayoutProps) {
	const { domain, isSaving, openEditor, resumeProgress, saveError } = useUnitProgress();
	const { t } = useTranslation(["engagement", "ui"]);
	const copy = t.engagement.progressByType[domain.type];

	return (
		<ProgressSplitButton
			Icon={Play}
			ariaLabel={copy.title}
			buttonClassName={buttonClassName}
			className={className}
			error={saveError}
			errorFallback={t.ui.retryLater}
			isLoading={isSaving}
			label={copy.resumeAction}
			onPrimaryAction={() => void resumeProgress()}
			onSecondaryAction={openEditor}
			variant="outline"
		/>
	);
}

function CompletedProgressAction({
	buttonClassName,
	className,
	record,
}: UnitProgressActionLayoutProps & {
	readonly record: UnitProgressRecord<"completed">;
}) {
	const {
		completionFeedbackCount,
		domain,
		isCompleting,
		isSaving,
		openEditor,
		saveError,
		startAgain,
	} = useUnitProgress();
	const { t } = useTranslation(["engagement", "ui"]);
	const copy = t.engagement.progressByType[domain.type];
	const feedbackCount =
		completionFeedbackCount ?? (isCompleting ? record.completedCount : undefined);
	const showingFeedback = feedbackCount !== undefined;

	return (
		<ProgressSplitButton
			Icon={showingFeedback ? CheckCircle2 : RotateCcw}
			ariaLabel={copy.title}
			buttonClassName={buttonClassName}
			className={className}
			disabled={showingFeedback}
			error={saveError}
			errorFallback={t.ui.retryLater}
			feedback={showingFeedback}
			isLoading={isSaving}
			label={
				showingFeedback ? copy.completedFeedback({ count: feedbackCount }) : copy.startAgainAction
			}
			onPrimaryAction={() => void startAgain()}
			onSecondaryAction={openEditor}
			variant="outline"
		/>
	);
}

function DroppedProgressAction({ buttonClassName, className }: UnitProgressActionLayoutProps) {
	const { domain, isSaving, openEditor, saveError, startAgain } = useUnitProgress();
	const { t } = useTranslation(["engagement", "ui"]);
	const copy = t.engagement.progressByType[domain.type];

	return (
		<ProgressSplitButton
			Icon={RotateCcw}
			ariaLabel={copy.title}
			buttonClassName={buttonClassName}
			className={className}
			error={saveError}
			errorFallback={t.ui.retryLater}
			isLoading={isSaving}
			label={copy.restartAction}
			onPrimaryAction={() => void startAgain()}
			onSecondaryAction={openEditor}
			variant="outline"
		/>
	);
}

function ProgressSplitButton({
	Icon,
	ariaLabel,
	buttonClassName,
	className,
	disabled = false,
	error,
	errorFallback,
	feedback = false,
	isLoading = false,
	label,
	onPrimaryAction,
	onSecondaryAction,
	variant,
}: UnitProgressActionLayoutProps & {
	readonly Icon: LucideIcon;
	readonly ariaLabel: string;
	readonly disabled?: boolean;
	readonly error?: unknown;
	readonly errorFallback?: string;
	readonly feedback?: boolean;
	readonly isLoading?: boolean;
	readonly label: string;
	readonly onPrimaryAction: () => void;
	readonly onSecondaryAction: () => void;
	readonly variant: ButtonVariant;
}) {
	return (
		<div className={cn("grid justify-items-start gap-1", className)}>
			<ButtonGroup className="w-full">
				<Button
					className={cn("min-h-10 min-w-0 flex-1 overflow-hidden", buttonClassName)}
					disabled={disabled}
					isLoading={isLoading}
					onClick={onPrimaryAction}
					size="sm"
					variant={variant}
				>
					<Icon
						aria-hidden
						className={
							feedback
								? "animate-in zoom-in-75 fade-in duration-300 motion-reduce:animate-none"
								: undefined
						}
						data-icon="inline-start"
					/>
					<span
						className={
							feedback
								? "animate-in slide-in-from-bottom-1 fade-in duration-300 motion-reduce:animate-none"
								: undefined
						}
						key={label}
					>
						{label}
					</span>
				</Button>
				<Button
					aria-haspopup="dialog"
					aria-label={ariaLabel}
					className="min-h-10 w-10"
					disabled={disabled || isLoading}
					onClick={onSecondaryAction}
					size="icon-md"
					variant={variant}
				>
					<ChevronDown aria-hidden />
				</Button>
			</ButtonGroup>
			<RequestFailure error={error} fallback={errorFallback} />
		</div>
	);
}
