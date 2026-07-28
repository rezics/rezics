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
	StudioPermissions,
	StudioSorts,
	StudioStatuses,
	StudioViews,
	StudioVisibilities,
	StudioWorkStates,
	type OptionalStudioPermission,
	type OptionalStudioStatus,
	type OptionalStudioVisibility,
	type OptionalStudioWorkState,
	type StudioPermission,
	type StudioSort,
	type StudioStatus,
	type StudioView,
	type StudioVisibility,
	type StudioWorkState,
} from "../model/studio-filters";

export interface StudioFilterState {
	readonly view: StudioView;
	readonly permission: OptionalStudioPermission;
	readonly workState: OptionalStudioWorkState;
	readonly status: OptionalStudioStatus;
	readonly visibility: OptionalStudioVisibility;
	readonly sort: StudioSort;
}

type StudioAdvancedFilterState = Pick<
	StudioFilterState,
	"permission" | "status" | "visibility" | "workState"
>;

const EmptyAdvancedFilters = {
	permission: AnyStudioFilter,
	workState: AnyStudioFilter,
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
		permission: filters.permission,
		workState: filters.workState,
		status: filters.status,
		visibility: filters.visibility,
	} satisfies StudioAdvancedFilterState;
	const activeCount = activeAdvancedFilterCount(advancedFilters);
	const viewOptions: readonly ChoiceOption<StudioView>[] = StudioViews.map((value) => ({
		value,
		label: t.create.filters.views[value],
	}));
	const sortOptions: readonly ChoiceOption<StudioSort>[] = StudioSorts.map((value) => ({
		value,
		label: t.create.filters.sorts[value],
	}));

	return (
		<>
			<div className="mb-5 flex min-w-0 flex-wrap items-center gap-2">
				<ChoiceSelect
					ariaLabel={t.create.filters.viewLabel}
					className="min-w-36"
					onValueChange={(values) => onChange({ view: values[0] ?? "all" })}
					options={viewOptions}
					placeholder={t.create.filters.viewLabel}
					value={[filters.view]}
				/>
				<Button
					onClick={() => setShowAdvancedFilters(true)}
					type="button"
					variant="outline"
				>
					<SlidersHorizontalIcon aria-hidden data-icon="inline-start" />
					{t.create.filters.more}
					{activeCount > 0 ? (
						<Badge className="ms-0.5" size="sm" variant="secondary">
							{activeCount}
						</Badge>
					) : null}
				</Button>
				<ChoiceSelect
					ariaLabel={t.create.filters.sortLabel}
					className="min-w-36"
					onValueChange={(values) => onChange({ sort: values[0] ?? "recent" })}
					options={sortOptions}
					placeholder={t.create.filters.sortLabel}
					value={[filters.sort]}
				/>
				{activeCount > 0 ? (
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
	const permissionOptions: readonly ChoiceOption<OptionalStudioPermission>[] = [
		{ value: AnyStudioFilter, label: t.create.filters.any },
		...StudioPermissions.map((value: StudioPermission) => ({
			value,
			label: t.create.filters.permissions[value],
		})),
	];
	const workStateOptions: readonly ChoiceOption<OptionalStudioWorkState>[] = [
		{ value: AnyStudioFilter, label: t.create.filters.any },
		...StudioWorkStates.map((value: StudioWorkState) => ({
			value,
			label: t.create.filters.workStates[value],
		})),
	];
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
						<FieldLabel>{t.create.filters.permissionLabel}</FieldLabel>
						<ChoiceSelect
							appearance="field"
							ariaLabel={t.create.filters.permissionLabel}
							onValueChange={(values) =>
								setDraft((current) => ({
									...current,
									permission: values[0] ?? AnyStudioFilter,
								}))
							}
							options={permissionOptions}
							placeholder={t.create.filters.permissionLabel}
							value={[draft.permission]}
						/>
					</Field>
					<Field>
						<FieldLabel>{t.create.filters.workStateLabel}</FieldLabel>
						<ChoiceSelect
							appearance="field"
							ariaLabel={t.create.filters.workStateLabel}
							onValueChange={(values) =>
								setDraft((current) => ({
									...current,
									workState: values[0] ?? AnyStudioFilter,
								}))
							}
							options={workStateOptions}
							placeholder={t.create.filters.workStateLabel}
							value={[draft.workState]}
						/>
					</Field>
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
