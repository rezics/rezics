"use client";

import type { Translation } from "@rezics/i18n";
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
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	NativeSelect,
	NativeSelectOption,
	RadioGroup,
	RadioGroupItem,
	RadioGroupLabel,
	Slider,
	SliderLabel,
	SliderValue,
} from "@rezics/ui";
import { RotateCcw, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { useTranslation } from "@/i18n/client";
import {
	DefaultResourceVisibility,
	isResourceVisibility,
	ResourceVisibilityValues,
	type ResourceVisibility,
} from "@/features/privacy/model/resource-visibility";
import { RequestFailure } from "@/i18n/request-failure";
import {
	changeProgressDraftStatus,
	createProgressDraft,
	createProgressUpdate,
	isCompletionTransition,
	parseBoundedNumber,
	ProgressStatuses,
	type ProgressDraft,
	type ProgressStatus,
	type UnitProgressDomain,
	type UnitProgressRecord,
} from "../model/progress-record";
import { isEditableProgressState, progressRecordFromEditableState } from "../model/progress-state";
import { CompleteProgressButton } from "./complete-progress-button";
import { useUnitProgress } from "./unit-progress-provider";

const ProgressFormId = "unit-progress-editor-form";

export function UnitProgressDialog() {
	const progress = useUnitProgress();
	const editorState = isEditableProgressState(progress.state) ? progress.state : undefined;
	return (
		<Dialog
			onOpenChange={({ open }) => {
				if (open) progress.openEditor();
				else progress.closeEditor();
			}}
			open={progress.editorOpen}
		>
			{progress.editorOpen && editorState ? (
				<ProgressEditor record={progressRecordFromEditableState(editorState)} />
			) : null}
		</Dialog>
	);
}

function ProgressEditor({ record }: { readonly record: UnitProgressRecord | null }) {
	const progress = useUnitProgress();
	const { t } = useTranslation(["engagement", "errors", "ui"]);
	const [sourceRecord] = useState(record);
	const [draft, setDraft] = useState(() => createProgressDraft(record));
	const [visibility, setVisibility] = useState<ResourceVisibility>(
		record?.visibility ?? DefaultResourceVisibility,
	);
	const [invalid, setInvalid] = useState(false);
	const [removeOpen, setRemoveOpen] = useState(false);
	const copy = t.engagement.progressByType[progress.domain.type];
	const completing = isCompletionTransition(sourceRecord, draft.status);
	const nextCompletedCount = (sourceRecord?.completedCount ?? 0) + 1;
	const submittedVisibility = sourceRecord ? visibility : DefaultResourceVisibility;

	async function completeCurrentProgress() {
		const update = createProgressUpdate(progress.domain.type, draft);
		if (!update) {
			setInvalid(true);
			return;
		}
		setInvalid(false);
		await progress.completeCurrentProgress(
			update.totalTimeMs === undefined
				? { visibility: submittedVisibility }
				: { totalTimeMs: update.totalTimeMs, visibility: submittedVisibility },
		);
	}

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (completing) {
			await completeCurrentProgress();
			return;
		}
		const update = createProgressUpdate(progress.domain.type, draft);
		if (!update) {
			setInvalid(true);
			return;
		}
		setInvalid(false);
		await progress.saveProgress({
			...update,
			visibility: submittedVisibility,
		});
	}

	async function confirmRemove() {
		if (await progress.removeProgress()) setRemoveOpen(false);
	}

	return (
		<DialogContent showCloseButton={false} size="lg">
			<DialogHeader description={copy.dialogDescription} title={copy.title} />
			<DialogBody className="grid gap-5">
				<form id={ProgressFormId} onSubmit={(event) => void submit(event)}>
					<FieldGroup>
						<ProgressStatusField
							onChange={(status) =>
								setDraft((current) =>
									changeProgressDraftStatus(current, status, sourceRecord),
								)
							}
							status={draft.status}
							t={t}
							type={progress.domain.type}
						/>
						{sourceRecord ? (
							<Field>
								<FieldLabel htmlFor="progress-visibility">
									{t.ui.visibility}
								</FieldLabel>
								<NativeSelect
									id="progress-visibility"
									onChange={(event) => {
										if (isResourceVisibility(event.target.value))
											setVisibility(event.target.value);
									}}
									value={visibility}
								>
									{ResourceVisibilityValues.map((value) => (
										<NativeSelectOption key={value} value={value}>
											{t.ui[value]}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Field>
						) : null}
						{progress.domain.type === "book" ? (
							<BookProgressFields draft={draft} onChange={setDraft} />
						) : progress.domain.type === "media" ? (
							<MediaProgressFields draft={draft} onChange={setDraft} />
						) : (
							<SoftwareProgressFields draft={draft} onChange={setDraft} />
						)}
					</FieldGroup>
				</form>

				{completing ? (
					<p className="rounded-lg bg-primary/8 px-4 py-3 text-sm text-foreground">
						{t.engagement.completionCountChange({
							current: sourceRecord?.completedCount ?? 0,
							next: nextCompletedCount,
						})}
					</p>
				) : null}

				{invalid ? (
					<p className="text-sm text-destructive" role="alert">
						{t.errors.invalid}
					</p>
				) : null}
				<RequestFailure
					error={progress.saveError ?? progress.completionError}
					fallback={t.ui.retryLater}
				/>

				{sourceRecord ? (
					<div className="border-t border-border-weak pt-4">
						<Button
							className="text-destructive hover:text-destructive"
							disabled={
								progress.isSaving || progress.isCompleting || progress.isRemoving
							}
							onClick={() => setRemoveOpen(true)}
							size="sm"
							variant="quiet"
						>
							<Trash2 aria-hidden data-icon="inline-start" />
							{t.engagement.removeProgress}
						</Button>
					</div>
				) : null}

				<AlertDialog
					onOpenChange={({ open }) => {
						if (!progress.isRemoving) setRemoveOpen(open);
					}}
					open={removeOpen}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>{t.engagement.removeProgress}</AlertDialogTitle>
						</AlertDialogHeader>
						<AlertDialogBody className="grid gap-3">
							<AlertDialogDescription>
								{t.engagement.removeProgressPrompt}
							</AlertDialogDescription>
							<RequestFailure
								error={progress.removeError}
								fallback={t.ui.retryLater}
							/>
						</AlertDialogBody>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={progress.isRemoving}>
								{t.engagement.cancel}
							</AlertDialogCancel>
							<AlertDialogAction
								disabled={progress.isRemoving}
								isLoading={progress.isRemoving}
								onClick={() => void confirmRemove()}
								variant="destructive"
							>
								{t.engagement.delete}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</DialogBody>

			<DialogFooter className="sm:justify-between">
				<Button
					disabled={progress.isSaving || progress.isCompleting || progress.isRemoving}
					onClick={progress.closeEditor}
					variant="quiet"
				>
					{t.engagement.cancel}
				</Button>
				<div className="flex flex-col-reverse gap-2 sm:flex-row">
					{sourceRecord?.status === "completed" && draft.status === "completed" ? (
						<Button
							className="min-h-11"
							disabled={progress.isSaving || progress.isRemoving}
							isLoading={progress.isSaving}
							onClick={() => void progress.startAgain()}
							variant="outline"
						>
							<RotateCcw aria-hidden data-icon="inline-start" />
							{copy.startAgainAction}
						</Button>
					) : null}
					{completing ? (
						<CompleteProgressButton
							completedLabel={copy.completedFeedback({
								count: nextCompletedCount,
							})}
							isCompleting={progress.isCompleting}
							label={copy.completeAction}
							onClick={() => void completeCurrentProgress()}
						/>
					) : (
						<Button
							className="min-h-11"
							disabled={progress.isRemoving || progress.isCompleting}
							form={ProgressFormId}
							isLoading={progress.isSaving}
							type="submit"
							variant="solid"
						>
							{t.engagement.updateProgress}
						</Button>
					)}
				</div>
			</DialogFooter>
		</DialogContent>
	);
}

function ProgressStatusField({
	onChange,
	status,
	t,
	type,
}: {
	readonly onChange: (status: ProgressStatus) => void;
	readonly status: ProgressStatus;
	readonly t: Pick<Translation, "engagement">;
	readonly type: UnitProgressDomain["type"];
}) {
	const copy = t.engagement.progressByType[type];
	return (
		<Field>
			<RadioGroup
				onValueChange={({ value }) => {
					const next = ProgressStatuses.find((candidate) => candidate === value);
					if (next) onChange(next);
				}}
				value={status}
			>
				<RadioGroupLabel>{copy.status}</RadioGroupLabel>
				<div className="grid gap-2 sm:grid-cols-2">
					{ProgressStatuses.map((candidate) => (
						<RadioGroupItem
							className="min-h-11 rounded-lg border border-input px-3 py-2 data-[state=checked]:border-primary data-[state=checked]:bg-primary/8"
							key={candidate}
							value={candidate}
						>
							{copy.statuses[candidate]}
						</RadioGroupItem>
					))}
				</div>
			</RadioGroup>
		</Field>
	);
}

function BookProgressFields({
	draft,
	onChange,
}: {
	readonly draft: ProgressDraft;
	readonly onChange: (draft: ProgressDraft | ((draft: ProgressDraft) => ProgressDraft)) => void;
}) {
	const progress = useUnitProgress();
	const { t } = useTranslation(["engagement", "ui"]);
	const copy = t.engagement.progressByType.book;
	const showPosition = draft.status !== "backlog" && draft.status !== "completed";

	if (!showPosition) return null;

	return (
		<>
			<PercentageField draft={draft} label={copy.progress} onChange={onChange} />
			<Field>
				<FieldLabel htmlFor="unit-progress-chapter">{copy.lastChapter}</FieldLabel>
				<NativeSelect
					disabled={progress.chaptersPending || Boolean(progress.chaptersError)}
					id="unit-progress-chapter"
					onChange={(event) => {
						const selectedNodeId = event.currentTarget.value;
						const estimate = progress.chapters.find(
							(chapter) => chapter.id === selectedNodeId,
						)?.estimatedPercentage;
						onChange((current) => ({
							...current,
							lastNodeId: selectedNodeId,
							percentage: String(estimate ?? current.percentage),
						}));
					}}
					value={draft.lastNodeId}
				>
					<NativeSelectOption value="">{copy.noChapter}</NativeSelectOption>
					{progress.chapters.map((chapter) => (
						<NativeSelectOption key={chapter.id} value={chapter.id}>
							{chapter.title}
						</NativeSelectOption>
					))}
				</NativeSelect>
				{draft.lastNodeId ? (
					<p className="text-sm text-muted-foreground">{copy.estimatedFromContents}</p>
				) : null}
				<RequestFailure error={progress.chaptersError} fallback={t.ui.retryLater} />
			</Field>
		</>
	);
}

function MediaProgressFields({
	draft,
	onChange,
}: {
	readonly draft: ProgressDraft;
	readonly onChange: (draft: ProgressDraft | ((draft: ProgressDraft) => ProgressDraft)) => void;
}) {
	const { t } = useTranslation(["engagement"]);
	const copy = t.engagement.progressByType.media;
	const showPosition = draft.status !== "backlog" && draft.status !== "completed";
	return (
		<>
			{showPosition ? (
				<PercentageField draft={draft} label={copy.progress} onChange={onChange} />
			) : null}
			<TotalMinutesField draft={draft} label={copy.totalMinutes} onChange={onChange} />
		</>
	);
}

function SoftwareProgressFields({
	draft,
	onChange,
}: {
	readonly draft: ProgressDraft;
	readonly onChange: (draft: ProgressDraft | ((draft: ProgressDraft) => ProgressDraft)) => void;
}) {
	const { t } = useTranslation(["engagement"]);
	return (
		<TotalMinutesField
			draft={draft}
			label={t.engagement.progressByType.software.totalMinutes}
			onChange={onChange}
		/>
	);
}

function PercentageField({
	draft,
	label,
	onChange,
}: {
	readonly draft: ProgressDraft;
	readonly label: string;
	readonly onChange: (draft: ProgressDraft | ((draft: ProgressDraft) => ProgressDraft)) => void;
}) {
	const percentage = parseBoundedNumber(draft.percentage, { minimum: 0, maximum: 100 }) ?? 0;
	return (
		<Field>
			<div className="grid grid-cols-[minmax(0,1fr)_5rem] items-end gap-3">
				<Slider
					max={100}
					min={0}
					onValueChange={({ value }) => {
						const next = value[0];
						if (next === undefined) return;
						onChange((current) => ({
							...current,
							percentage: String(Math.round(next)),
						}));
					}}
					value={[percentage]}
				>
					<div className="flex items-center gap-3">
						<SliderLabel>{label}</SliderLabel>
						<SliderValue />
					</div>
				</Slider>
				<Input
					aria-label={label}
					max={100}
					min={0}
					onChange={(event) =>
						onChange((current) => ({
							...current,
							percentage: event.currentTarget.value,
						}))
					}
					step={1}
					type="number"
					value={draft.percentage}
				/>
			</div>
		</Field>
	);
}

function TotalMinutesField({
	draft,
	label,
	onChange,
}: {
	readonly draft: ProgressDraft;
	readonly label: string;
	readonly onChange: (draft: ProgressDraft | ((draft: ProgressDraft) => ProgressDraft)) => void;
}) {
	return (
		<Field>
			<FieldLabel htmlFor="unit-progress-total-minutes">{label}</FieldLabel>
			<Input
				id="unit-progress-total-minutes"
				min={0}
				onChange={(event) =>
					onChange((current) => ({
						...current,
						totalMinutes: event.currentTarget.value,
					}))
				}
				step={1}
				type="number"
				value={draft.totalMinutes}
			/>
		</Field>
	);
}
