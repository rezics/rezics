"use client";

import { useFilter, useListCollection } from "@ark-ui/react";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	IdentityAvatar,
} from "@rezics/ui";
import { Globe2Icon } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useChineseContentTexts } from "@/features/content-language-display/chinese-content-display-context";
import { useTranslation } from "@/i18n/client";
import type {
	RealmTagVoteContextPresentation,
	TagVoteContextSelection,
} from "../model/tag-presentation";

const GlobalContextValue = "global";
type RealmContextValue = `realm:${string}`;
type TagVoteContextValue = typeof GlobalContextValue | RealmContextValue;

interface TagVoteContextOption {
	readonly value: TagVoteContextValue;
	readonly label: string;
	readonly description?: string;
	readonly icon: ReactNode;
	readonly selection: TagVoteContextSelection;
}

function realmContextValue(realmId: string): RealmContextValue {
	return `realm:${realmId}`;
}

export function TagVoteContextSelector({
	onValueChange,
	realms,
	value,
}: {
	readonly onValueChange: (selection: TagVoteContextSelection) => void;
	readonly realms: readonly RealmTagVoteContextPresentation[];
	readonly value: TagVoteContextSelection;
}) {
	const { t } = useTranslation(["state", "tags", "ui"]);
	const sourceTexts = useMemo(
		() =>
			realms.flatMap((realm) => [
				{
					value: realm.title ?? t.tags.unnamedRealm,
					language: realm.title ? realm.language : undefined,
				},
				{
					value: realm.summary ?? "",
					language: realm.summary ? realm.language : undefined,
				},
			]),
		[realms, t.tags.unnamedRealm],
	);
	const displayedTexts = useChineseContentTexts(sourceTexts);
	const globalOption: TagVoteContextOption = {
		value: GlobalContextValue,
		label: t.tags.global.title,
		icon: (
			<span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
				<Globe2Icon aria-hidden className="size-3.5" />
			</span>
		),
		selection: { kind: "global" },
	};
	const options = [
		globalOption,
		...realms.map((realm, index): TagVoteContextOption => {
			const name = displayedTexts[index * 2] ?? realm.title ?? t.tags.unnamedRealm;
			const summary = displayedTexts[index * 2 + 1];
			return {
				value: realmContextValue(realm.realmId),
				label: name,
				...(summary ? { description: summary } : {}),
				icon: (
					<IdentityAvatar
						avatar={realm.avatar}
						className="mt-0.5"
						fallback={Array.from(name.trim())[0]?.toLocaleUpperCase() ?? name}
						size="sm"
					/>
				),
				selection: { kind: "realm", realm },
			};
		}),
	] satisfies readonly TagVoteContextOption[];
	const selectedValue =
		value.kind === "global" ? GlobalContextValue : realmContextValue(value.realm.realmId);
	const optionByValue: ReadonlyMap<string, TagVoteContextOption> = new Map(
		options.map((option) => [option.value, option]),
	);
	const selectedOption = optionByValue.get(selectedValue) ?? globalOption;
	const { contains } = useFilter({ sensitivity: "base" });
	const { collection, filter, set } = useListCollection<TagVoteContextOption>({
		filter: contains,
		initialItems: options,
		itemToString: (item) =>
			item.description ? `${item.label} ${item.description}` : item.label,
		itemToValue: (item) => item.value,
	});
	const [inputValue, setInputValue] = useState(selectedOption.label);
	const [open, setOpen] = useState(false);
	const optionsKey = options
		.map((option) => `${option.value}\u0000${option.label}\u0000${option.description ?? ""}`)
		.join("\u0001");
	const visibleOptions = collection.items.flatMap((item) => {
		const option = optionByValue.get(item.value);
		return option ? [option] : [];
	});

	useEffect(() => set([...options]), [optionsKey, set]);
	useEffect(() => filter(open ? inputValue : ""), [filter, inputValue, open, optionsKey]);
	useEffect(() => {
		if (!open) setInputValue(selectedOption.label);
	}, [open, selectedOption.label]);

	return (
		<Combobox
			collection={collection}
			inputValue={inputValue}
			onInputValueChange={({ inputValue: nextInputValue }) => {
				setInputValue(nextInputValue);
				filter(nextInputValue);
			}}
			onOpenChange={({ open: nextOpen }) => {
				setOpen(nextOpen);
				setInputValue(nextOpen ? "" : selectedOption.label);
				filter("");
			}}
			onValueChange={({ value: selectedValues }) => {
				const nextValue = selectedValues[0];
				if (!nextValue) return;
				const option = optionByValue.get(nextValue);
				if (!option) return;
				onValueChange(option.selection);
				setInputValue(option.label);
			}}
			open={open}
			value={[selectedValue]}
		>
			<ComboboxInput
				aria-label={t.tags.voteContext.select}
				className="w-full"
				placeholder={t.ui.pickerPlaceholders.realm}
				showTrigger
				size="lg"
				type="search"
			/>
			<ComboboxContent className="w-[min(22rem,calc(100vw-2rem))]">
				<ComboboxList>
					{visibleOptions.map((option) => (
						<ComboboxItem
							className="items-start py-2.5"
							item={option}
							key={option.value}
						>
							{option.icon}
							<span className="grid min-w-0 flex-1 gap-0.5">
								<span className="truncate font-semibold">{option.label}</span>
								{option.description ? (
									<span className="line-clamp-2 text-muted-foreground text-xs leading-5">
										{option.description}
									</span>
								) : null}
							</span>
						</ComboboxItem>
					))}
				</ComboboxList>
				<ComboboxEmpty>{t.state.empty}</ComboboxEmpty>
			</ComboboxContent>
		</Combobox>
	);
}
