"use client";

import type {
	GetApiReportsUnitsByUnitIdDestinationsStatus200,
	GetApiReportsUnitsByUnitIdDestinationsStatus200ItemsScopeEnum,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Menu,
	MenuCheckboxItem,
	MenuContent,
	MenuGroup,
	MenuItem,
	MenuSeparator,
	MenuTrigger,
} from "@rezics/ui";
import { ChevronsUpDownIcon, ListFilterIcon, XIcon } from "lucide-react";
import { Fragment } from "react";

import { ContentGovernanceMaximumRuleReferences } from "@/features/governance/model/content-rule-selection";

type ReportRuleDestination = GetApiReportsUnitsByUnitIdDestinationsStatus200["items"][number];
type ReportRule = ReportRuleDestination["rules"][number];
type ReportRuleScope = GetApiReportsUnitsByUnitIdDestinationsStatus200ItemsScopeEnum;

export type ReportRuleMultiSelectLabels = Readonly<{
	ariaLabel: string;
	choose: string;
	clear: string;
	selectedCount: (values: { readonly count: number }) => string;
	scopeLabels: Readonly<Record<ReportRuleScope, string>>;
}>;

function reportRuleKey(destination: ReportRuleDestination, rule: ReportRule): string {
	return `${destination.id}:${destination.revisionId}:${rule.id}`;
}

export function ReportRuleMultiSelect({
	destinations,
	labels,
	onClear,
	onRuleCheckedChange,
	selectedKeys,
}: {
	readonly destinations: readonly ReportRuleDestination[];
	readonly labels: ReportRuleMultiSelectLabels;
	readonly onClear: () => void;
	readonly onRuleCheckedChange: (key: string, checked: boolean) => void;
	readonly selectedKeys: readonly string[];
}) {
	const destinationsWithRules = destinations.filter(
		(destination) => destination.rules.length > 0,
	);
	const selectedKeySet = new Set(selectedKeys);
	const selectedLabels = destinationsWithRules.flatMap((destination) =>
		destination.rules.flatMap((rule) => {
			const key = reportRuleKey(destination, rule);
			return selectedKeySet.has(key) ? [rule.title] : [];
		}),
	);
	const summary =
		selectedLabels.length === 0
			? labels.choose
			: selectedLabels.length <= 2
				? selectedLabels.join(", ")
				: labels.selectedCount({ count: selectedLabels.length });
	const hasAvailableRules = destinationsWithRules.length > 0;

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
						disabled={selectedKeys.length === 0}
						onSelect={onClear}
						value="clear-report-rules"
					>
						<XIcon aria-hidden />
						{labels.clear}
					</MenuItem>
					<MenuSeparator />
					{destinationsWithRules.map((destination, destinationIndex) => (
						<Fragment key={destination.id}>
							{destinationIndex > 0 ? <MenuSeparator /> : null}
							<MenuGroup
								heading={`${destination.title ?? destination.id} · ${labels.scopeLabels[destination.scope]}`}
							>
								{destination.rules.map((rule) => {
									const key = reportRuleKey(destination, rule);
									const checked = selectedKeySet.has(key);
									return (
										<MenuCheckboxItem
											checked={checked}
											className="items-start py-2.5"
											disabled={
												!checked &&
												selectedKeys.length >=
													ContentGovernanceMaximumRuleReferences
											}
											onCheckedChange={(nextChecked) =>
												onRuleCheckedChange(key, nextChecked === true)
											}
											value={key}
											valueText={rule.title}
											key={key}
										>
											{rule.title}
										</MenuCheckboxItem>
									);
								})}
							</MenuGroup>
						</Fragment>
					))}
				</MenuContent>
			) : null}
		</Menu>
	);
}
