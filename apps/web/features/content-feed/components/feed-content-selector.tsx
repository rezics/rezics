"use client";

import {
	normalizeSimpleFeedContentKinds,
	SimpleFeedContentKindValues,
	simpleFeedContentKindGroup,
	type SimpleFeedContentKind,
} from "@rezics/filter";
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
} from "@rezics/ui";
import { useTranslation } from "@/i18n/client";

export function FeedContentSelector({
	onValueChange,
	options: optionValues,
	value,
}: {
	onValueChange: (value: readonly SimpleFeedContentKind[]) => void;
	options?: readonly SimpleFeedContentKind[];
	value: readonly SimpleFeedContentKind[];
}) {
	const { t } = useTranslation(["feed"]);
	const availableKinds = normalizeSimpleFeedContentKinds(
		optionValues ?? SimpleFeedContentKindValues,
	);
	const available = new Set(availableKinds);
	const selectedKinds = normalizeSimpleFeedContentKinds(value).filter((contentKind) =>
		available.has(contentKind),
	);
	const selected = new Set(selectedKinds);
	const options = availableKinds.map((contentKind) => ({
		value: contentKind,
		label: t.feed.content.kinds[contentKind],
		...(contentKind === "post:post" ? { description: t.feed.content.postDescription } : {}),
	}));
	const unitOptions = options.filter(
		(option) => simpleFeedContentKindGroup(option.value) === "unit",
	);
	const postOptions = options.filter(
		(option) => simpleFeedContentKindGroup(option.value) === "post",
	);
	const selectedLabels = options.flatMap((option) =>
		selected.has(option.value) ? [option.label] : [],
	);
	const summary =
		selectedLabels.length === 0
			? t.feed.content.allSelected
			: selectedLabels.length <= 2
				? selectedLabels.join(", ")
				: t.feed.content.selectedCount({ count: selectedLabels.length });
	const setChecked = (contentKind: SimpleFeedContentKind, checked: boolean) => {
		const next = new Set(selectedKinds);
		if (checked) next.add(contentKind);
		else next.delete(contentKind);
		onValueChange(availableKinds.filter((candidate) => next.has(candidate)));
	};

	return (
		<Menu closeOnSelect={false} positioning={{ placement: "bottom-start" }}>
			<MenuTrigger asChild>
				<Button
					aria-label={t.feed.contentFilterLabel}
					className="max-w-[min(18rem,calc(100vw-2rem))] min-w-44 justify-start"
					size="lg"
				>
					<ListFilterIcon aria-hidden data-icon="inline-start" />
					<span className="min-w-0 truncate">{summary}</span>
					<ChevronsUpDownIcon aria-hidden className="ms-auto" data-icon="inline-end" />
				</Button>
			</MenuTrigger>
			<MenuContent className="max-h-96 w-[min(18rem,calc(100vw-2rem))] p-1.5">
				<MenuItem
					disabled={selectedKinds.length === 0}
					onSelect={() => onValueChange([])}
					value="clear-feed-content"
				>
					<XIcon aria-hidden />
					{t.feed.content.clear}
				</MenuItem>
				<MenuSeparator />
				<MenuGroup heading={t.feed.content.unitGroup}>
					{unitOptions.map((option) => (
						<FeedContentMenuItem
							checked={selected.has(option.value)}
							key={option.value}
							onCheckedChange={(checked) => setChecked(option.value, checked)}
							option={option}
						/>
					))}
				</MenuGroup>
				<MenuSeparator />
				<MenuGroup heading={t.feed.content.postGroup}>
					{postOptions.map((option) => (
						<FeedContentMenuItem
							checked={selected.has(option.value)}
							key={option.value}
							onCheckedChange={(checked) => setChecked(option.value, checked)}
							option={option}
						/>
					))}
				</MenuGroup>
			</MenuContent>
		</Menu>
	);
}

function FeedContentMenuItem({
	checked,
	onCheckedChange,
	option,
}: {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	option: Readonly<{
		value: SimpleFeedContentKind;
		label: string;
		description?: string;
	}>;
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
