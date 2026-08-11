"use client";

import { useState } from "react";

import { useGetApiGovernanceRuleSources } from "@rezics/openapi-tanstack-query";
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

import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { useTranslation } from "@/i18n/client";

import {
	GovernanceMaximumRuleReferences,
	getGovernanceRuleKeys,
	getGovernanceRuleReferences,
	getGovernanceRuleSource,
	governanceRuleSelectionKey,
	retainAvailableGovernanceRuleSelection,
	updateGovernanceRuleSelection,
	type GovernanceRuleReference,
	type GovernanceRuleSource,
} from "../model/governance-rule-selection";

export type GovernanceRuleSourceSelectLabels = Readonly<{
	ariaLabel: string;
	choose: string;
	scopeLabels: Readonly<Partial<Record<GovernanceRuleSource["scope"], string>>>;
}>;

export type GovernanceRuleMultiSelectLabels = Readonly<{
	ariaLabel: string;
	choose: string;
	clear: string;
	selectedCount: (values: { readonly count: number }) => string;
}>;

export type GovernanceAuthority =
	| Readonly<{ kind: "platform" }>
	| Readonly<{ kind: "realm"; id: string }>
	| Readonly<{ kind: "zone"; id: string }>
	| Readonly<{ kind: "unit"; id: string }>;

function sourceLabel(
	source: GovernanceRuleSource,
	labels: GovernanceRuleSourceSelectLabels,
): string {
	return source.title ?? labels.scopeLabels[source.scope] ?? labels.choose;
}

export function GovernanceRuleSourceSelect({
	sources,
	labels,
	onValueChange,
	value,
}: {
	readonly sources: readonly GovernanceRuleSource[];
	readonly labels: GovernanceRuleSourceSelectLabels;
	readonly onValueChange: (value: string) => void;
	readonly value?: string;
}) {
	if (sources.length < 2) return null;

	const options = sources.map((source) => ({
		value: source.id,
		label: sourceLabel(source, labels),
		description: labels.scopeLabels[source.scope] ?? labels.choose,
	}));
	const selectedSource = sources.find(({ id }) => id === value);

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
			value={selectedSource ? [selectedSource.id] : []}
		/>
	);
}

export function GovernanceRuleMultiSelect({
	source,
	labels,
	onClear,
	onRuleCheckedChange,
	selectedKeys,
	totalSelectedCount,
}: {
	readonly source?: GovernanceRuleSource;
	readonly labels: GovernanceRuleMultiSelectLabels;
	readonly onClear: () => void;
	readonly onRuleCheckedChange: (key: string, checked: boolean) => void;
	readonly selectedKeys: readonly string[];
	readonly totalSelectedCount: number;
}) {
	const rules = source?.rules ?? [];
	const selectedKeySet = new Set(selectedKeys);
	const selectedLabels = rules.flatMap((rule) => {
		const key = source
			? governanceRuleSelectionKey(source.id, source.revisionId, rule.id)
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
						value="clear-governance-rules"
					>
						<XIcon aria-hidden />
						{labels.clear}
					</MenuItem>
					{rules.map((rule) => {
						if (!source) return null;
						const key = governanceRuleSelectionKey(source.id, source.revisionId, rule.id);
						const checked = selectedKeySet.has(key);
						return (
							<MenuCheckboxItem
								checked={checked}
								className="items-start py-2.5"
								disabled={!checked && totalSelectedCount >= GovernanceMaximumRuleReferences}
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

function authorityQuery(authority: GovernanceAuthority) {
	if (authority.kind === "platform") return { authorityKind: "platform" as const };
	return { authorityKind: authority.kind, authorityId: authority.id };
}

function authorityKey(authority: GovernanceAuthority): string {
	return authority.kind === "platform" ? authority.kind : `${authority.kind}:${authority.id}`;
}

export function GovernanceRulePicker({
	authority,
	enabled = true,
	onValueChange,
	value,
}: {
	readonly authority: GovernanceAuthority;
	readonly enabled?: boolean;
	readonly onValueChange: (value: GovernanceRuleReference[]) => void;
	readonly value: readonly GovernanceRuleReference[];
}) {
	const { t } = useTranslation(["governance"]);
	const localizationLanguages = useLocalizationLanguages();
	const contextKey = authorityKey(authority);
	const [sourceSelection, setSourceSelection] = useState({ contextKey, sourceId: "" });
	const query = useGetApiGovernanceRuleSources(
		{
			query: {
				...authorityQuery(authority),
				localizationLanguages,
			},
		},
		{ query: { enabled } },
	);
	const sources = query.data?.items ?? [];
	const preferredSourceId =
		sourceSelection.contextKey === contextKey ? sourceSelection.sourceId : undefined;
	const activeSource = getGovernanceRuleSource(sources, preferredSourceId);
	const selectedKeys = retainAvailableGovernanceRuleSelection(
		value.map((rule) =>
			governanceRuleSelectionKey(rule.sourceRealmId, rule.revisionId, rule.ruleId),
		),
		sources,
	);
	const activeSelectedKeys = activeSource
		? getGovernanceRuleKeys(activeSource).filter((key) => selectedKeys.includes(key))
		: [];

	function updateCheckedState(key: string, checked: boolean) {
		const nextKeys = updateGovernanceRuleSelection(selectedKeys, key, checked);
		onValueChange(getGovernanceRuleReferences(sources, nextKeys));
	}

	const labels = t.governance.ruleBasis;
	return (
		<div className="space-y-2">
			<div>
				<p className="text-sm font-medium">{labels.label}</p>
				<p className="text-muted-foreground text-sm">{labels.description}</p>
			</div>
			<GovernanceRuleSourceSelect
				labels={{
					ariaLabel: labels.sourceAriaLabel,
					choose: labels.chooseSource,
					scopeLabels: labels.sources,
				}}
				onValueChange={(sourceId) => setSourceSelection({ contextKey, sourceId })}
				sources={sources}
				value={activeSource?.id}
			/>
			<GovernanceRuleMultiSelect
				labels={{
					ariaLabel: labels.rulesAriaLabel,
					choose: labels.chooseRules,
					clear: labels.clear,
					selectedCount: labels.selectedCount,
				}}
				onClear={() => onValueChange([])}
				onRuleCheckedChange={updateCheckedState}
				selectedKeys={activeSelectedKeys}
				source={activeSource}
				totalSelectedCount={selectedKeys.length}
			/>
			{query.isPending ? <p className="text-muted-foreground text-sm">{labels.loading}</p> : null}
			{query.isError ? <p className="text-destructive text-sm">{labels.loadError}</p> : null}
		</div>
	);
}
