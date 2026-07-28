"use client";

import {
	usePostApiProgressByUnitIdEntries,
	usePutApiProgressByUnitIdEntriesByEntryId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";

import {
	Button,
	Checkbox,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	Input,
	NativeSelect,
	NativeSelectOption,
} from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { invalidateProgressQueries } from "../data/progress-cache";
import {
	createProgressEntryDraft,
	createProgressEntryWrite,
	progressDateInputType,
	ProgressDatePrecisions,
	ProgressEntryKinds,
	type ProgressEntry,
	type ProgressEntryDraft,
} from "../model/progress-entry";
import { ProgressStatuses, type UnitProgressDomain } from "../model/progress-record";
import { useUnitProgress } from "./unit-progress-provider";

const ProgressEntryFormId = "progress-entry-editor-form";

export function ProgressEntryDialog({
	entry,
	onOpenChange,
	open,
}: {
	readonly entry?: ProgressEntry;
	readonly onOpenChange: (open: boolean) => void;
	readonly open: boolean;
}) {
	return (
		<Dialog onOpenChange={({ open: nextOpen }) => onOpenChange(nextOpen)} open={open}>
			{open ? (
				<ProgressEntryEditor entry={entry} onClose={() => onOpenChange(false)} />
			) : null}
		</Dialog>
	);
}

function ProgressEntryEditor({
	entry,
	onClose,
}: {
	readonly entry?: ProgressEntry;
	readonly onClose: () => void;
}) {
	const progress = useUnitProgress();
	const queryClient = useQueryClient();
	const create = usePostApiProgressByUnitIdEntries();
	const replace = usePutApiProgressByUnitIdEntriesByEntryId();
	const { t } = useTranslation(["engagement", "errors", "ui"]);
	const [draft, setDraft] = useState(() => createProgressEntryDraft(entry));
	const [invalid, setInvalid] = useState(false);
	const copy = t.engagement.progressJournal;
	const pending = create.isPending || replace.isPending;

	useEffect(() => setDraft(createProgressEntryDraft(entry)), [entry]);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const write = createProgressEntryWrite(draft);
		if (!write) {
			setInvalid(true);
			return;
		}
		setInvalid(false);
		const body = {
			...write,
			sourceKind: write.sourceKind,
		};
		try {
			if (entry)
				await replace.mutateAsync({
					path: { unitId: progress.domain.unitId, entryId: entry.id },
					body,
				});
			else
				await create.mutateAsync({
					path: { unitId: progress.domain.unitId },
					body: {
						...body,
						sourceKind: body.sourceKind === "rezics" ? "manual" : body.sourceKind,
					},
				});
			await invalidateProgressQueries(queryClient, progress.domain.unitId);
			onClose();
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<DialogContent showCloseButton={!pending} size="lg">
			<DialogHeader
				description={entry ? copy.editDescription : copy.addHistoryDescription}
				title={entry ? copy.editEntry : copy.addHistory}
			/>
			<DialogBody>
				<form id={ProgressEntryFormId} onSubmit={(event) => void submit(event)}>
					<FieldGroup>
						<EntryKindField draft={draft} onChange={setDraft} />
						{draft.entryKind === "completion" ? null : (
							<>
								<Field>
									<FieldLabel htmlFor="progress-entry-status">
										{copy.status}
									</FieldLabel>
									<NativeSelect
										id="progress-entry-status"
										onChange={(event) =>
											setDraft((current) => ({
												...current,
												status:
													ProgressStatuses.find(
														(status) =>
															status === event.currentTarget.value,
													) ?? current.status,
											}))
										}
										value={draft.status}
									>
										{ProgressStatuses.map((status) => (
											<NativeSelectOption key={status} value={status}>
												{
													t.engagement.progressByType[
														progress.domain.type
													].statuses[status]
												}
											</NativeSelectOption>
										))}
									</NativeSelect>
								</Field>
								<PositionFields
									draft={draft}
									onChange={setDraft}
									type={progress.domain.type}
								/>
							</>
						)}
						<DateFields draft={draft} onChange={setDraft} />
						<Field>
							<FieldLabel htmlFor="progress-entry-source-provider">
								{copy.sourceProvider}
							</FieldLabel>
							<Input
								id="progress-entry-source-provider"
								maxLength={100}
								onChange={(event) =>
									setDraft((current) => ({
										...current,
										sourceProvider: event.currentTarget.value,
									}))
								}
								placeholder={copy.sourceProviderPlaceholder}
								value={draft.sourceProvider}
							/>
							<FieldDescription>{copy.sourceProviderDescription}</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="progress-entry-source-id">
								{copy.sourceExternalId}
							</FieldLabel>
							<Input
								id="progress-entry-source-id"
								maxLength={500}
								onChange={(event) =>
									setDraft((current) => ({
										...current,
										sourceExternalId: event.currentTarget.value,
									}))
								}
								value={draft.sourceExternalId}
							/>
						</Field>
						<label className="flex items-start gap-3 rounded-lg border border-border-weak p-4">
							<Checkbox
								checked={draft.affectsCurrent}
								onCheckedChange={({ checked }) =>
									setDraft((current) => ({
										...current,
										affectsCurrent: checked === true,
									}))
								}
							/>
							<span className="grid gap-1">
								<span className="font-medium text-sm">{copy.affectsCurrent}</span>
								<span className="text-muted-foreground text-sm">
									{copy.affectsCurrentDescription}
								</span>
							</span>
						</label>
						{invalid ? (
							<p className="text-destructive text-sm" role="alert">
								{t.errors.invalid}
							</p>
						) : null}
						<RequestFailure
							error={create.error ?? replace.error}
							fallback={t.ui.retryLater}
						/>
					</FieldGroup>
				</form>
			</DialogBody>
			<DialogFooter>
				<Button disabled={pending} onClick={onClose} variant="quiet">
					{t.engagement.cancel}
				</Button>
				<Button
					form={ProgressEntryFormId}
					isLoading={pending}
					type="submit"
					variant="solid"
				>
					{copy.saveEntry}
				</Button>
			</DialogFooter>
		</DialogContent>
	);
}

function EntryKindField({
	draft,
	onChange,
}: {
	readonly draft: ProgressEntryDraft;
	readonly onChange: (
		draft: ProgressEntryDraft | ((draft: ProgressEntryDraft) => ProgressEntryDraft),
	) => void;
}) {
	const { t } = useTranslation(["engagement"]);
	const copy = t.engagement.progressJournal;
	return (
		<Field>
			<FieldLabel htmlFor="progress-entry-kind">{copy.entryKind}</FieldLabel>
			<NativeSelect
				id="progress-entry-kind"
				onChange={(event) =>
					onChange((current) => ({
						...current,
						entryKind:
							ProgressEntryKinds.find((kind) => kind === event.currentTarget.value) ??
							current.entryKind,
					}))
				}
				value={draft.entryKind}
			>
				{ProgressEntryKinds.map((kind) => (
					<NativeSelectOption key={kind} value={kind}>
						{copy.kinds[kind]}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}

function PositionFields({
	draft,
	onChange,
	type,
}: {
	readonly draft: ProgressEntryDraft;
	readonly onChange: (
		draft: ProgressEntryDraft | ((draft: ProgressEntryDraft) => ProgressEntryDraft),
	) => void;
	readonly type: UnitProgressDomain["type"];
}) {
	const progress = useUnitProgress();
	const { t } = useTranslation(["engagement", "ui"]);
	const copy = t.engagement.progressJournal;
	return (
		<>
			{type === "software" ? null : (
				<Field required>
					<FieldLabel htmlFor="progress-entry-percentage">{copy.percentage}</FieldLabel>
					<Input
						id="progress-entry-percentage"
						inputMode="decimal"
						max={100}
						min={0}
						onChange={(event) =>
							onChange((current) => ({
								...current,
								percentage: event.currentTarget.value,
							}))
						}
						required
						type="number"
						value={draft.percentage}
					/>
				</Field>
			)}
			{type === "book" ? (
				<Field>
					<FieldLabel htmlFor="progress-entry-chapter">
						{t.engagement.progressByType.book.lastChapter}
					</FieldLabel>
					<NativeSelect
						disabled={progress.chaptersPending || Boolean(progress.chaptersError)}
						id="progress-entry-chapter"
						onChange={(event) => {
							const lastNodeId = event.currentTarget.value;
							const estimatedPercentage = progress.chapters.find(
								(chapter) => chapter.id === lastNodeId,
							)?.estimatedPercentage;
							onChange((current) => ({
								...current,
								lastNodeId,
								percentage:
									estimatedPercentage === undefined
										? current.percentage
										: String(estimatedPercentage),
							}));
						}}
						value={draft.lastNodeId}
					>
						<NativeSelectOption value="">
							{t.engagement.progressByType.book.noChapter}
						</NativeSelectOption>
						{progress.chapters.map((chapter) => (
							<NativeSelectOption key={chapter.id} value={chapter.id}>
								{chapter.title}
							</NativeSelectOption>
						))}
					</NativeSelect>
					{draft.lastNodeId ? (
						<FieldDescription>
							{t.engagement.progressByType.book.estimatedFromContents}
						</FieldDescription>
					) : null}
					<RequestFailure error={progress.chaptersError} fallback={t.ui.retryLater} />
				</Field>
			) : null}
			{type === "book" ? null : (
				<Field required>
					<FieldLabel htmlFor="progress-entry-minutes">{copy.totalMinutes}</FieldLabel>
					<Input
						id="progress-entry-minutes"
						inputMode="numeric"
						min={0}
						onChange={(event) =>
							onChange((current) => ({
								...current,
								totalMinutes: event.currentTarget.value,
							}))
						}
						required
						type="number"
						value={draft.totalMinutes}
					/>
				</Field>
			)}
		</>
	);
}

function DateFields({
	draft,
	onChange,
}: {
	readonly draft: ProgressEntryDraft;
	readonly onChange: (
		draft: ProgressEntryDraft | ((draft: ProgressEntryDraft) => ProgressEntryDraft),
	) => void;
}) {
	const { t } = useTranslation(["engagement"]);
	const copy = t.engagement.progressJournal;
	const inputType = progressDateInputType(draft.datePrecision);
	return (
		<>
			<Field>
				<FieldLabel htmlFor="progress-entry-date-precision">
					{copy.datePrecision}
				</FieldLabel>
				<NativeSelect
					id="progress-entry-date-precision"
					onChange={(event) =>
						onChange((current) => ({
							...current,
							datePrecision:
								ProgressDatePrecisions.find(
									(precision) => precision === event.currentTarget.value,
								) ?? current.datePrecision,
							dateValue:
								event.currentTarget.value === "unknown" ? "" : current.dateValue,
						}))
					}
					value={draft.datePrecision}
				>
					{ProgressDatePrecisions.map((precision) => (
						<NativeSelectOption key={precision} value={precision}>
							{copy.precision[precision]}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
			{inputType ? (
				<Field required>
					<FieldLabel htmlFor="progress-entry-date">{copy.occurredAt}</FieldLabel>
					<Input
						id="progress-entry-date"
						{...(inputType === "number" ? { max: 9999, min: 1 } : {})}
						onChange={(event) =>
							onChange((current) => ({
								...current,
								dateValue: event.currentTarget.value,
							}))
						}
						required
						type={inputType}
						value={draft.dateValue}
					/>
				</Field>
			) : null}
		</>
	);
}
