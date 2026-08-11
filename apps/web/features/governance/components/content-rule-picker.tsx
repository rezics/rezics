"use client";

import {
	Button,
	ChoiceSelect,
	Menu,
	MenuCheckboxItem,
	MenuContent,
	MenuItem,
	MenuTrigger,
} from "@rezics/ui";
import { ChevronsUpDownIcon, ListFilterIcon, XIcon } from "lucide-react";

import {
	ContentGovernanceMaximumRuleReferences,
	contentRuleSelectionKey,
	type ContentRuleDestination,
} from "../model/content-rule-selection";

export type ContentRuleSourceSelectLabels = Readonly<{
	ariaLabel: string;
	choose: string;
	scopeLabels: Readonly<Record<ContentRuleDestination["scope"], string>>;
}>;

export type ContentRuleMultiSelectLabels = Readonly<{
	ariaLabel: string;
	choose: string;
	clear: string;
	selectedCount: (values: { readonly count: number }) => string;
}>;

function destinationLabel(
	destination: ContentRuleDestination,
	labels: ContentRuleSourceSelectLabels,
): string {
	return destination.title ?? labels.scopeLabels[destination.scope];
}

export function ContentRuleSourceSelect({
	destinations,
	labels,
	onValueChange,
	value,
}: {
	readonly destinations: readonly ContentRuleDestination[];
	readonly labels: ContentRuleSourceSelectLabels;
	readonly onValueChange: (value: string) => void;
	readonly value?: string;
}) {
	if (destinations.length < 2) return null;

	const options = destinations.map((destination) => ({
		value: destination.id,
		label: destinationLabel(destination, labels),
		description: labels.scopeLabels[destination.scope],
	}));
	const selectedDestination = destinations.find(({ id }) => id === value);

	return (
		<ChoiceSelect
			appearance="field"
			ariaLabel={labels.ariaLabel}
			className="w-full"
			onValueChange={(nextValue) => {
				const nextSourceId = nextValue[0];
				if (nextSourceId) onValueChange(nextSourceId);
			}}
			options={options}
			placeholder={labels.choose}
			size="lg"
			value={selectedDestination ? [selectedDestination.id] : []}
		/>
	);
}

export function ContentRuleMultiSelect({
	destination,
	labels,
	onClear,
	onRuleCheckedChange,
	selectedKeys,
	totalSelectedCount,
}: {
	readonly destination?: ContentRuleDestination;
	readonly labels: ContentRuleMultiSelectLabels;
	readonly onClear: () => void;
	readonly onRuleCheckedChange: (key: string, checked: boolean) => void;
	readonly selectedKeys: readonly string[];
	readonly totalSelectedCount: number;
}) {
	const rules = destination?.rules ?? [];
	const selectedKeySet = new Set(selectedKeys);
	const selectedLabels = rules.flatMap((rule) => {
		const key = destination
			? contentRuleSelectionKey(destination.id, destination.revisionId, rule.id)
			: undefined;
		return key && selectedKeySet.has(key) ? [rule.title] : [];
	});
	const summary =
		selectedLabels.length === 0
			? labels.choose
			: selectedLabels.length <= 2
				? selectedLabels.join(", ")
				: labels.selectedCount({ count: selectedLabels.length });
	const hasAvailableRules = rules.length > 0;

	return (
		<Menu closeOnSelect={false} positioning={{ placement: "bottom-start" }}>
			<MenuTrigger asChild>
				<Button
					aria-label={labels.ariaLabel}
					className="w-full min-w-0 justify-start text-start"
					disabled={!hasAvailableRules}
					size="lg"
					variant="outline"
				>
					<ListFilterIcon aria-hidden data-icon="inline-start" />
					<span className="min-w-0 truncate">{summary}</span>
					<ChevronsUpDownIcon aria-hidden className="ms-auto" data-icon="inline-end" />
				</Button>
			</MenuTrigger>
			{hasAvailableRules ? (
				<MenuContent className="max-h-96 w-[min(32rem,calc(100vw-2rem))] p-1.5">
					<MenuItem
						disabled={totalSelectedCount === 0}
						onSelect={onClear}
						value="clear-content-governance-rules"
					>
						<XIcon aria-hidden />
						{labels.clear}
					</MenuItem>
					{rules.map((rule) => {
						if (!destination) return null;
						const key = contentRuleSelectionKey(destination.id, destination.revisionId, rule.id);
						const checked = selectedKeySet.has(key);
						return (
							<MenuCheckboxItem
								checked={checked}
								className="items-start py-2.5"
								disabled={!checked && totalSelectedCount >= ContentGovernanceMaximumRuleReferences}
								onCheckedChange={(nextChecked) => onRuleCheckedChange(key, nextChecked === true)}
								value={key}
								valueText={rule.title}
								key={key}
							>
								{rule.title}
							</MenuCheckboxItem>
						);
					})}
				</MenuContent>
			) : null}
		</Menu>
	);
}
