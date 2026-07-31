"use client";

import {
	usePostApiProgressByUnitIdEntries,
	usePutApiProgressByUnitIdEntriesByEntryId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";

import {
	Button,
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
		try {
			if (entry)
				await replace.mutateAsync({
					path: { unitId: progress.domain.unitId, entryId: entry.id },
					body: write,
				});
			else
				await create.mutateAsync({
					path: { unitId: progress.domain.unitId },
					body: write,
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
										onChange={(event) => {
											const value = event.currentTarget.value;
											setDraft((current) => ({
												...current,
												status:
													ProgressStatuses.find(
														(status) => status === value,
													) ?? current.status,
											}));
										}}
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
				onChange={(event) => {
					const value = event.currentTarget.value;
					onChange((current) => ({
						...current,
						entryKind:
							ProgressEntryKinds.find((kind) => kind === value) ?? current.entryKind,
					}));
				}}
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
	const contentStructureCopy =
		type === "book"
			? {
					description: t.engagement.progressByType.book.estimatedFromContents,
					label: t.engagement.progressByType.book.lastChapter,
					noSelectionLabel: t.engagement.progressByType.book.noChapter,
				}
			: type === "media"
				? {
						description: t.engagement.progressByType.media.estimatedFromItem,
						label: t.engagement.progressByType.media.currentItem,
						noSelectionLabel: t.engagement.progressByType.media.noItem,
					}
				: undefined;
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
						onChange={(event) => {
							const percentage = event.currentTarget.value;
							onChange((current) => ({
								...current,
								percentage,
							}));
						}}
						required
						type="number"
						value={draft.percentage}
					/>
				</Field>
			)}
			{contentStructureCopy ? (
				<Field>
					<FieldLabel htmlFor="progress-entry-content-structure-node">
						{contentStructureCopy.label}
					</FieldLabel>
					<NativeSelect
						disabled={
							progress.contentStructureNodesPending ||
							Boolean(progress.contentStructureNodesError)
						}
						id="progress-entry-content-structure-node"
						onChange={(event) => {
							const lastNodeId = event.currentTarget.value;
							const estimatedPercentage = progress.contentStructureNodes.find(
								(node) => node.id === lastNodeId,
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
							{contentStructureCopy.noSelectionLabel}
						</NativeSelectOption>
						{progress.contentStructureNodes.map((node) => (
							<NativeSelectOption key={node.id} value={node.id}>
								{node.title}
							</NativeSelectOption>
						))}
					</NativeSelect>
					{draft.lastNodeId ? (
						<FieldDescription>{contentStructureCopy.description}</FieldDescription>
					) : null}
					<RequestFailure
						error={progress.contentStructureNodesError}
						fallback={t.ui.retryLater}
					/>
				</Field>
			) : null}
			{type === "book" ? null : (
				<Field required>
					<FieldLabel htmlFor="progress-entry-minutes">{copy.totalMinutes}</FieldLabel>
					<Input
						id="progress-entry-minutes"
						inputMode="numeric"
						min={0}
						onChange={(event) => {
							const totalMinutes = event.currentTarget.value;
							onChange((current) => ({
								...current,
								totalMinutes,
							}));
						}}
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
					onChange={(event) => {
						const value = event.currentTarget.value;
						const datePrecision = ProgressDatePrecisions.find(
							(precision) => precision === value,
						);
						onChange((current) => ({
							...current,
							datePrecision: datePrecision ?? current.datePrecision,
							dateValue: value === "unknown" ? "" : current.dateValue,
						}));
					}}
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
						onChange={(event) => {
							const dateValue = event.currentTarget.value;
							onChange((current) => ({
								...current,
								dateValue,
							}));
						}}
						required
						type={inputType}
						value={draft.dateValue}
					/>
				</Field>
			) : null}
		</>
	);
}
