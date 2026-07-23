"use client";

import { useListCollection } from "@ark-ui/react";
import type { EntityPickerHit } from "@rezics/ui";
import {
	Badge,
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	IdentityAvatar,
} from "@rezics/ui";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { searchEntities } from "./search-entities";

export interface SearchEntityOption extends EntityPickerHit {
	readonly kind: string;
}

function uniqueOptions(
	selected: readonly SearchEntityOption[],
	hits: readonly SearchEntityOption[],
): SearchEntityOption[] {
	const byId = new Map(selected.map((option) => [option.id, option]));
	for (const hit of hits) byId.set(hit.id, hit);
	return [...byId.values()];
}

export function SearchEntityMultiSelect({
	index,
	selected,
	onChange,
	placeholder,
	loadingLabel,
	errorLabel,
	emptyLabel,
	removeLabel,
}: {
	readonly index: string;
	readonly selected: readonly SearchEntityOption[];
	readonly onChange: (selected: readonly SearchEntityOption[]) => void;
	readonly placeholder: string;
	readonly loadingLabel: string;
	readonly errorLabel: string;
	readonly emptyLabel: string;
	readonly removeLabel: string;
}) {
	const { t: nav } = useTranslation("nav");
	const { collection, set } = useListCollection<SearchEntityOption>({
		initialItems: [...selected],
		itemToString: (item) => item.label,
		itemToValue: (item) => item.id,
	});
	const [inputValue, setInputValue] = useState("");
	const [isPending, setIsPending] = useState(false);
	const [isError, setIsError] = useState(false);
	const kindLabels: Readonly<Record<string, string>> = nav.following.types;
	const kindLabel = (kind: string) => kindLabels[kind] ?? kind;

	useEffect(() => {
		set(uniqueOptions(selected, collection.items));
	}, [selected, set]);

	useEffect(() => {
		const query = inputValue.trim();
		if (!query) {
			set([...selected]);
			setIsPending(false);
			setIsError(false);
			return;
		}
		const request = new AbortController();
		const timer = window.setTimeout(() => {
			setIsPending(true);
			setIsError(false);
			void searchEntities(index, query, request.signal)
				.then(
					(hits) => {
						if (request.signal.aborted) return;
						const normalized = hits.map((hit): SearchEntityOption => ({
							...hit,
							kind: hit.kind ?? index,
						}));
						set(uniqueOptions(selected, normalized));
					},
					() => {
						if (!request.signal.aborted) {
							set([...selected]);
							setIsError(true);
						}
					},
				)
				.finally(() => {
					if (!request.signal.aborted) setIsPending(false);
				});
		}, 250);
		return () => {
			window.clearTimeout(timer);
			request.abort();
		};
	}, [index, inputValue, selected, set]);

	return (
		<Combobox
			collection={collection}
			inputValue={inputValue}
			multiple
			onInputValueChange={({ inputValue: nextInputValue }) => setInputValue(nextInputValue)}
			onValueChange={({ value }) => {
				const byId = new Map(collection.items.map((item) => [item.id, item]));
				onChange(
					value.flatMap((id) => {
						const option = byId.get(id);
						return option ? [option] : [];
					}),
				);
				setInputValue("");
			}}
			value={selected.map((option) => option.id)}
		>
			<ComboboxInput
				className="min-h-10 h-auto [&_[data-slot=input-group-input]]:min-w-28 [&_[data-slot=input-group-input]]:flex-1"
				placeholder={selected.length ? "" : placeholder}
				type="search"
			>
				{selected.map((option) => (
					<Badge className="my-0.5 max-w-56 gap-1.5" key={option.id} variant="secondary">
						<IdentityAvatar
							avatar={option.avatar}
							className="size-4"
							fallback={option.label.slice(0, 1)}
						/>
						<span className="truncate">{option.label}</span>
						<span className="text-muted-foreground">{kindLabel(option.kind)}</span>
						<button
							aria-label={`${removeLabel}: ${option.label}`}
							className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
							onClick={(event) => {
								event.stopPropagation();
								onChange(
									selected.filter((candidate) => candidate.id !== option.id),
								);
							}}
							type="button"
						>
							<X aria-hidden className="size-3" />
						</button>
					</Badge>
				))}
			</ComboboxInput>
			<ComboboxContent className="min-w-[min(28rem,calc(100vw-2rem))]">
				{isPending ? (
					<p className="px-2 py-2 text-muted-foreground text-sm">{loadingLabel}</p>
				) : isError ? (
					<p className="px-2 py-2 text-destructive text-sm" role="alert">
						{errorLabel}
					</p>
				) : (
					<>
						<ComboboxList>
							{collection.items.map((item) => (
								<ComboboxItem item={item} key={item.id}>
									<IdentityAvatar
										avatar={item.avatar}
										className="size-7"
										fallback={item.label.slice(0, 1)}
									/>
									<span className="min-w-0 flex-1 truncate">{item.label}</span>
									<Badge size="sm" variant="secondary">
										{kindLabel(item.kind)}
									</Badge>
								</ComboboxItem>
							))}
						</ComboboxList>
						{inputValue.trim() ? <ComboboxEmpty>{emptyLabel}</ComboboxEmpty> : null}
					</>
				)}
			</ComboboxContent>
		</Combobox>
	);
}
