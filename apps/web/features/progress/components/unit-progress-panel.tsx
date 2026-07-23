"use client";

import type { Translation } from "@rezics/i18n";
import {
	useGetApiProgressByUnitId,
	useGetApiUnitsBookByUnitIdContentStructureNodes,
	usePutApiProgressByUnitId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";

import {
	Button,
	Card,
	CardContent,
	CardHeader,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	NativeSelect,
	NativeSelectOption,
	Progress,
	ProgressValue,
} from "@rezics/ui";
import { SignInButton } from "@/features/auth/auth-portal";
import { useTranslation } from "@/i18n/client";
import { hasErrorCode } from "@/i18n/errors";
import { RequestFailure } from "@/i18n/request-failure";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { invalidateProgressQueries } from "../data/progress-cache";
import {
	parseBoundedNumber,
	parseNonNegativeInteger,
	ProgressStatuses,
	toProgressStatus,
	type ProgressStatus,
} from "../model/progress-record";

export type UnitProgressDomain =
	| { readonly type: "book"; readonly unitId: string }
	| { readonly type: "media"; readonly unitId: string }
	| { readonly type: "software"; readonly unitId: string };

interface ProgressDraft {
	readonly status: ProgressStatus;
	readonly percentage: string;
	readonly completedCount: string;
	readonly totalMinutes: string;
	readonly lastNodeId: string;
}

const EmptyDraft: ProgressDraft = {
	status: "active",
	percentage: "0",
	completedCount: "0",
	totalMinutes: "0",
	lastNodeId: "",
};

export function UnitProgressPanel({ domain }: { domain: UnitProgressDomain }) {
	const { data: session } = useHydratedSession();
	const record = useGetApiProgressByUnitId(
		{ path: { unitId: domain.unitId } },
		{ query: { enabled: Boolean(session) } },
	);
	const save = usePutApiProgressByUnitId();
	const queryClient = useQueryClient();
	const { t } = useTranslation(["actions", "engagement", "errors", "state", "ui"]);
	const [draft, setDraft] = useState<ProgressDraft>(EmptyDraft);
	const [invalid, setInvalid] = useState(false);
	const recordMissing = record.isError && hasErrorCode(record.error, "ProgressNotFound");

	useEffect(() => {
		if (!record.data) return;
		setDraft({
			status: toProgressStatus(record.data.status),
			percentage: String(Math.round(record.data.progress * 100)),
			completedCount: String(toNonNegativeApiInteger(record.data.completedCount)),
			totalMinutes: String(
				Math.round((toFiniteApiNumber(record.data.totalTimeMs) ?? 0) / 60_000),
			),
			lastNodeId: record.data.lastContentStructureNodeId ?? "",
		});
	}, [record.data]);

	if (!session) return <SignInButton variant="outline">{t.actions.login}</SignInButton>;

	const available = !record.isPending && (!record.isError || recordMissing);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const body = createProgressBody(domain.type, draft);
		if (!body) {
			setInvalid(true);
			return;
		}
		setInvalid(false);
		try {
			await save.mutateAsync({ path: { unitId: domain.unitId }, body });
			await invalidateProgressQueries(queryClient, domain.unitId);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<Card>
			<CardHeader title={progressTitle(t, domain.type)} />
			<CardContent>
				<form className="grid gap-5" onSubmit={(event) => void submit(event)}>
					<FieldGroup>
						<ProgressStatusField
							onChange={(status) => setDraft((current) => ({ ...current, status }))}
							status={draft.status}
							t={t}
							type={domain.type}
						/>
						{domain.type === "book" ? (
							<BookProgressFields
								draft={draft}
								onChange={setDraft}
								unitId={domain.unitId}
							/>
						) : domain.type === "media" ? (
							<MediaProgressFields draft={draft} onChange={setDraft} />
						) : (
							<SoftwareProgressFields draft={draft} onChange={setDraft} />
						)}
					</FieldGroup>
					{record.isPending ? (
						<p className="text-sm text-muted-foreground">{t.state.loading}</p>
					) : null}
					{record.isError && !recordMissing ? (
						<RequestFailure error={record.error} fallback={t.ui.retryLater} />
					) : null}
					{invalid ? (
						<p className="text-sm text-destructive" role="alert">
							{t.errors.invalid}
						</p>
					) : null}
					<RequestFailure error={save.error} fallback={t.ui.retryLater} />
					<Button
						className="w-fit"
						disabled={!available}
						isLoading={save.isPending}
						type="submit"
						variant="solid"
					>
						{t.engagement.updateProgress}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}

function ProgressStatusField({
	onChange,
	status,
	t,
	type,
}: {
	onChange: (status: ProgressStatus) => void;
	status: ProgressStatus;
	t: Pick<Translation, "engagement">;
	type: UnitProgressDomain["type"];
}) {
	return (
		<Field>
			<FieldLabel>{progressStatusLabel(t, type)}</FieldLabel>
			<NativeSelect
				onChange={(event) => onChange(toProgressStatus(event.currentTarget.value))}
				value={status}
			>
				{ProgressStatuses.map((candidate) => (
					<NativeSelectOption key={candidate} value={candidate}>
						{progressStatusValue(t, type, candidate)}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}

function BookProgressFields({
	draft,
	onChange,
	unitId,
}: {
	draft: ProgressDraft;
	onChange: (draft: ProgressDraft | ((draft: ProgressDraft) => ProgressDraft)) => void;
	unitId: string;
}) {
	const contents = useGetApiUnitsBookByUnitIdContentStructureNodes({
		path: { unitId },
	});
	const { t } = useTranslation(["engagement"]);
	const percentage = parseBoundedNumber(draft.percentage, { minimum: 0, maximum: 100 }) ?? 0;
	return (
		<>
			<Field>
				<div className="grid gap-2">
					<Progress max={100} value={percentage}>
						<FieldLabel>{t.engagement.progressByType.book.progress}</FieldLabel>
						<ProgressValue />
					</Progress>
					<Input
						max={100}
						min={0}
						onChange={(event) =>
							onChange((current) => ({
								...current,
								percentage: event.currentTarget.value,
							}))
						}
						type="number"
						value={draft.percentage}
					/>
				</div>
			</Field>
			<Field>
				<FieldLabel>{t.engagement.progressByType.book.lastChapter}</FieldLabel>
				<NativeSelect
					disabled={contents.isPending || contents.isError}
					onChange={(event) =>
						onChange((current) => ({
							...current,
							lastNodeId: event.currentTarget.value,
						}))
					}
					value={draft.lastNodeId}
				>
					<NativeSelectOption value="">
						{t.engagement.progressByType.book.noChapter}
					</NativeSelectOption>
					{contents.data?.items.map((node) => (
						<NativeSelectOption key={node.id} value={node.id}>
							{node.title}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
		</>
	);
}

function MediaProgressFields({
	draft,
	onChange,
}: {
	draft: ProgressDraft;
	onChange: (draft: ProgressDraft | ((draft: ProgressDraft) => ProgressDraft)) => void;
}) {
	const { t } = useTranslation(["engagement"]);
	const percentage = parseBoundedNumber(draft.percentage, { minimum: 0, maximum: 100 }) ?? 0;
	return (
		<>
			<Field>
				<div className="grid gap-2">
					<Progress max={100} value={percentage}>
						<FieldLabel>{t.engagement.progressByType.media.progress}</FieldLabel>
						<ProgressValue />
					</Progress>
					<Input
						max={100}
						min={0}
						onChange={(event) =>
							onChange((current) => ({
								...current,
								percentage: event.currentTarget.value,
							}))
						}
						type="number"
						value={draft.percentage}
					/>
				</div>
			</Field>
			<CountAndTimeFields
				completedCountLabel={t.engagement.progressByType.media.completedCount}
				draft={draft}
				onChange={onChange}
				totalMinutesLabel={t.engagement.progressByType.media.totalMinutes}
			/>
		</>
	);
}

function SoftwareProgressFields({
	draft,
	onChange,
}: {
	draft: ProgressDraft;
	onChange: (draft: ProgressDraft | ((draft: ProgressDraft) => ProgressDraft)) => void;
}) {
	const { t } = useTranslation(["engagement"]);
	return (
		<CountAndTimeFields
			completedCountLabel={t.engagement.progressByType.software.completedCount}
			draft={draft}
			onChange={onChange}
			totalMinutesLabel={t.engagement.progressByType.software.totalMinutes}
		/>
	);
}

function CountAndTimeFields({
	completedCountLabel,
	draft,
	onChange,
	totalMinutesLabel,
}: {
	completedCountLabel: string;
	draft: ProgressDraft;
	onChange: (draft: ProgressDraft | ((draft: ProgressDraft) => ProgressDraft)) => void;
	totalMinutesLabel: string;
}) {
	return (
		<div className="grid gap-4 sm:grid-cols-2">
			<Field>
				<FieldLabel>{completedCountLabel}</FieldLabel>
				<Input
					min={0}
					onChange={(event) =>
						onChange((current) => ({
							...current,
							completedCount: event.currentTarget.value,
						}))
					}
					step={1}
					type="number"
					value={draft.completedCount}
				/>
			</Field>
			<Field>
				<FieldLabel>{totalMinutesLabel}</FieldLabel>
				<Input
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
		</div>
	);
}

function createProgressBody(type: UnitProgressDomain["type"], draft: ProgressDraft) {
	if (type === "book") {
		const percentage = parseBoundedNumber(draft.percentage, {
			minimum: 0,
			maximum: 100,
		});
		if (percentage === undefined) return undefined;
		return {
			status: draft.status,
			progress: draft.status === "completed" ? 1 : percentage / 100,
			lastContentStructureNodeId: draft.lastNodeId || null,
		};
	}
	const completedCount = parseNonNegativeInteger(draft.completedCount);
	const totalMinutes = parseNonNegativeInteger(draft.totalMinutes);
	if (completedCount === undefined || totalMinutes === undefined) return undefined;
	if (type === "media") {
		const percentage = parseBoundedNumber(draft.percentage, {
			minimum: 0,
			maximum: 100,
		});
		if (percentage === undefined) return undefined;
		return {
			status: draft.status,
			progress: draft.status === "completed" ? 1 : percentage / 100,
			completedCount,
			totalTimeMs: totalMinutes * 60_000,
		};
	}
	return {
		status: draft.status,
		progress: 0,
		completedCount,
		totalTimeMs: totalMinutes * 60_000,
	};
}

function progressTitle(
	t: Pick<Translation, "engagement">,
	type: UnitProgressDomain["type"],
): string {
	return t.engagement.progressByType[type].title;
}

function progressStatusLabel(
	t: Pick<Translation, "engagement">,
	type: UnitProgressDomain["type"],
): string {
	return t.engagement.progressByType[type].status;
}

function progressStatusValue(
	t: Pick<Translation, "engagement">,
	type: UnitProgressDomain["type"],
	status: ProgressStatus,
): string {
	return t.engagement.progressByType[type].statuses[status];
}
