"use client";

import {
	Badge,
	Button,
	ChoiceSelect,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	Field,
	FieldLabel,
	type ChoiceOption,
} from "@rezics/ui";
import { SlidersHorizontalIcon } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/i18n/client";
import {
	AnyStudioFilter,
	ContributionKinds,
	StudioModes,
	StudioStatuses,
	StudioVisibilities,
	WorkspaceSources,
	type ContributionKind,
	type OptionalStudioStatus,
	type OptionalStudioVisibility,
	type StudioMode,
	type StudioStatus,
	type StudioVisibility,
	type WorkspaceSource,
} from "../model/studio-filters";

export interface StudioFilterState {
	readonly mode: StudioMode;
	readonly source: WorkspaceSource;
	readonly kind: ContributionKind;
	readonly status: OptionalStudioStatus;
	readonly visibility: OptionalStudioVisibility;
}

type StudioAdvancedFilterState = Pick<StudioFilterState, "status" | "visibility">;

const EmptyAdvancedFilters = {
	status: AnyStudioFilter,
	visibility: AnyStudioFilter,
} as const satisfies StudioAdvancedFilterState;

function activeAdvancedFilterCount(filters: StudioAdvancedFilterState): number {
	return Object.values(filters).filter((value) => value !== AnyStudioFilter).length;
}

export function StudioSectionToolbar({
	filters,
	onChange,
}: {
	readonly filters: StudioFilterState;
	readonly onChange: (change: Partial<StudioFilterState>) => void;
}) {
	const { t } = useTranslation(["create"]);
	const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
	const advancedFilters = {
		status: filters.status,
		visibility: filters.visibility,
	} satisfies StudioAdvancedFilterState;
	const activeCount = activeAdvancedFilterCount(advancedFilters);
	const modeOptions: readonly ChoiceOption<StudioMode>[] = StudioModes.map((value) => ({
		value,
		label: t.create.mode.options[value],
	}));
	const sourceOptions: readonly ChoiceOption<WorkspaceSource>[] = WorkspaceSources.map((value) => ({
		value,
		label: t.create.filters.sources[value],
	}));
	const kindOptions: readonly ChoiceOption<ContributionKind>[] = ContributionKinds.map((value) => ({
		value,
		label: t.create.filters.kinds[value],
	}));

	return (
		<>
			<div className="mb-5 flex min-w-0 flex-wrap items-center gap-2">
				<ChoiceSelect
					ariaLabel={t.create.mode.label}
					className="min-w-44"
					onValueChange={(values) => onChange({ mode: values[0] ?? "workspace" })}
					options={modeOptions}
					placeholder={t.create.mode.label}
					value={[filters.mode]}
				/>
				{filters.mode === "workspace" ? (
					<ChoiceSelect
						ariaLabel={t.create.filters.sourceLabel}
						className="min-w-40"
						onValueChange={(values) => onChange({ source: values[0] ?? "all" })}
						options={sourceOptions}
						placeholder={t.create.filters.sourceLabel}
						value={[filters.source]}
					/>
				) : (
					<ChoiceSelect
						ariaLabel={t.create.filters.kindLabel}
						className="min-w-40"
						onValueChange={(values) => onChange({ kind: values[0] ?? "all" })}
						options={kindOptions}
						placeholder={t.create.filters.kindLabel}
						value={[filters.kind]}
					/>
				)}
				{filters.mode === "workspace" ? (
					<Button onClick={() => setShowAdvancedFilters(true)} type="button" variant="outline">
						<SlidersHorizontalIcon aria-hidden data-icon="inline-start" />
						{t.create.filters.more}
						{activeCount > 0 ? (
							<Badge className="ms-0.5" size="sm" variant="secondary">
								{activeCount}
							</Badge>
						) : null}
					</Button>
				) : null}
				{filters.mode === "workspace" && activeCount > 0 ? (
					<Button
						className="ms-auto"
						onClick={() => onChange(EmptyAdvancedFilters)}
						type="button"
						variant="quiet"
					>
						{t.create.filters.clear}
					</Button>
				) : null}
			</div>
			{showAdvancedFilters ? (
				<StudioAdvancedFiltersDialog
					filters={advancedFilters}
					onApply={(change) => onChange(change)}
					onClose={() => setShowAdvancedFilters(false)}
				/>
			) : null}
		</>
	);
}

function StudioAdvancedFiltersDialog({
	filters,
	onApply,
	onClose,
}: {
	readonly filters: StudioAdvancedFilterState;
	readonly onApply: (filters: StudioAdvancedFilterState) => void;
	readonly onClose: () => void;
}) {
	const { t } = useTranslation(["create"]);
	const [draft, setDraft] = useState(filters);
	const statusOptions: readonly ChoiceOption<OptionalStudioStatus>[] = [
		{ value: AnyStudioFilter, label: t.create.filters.any },
		...StudioStatuses.map((value: StudioStatus) => ({
			value,
			label: t.create.filters.statuses[value],
		})),
	];
	const visibilityOptions: readonly ChoiceOption<OptionalStudioVisibility>[] = [
		{ value: AnyStudioFilter, label: t.create.filters.any },
		...StudioVisibilities.map((value: StudioVisibility) => ({
			value,
			label: t.create.filters.visibilities[value],
		})),
	];

	return (
		<Dialog
			onOpenChange={({ open }) => {
				if (!open) onClose();
			}}
			open
		>
			<DialogContent showCloseButton={false} size="sm">
				<DialogHeader title={t.create.filters.more} />
				<DialogBody className="grid gap-5">
					<Button
						className="w-fit"
						disabled={activeAdvancedFilterCount(draft) === 0}
						onClick={() => setDraft(EmptyAdvancedFilters)}
						type="button"
						variant="quiet"
					>
						{t.create.filters.clear}
					</Button>
					<Field>
						<FieldLabel>{t.create.filters.statusLabel}</FieldLabel>
						<ChoiceSelect
							appearance="field"
							ariaLabel={t.create.filters.statusLabel}
							onValueChange={(values) =>
								setDraft((current) => ({
									...current,
									status: values[0] ?? AnyStudioFilter,
								}))
							}
							options={statusOptions}
							placeholder={t.create.filters.statusLabel}
							value={[draft.status]}
						/>
					</Field>
					<Field>
						<FieldLabel>{t.create.filters.visibilityLabel}</FieldLabel>
						<ChoiceSelect
							appearance="field"
							ariaLabel={t.create.filters.visibilityLabel}
							onValueChange={(values) =>
								setDraft((current) => ({
									...current,
									visibility: values[0] ?? AnyStudioFilter,
								}))
							}
							options={visibilityOptions}
							placeholder={t.create.filters.visibilityLabel}
							value={[draft.visibility]}
						/>
					</Field>
				</DialogBody>
				<DialogFooter>
					<Button onClick={onClose} type="button" variant="outline">
						{t.create.filters.cancel}
					</Button>
					<Button
						onClick={() => {
							onApply(draft);
							onClose();
						}}
						type="button"
						variant="solid"
					>
						{t.create.filters.apply}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
