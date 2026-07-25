"use client";

import { ChevronsUpDownIcon, ListFilterIcon, XIcon } from "lucide-react";

import {
	Button,
	Menu,
	MenuCheckboxItem,
	MenuContent,
	MenuGroup,
	MenuItem,
	MenuSeparator,
	MenuTrigger,
	cn,
} from "@rezics/ui";

export interface FeedFilterOption<Value extends string> {
	readonly value: Value;
	readonly label: string;
	readonly description?: string;
}

export function FeedFilterSelector<Value extends string>({
	ariaLabel,
	className,
	clearLabel,
	groupLabel,
	onValueChange,
	options,
	selectedCountLabel,
	unfilteredLabel,
	value,
}: {
	ariaLabel: string;
	className?: string;
	clearLabel: string;
	groupLabel?: string;
	onValueChange: (value: readonly Value[]) => void;
	options: readonly FeedFilterOption<Value>[];
	selectedCountLabel: (count: number) => string;
	unfilteredLabel: string;
	value: readonly Value[];
}) {
	const availableValues = new Set(options.map((option) => option.value));
	const explicitValues = value.filter((candidate) => availableValues.has(candidate));
	const selected = new Set(explicitValues);
	const selectedLabels = options.flatMap((option) =>
		selected.has(option.value) ? [option.label] : [],
	);
	const summary =
		selectedLabels.length === 0
			? unfilteredLabel
			: selectedLabels.length <= 2
				? selectedLabels.join(", ")
				: selectedCountLabel(selectedLabels.length);
	const setChecked = (option: FeedFilterOption<Value>, checked: boolean) => {
		const next = new Set(explicitValues);
		if (checked) next.add(option.value);
		else next.delete(option.value);
		onValueChange(
			options.flatMap(({ value: candidate }) => (next.has(candidate) ? [candidate] : [])),
		);
	};

	return (
		<Menu closeOnSelect={false} positioning={{ placement: "bottom-start" }}>
			<MenuTrigger asChild>
				<Button
					aria-label={ariaLabel}
					className={cn(
						"max-w-[min(18rem,calc(100vw-2rem))] min-w-44 justify-start",
						className,
					)}
					size="lg"
				>
					<ListFilterIcon aria-hidden data-icon="inline-start" />
					<span className="min-w-0 truncate">{summary}</span>
					<ChevronsUpDownIcon aria-hidden className="ms-auto" data-icon="inline-end" />
				</Button>
			</MenuTrigger>
			<MenuContent className="max-h-96 w-[min(18rem,calc(100vw-2rem))] p-1.5">
				<MenuItem
					disabled={explicitValues.length === 0}
					onSelect={() => onValueChange([])}
					value="clear-feed-filter"
				>
					<XIcon aria-hidden />
					{clearLabel}
				</MenuItem>
				<MenuSeparator />
				<MenuGroup heading={groupLabel}>
					{options.map((option) => (
						<FeedFilterMenuItem
							checked={selected.has(option.value)}
							key={option.value}
							onCheckedChange={(checked) => setChecked(option, checked)}
							option={option}
						/>
					))}
				</MenuGroup>
			</MenuContent>
		</Menu>
	);
}

function FeedFilterMenuItem<Value extends string>({
	checked,
	onCheckedChange,
	option,
}: {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	option: FeedFilterOption<Value>;
}) {
	return (
		<MenuCheckboxItem
			checked={checked}
			className="items-start py-2.5"
			onCheckedChange={(nextChecked) => onCheckedChange(nextChecked === true)}
			value={option.value}
		>
			<span className="grid gap-0.5">
				<span className="font-semibold">{option.label}</span>
				{option.description ? (
					<span className="text-muted-foreground text-xs leading-5">
						{option.description}
					</span>
				) : null}
			</span>
		</MenuCheckboxItem>
	);
}
