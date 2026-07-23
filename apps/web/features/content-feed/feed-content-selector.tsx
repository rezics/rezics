"use client";

import { CheckCheckIcon, ChevronsUpDownIcon, ListFilterIcon, XIcon } from "lucide-react";

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
import { useTranslation } from "@/i18n/client";

export interface FeedContentOption<Value extends string> {
	readonly value: Value;
	readonly label: string;
	readonly description?: string;
}

export function FeedContentSelector<Value extends string>({
	className,
	onValueChange,
	options,
	showBulkActions = false,
	value,
}: {
	className?: string;
	onValueChange: (value: readonly Value[]) => void;
	options: readonly FeedContentOption<Value>[];
	showBulkActions?: boolean;
	value: readonly Value[];
}) {
	const { t } = useTranslation(["feed"]);
	const availableValues = new Set(options.map((option) => option.value));
	const selectedValues = value.filter((candidate) => availableValues.has(candidate));
	const selected = new Set(selectedValues);
	const selectedLabels = options.flatMap((option) =>
		selected.has(option.value) ? [option.label] : [],
	);
	const unitOptions = options.filter(({ value: optionValue }) => optionValue.startsWith("unit:"));
	const postOptions = options.filter(({ value: optionValue }) => optionValue.startsWith("post:"));
	const summary =
		selectedLabels.length === options.length
			? t.feed.content.allSelected
			: selectedLabels.length === 0
				? t.feed.content.noneSelected
				: selectedLabels.length <= 2
					? selectedLabels.join(", ")
					: t.feed.content.selectedCount({ count: selectedLabels.length });
	const setChecked = (option: FeedContentOption<Value>, checked: boolean) => {
		const next = new Set(selectedValues);
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
					aria-label={t.feed.contentFilterLabel}
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
				{showBulkActions ? (
					<>
						<MenuItem
							disabled={selectedValues.length === 0}
							onSelect={() => onValueChange([])}
							value="clear-feed-content"
						>
							<XIcon aria-hidden />
							{t.feed.content.clear}
						</MenuItem>
						<MenuItem
							disabled={selectedValues.length === options.length}
							onSelect={() => onValueChange(options.map((option) => option.value))}
							value="select-all-feed-content"
						>
							<CheckCheckIcon aria-hidden />
							{t.feed.content.all}
						</MenuItem>
						<MenuSeparator />
					</>
				) : null}
				{unitOptions.length > 0 ? (
					<MenuGroup heading={t.feed.content.unitGroup}>
						{unitOptions.map((option) => (
							<FeedContentMenuItem
								checked={selected.has(option.value)}
								key={option.value}
								onCheckedChange={(checked) => setChecked(option, checked)}
								option={option}
							/>
						))}
					</MenuGroup>
				) : null}
				{unitOptions.length > 0 && postOptions.length > 0 ? <MenuSeparator /> : null}
				{postOptions.length > 0 ? (
					<MenuGroup heading={t.feed.content.postGroup}>
						{postOptions.map((option) => (
							<FeedContentMenuItem
								checked={selected.has(option.value)}
								key={option.value}
								onCheckedChange={(checked) => setChecked(option, checked)}
								option={option}
							/>
						))}
					</MenuGroup>
				) : null}
			</MenuContent>
		</Menu>
	);
}

function FeedContentMenuItem<Value extends string>({
	checked,
	onCheckedChange,
	option,
}: {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	option: FeedContentOption<Value>;
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
